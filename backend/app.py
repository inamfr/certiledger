# backend/app.py
import os
import tempfile
import logging
logging.basicConfig(level=logging.DEBUG)
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from hashing_engine import generate_pdf_hash
from ipfs_manager import pin_to_ipfs
from blockchain_interface import (
    issue_certificate_on_chain,
    verify_certificate_on_chain,
    revoke_certificate_on_chain,
)

load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow React frontend (localhost:3000) to call this API

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "changeme_in_production")

# ── Health Check ───────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "CertiLedger API is running ✅", "version": "1.0.0"})


# ── Issue Certificate (Admin Only) ─────────────────────────────────────────────
@app.route("/issue_certificate", methods=["POST"])
def issue_certificate():
    """
    Expects multipart/form-data:
      - file       : The PDF certificate file
      - name       : Student full name
      - course     : Course / degree name
      - admin_key  : Must match ADMIN_SECRET in .env

    Pipeline: PDF → SHA-256 Hash → Pin to IPFS → Anchor on Blockchain
    """
    # ── 1. Auth check ──────────────────────────────────────────────────────────
    admin_key = request.form.get("admin_key", "")
    if admin_key != ADMIN_SECRET:
        return jsonify({"error": "Unauthorized. Invalid admin key."}), 403

    # ── 2. Validate inputs ─────────────────────────────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "No PDF file provided. Send as 'file' field."}), 400

    name   = request.form.get("name", "").strip()
    course = request.form.get("course", "").strip()

    if not name or not course:
        return jsonify({"error": "'name' and 'course' fields are required."}), 400

    pdf_file = request.files["file"]
    if not pdf_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are accepted."}), 400

    # ── 3. Save to temp file ───────────────────────────────────────────────────
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        pdf_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # ── 4. Generate SHA-256 hash ───────────────────────────────────────────
        print(f"🔐 Hashing PDF: {pdf_file.filename}")
        pdf_hash = generate_pdf_hash(tmp_path)
        print(f"   Hash: {pdf_hash}")

        # ── 5. Pin to IPFS via Pinata ──────────────────────────────────────────
        print("📌 Pinning to IPFS...")
        ipfs_cid = pin_to_ipfs(tmp_path)
        if not ipfs_cid:
            return jsonify({"error": "Failed to upload to IPFS. Check your Pinata JWT."}), 500
        print(f"   CID: {ipfs_cid}")

        # ── 6. Anchor on Ethereum (Sepolia) ────────────────────────────────────
        print("⛓️  Writing to blockchain...")
        blockchain_result = issue_certificate_on_chain(name, course, ipfs_cid, pdf_hash)

        if blockchain_result["status"] != "success":
            return jsonify({"error": "Blockchain transaction failed.", "details": blockchain_result}), 500

        # ── 7. Return full provenance record ───────────────────────────────────
        return jsonify({
            "message": "Certificate issued successfully! 🎓",
            "student_name": name,
            "course": course,
            "pdf_hash": pdf_hash,
            "ipfs_cid": ipfs_cid,
            "ipfs_url": f"https://gateway.pinata.cloud/ipfs/{ipfs_cid}",
            "tx_hash": blockchain_result["tx_hash"],
            "block_number": blockchain_result["block_number"],
            "etherscan_url": blockchain_result["etherscan_url"],
        }), 200

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(error_details, flush=True)
        logging.error(error_details)
        return jsonify({"error": str(e), "traceback": error_details}), 500

    finally:
        # Always clean up the temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ── Verify Certificate (Public) ────────────────────────────────────────────────
@app.route("/verify_certificate", methods=["POST"])
def verify_certificate():
    """
    Accepts either:
      (A) multipart/form-data with a 'file' (PDF) — hashes it then checks chain
      (B) application/json with a 'hash' field (0x-prefixed hex) — checks directly

    Returns the certificate data if found on-chain.
    """
    pdf_hash = None

    # ── Option A: PDF file uploaded ────────────────────────────────────────────
    if "file" in request.files:
        pdf_file = request.files["file"]
        if not pdf_file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are accepted."}), 400

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            pdf_file.save(tmp.name)
            tmp_path = tmp.name

        try:
            pdf_hash = generate_pdf_hash(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    # ── Option B: Hash string provided directly ────────────────────────────────
    elif request.is_json:
        data = request.get_json()
        pdf_hash = data.get("hash", "").strip()
        if not pdf_hash.startswith("0x") or len(pdf_hash) != 66:
            return jsonify({"error": "Invalid hash format. Must be 0x-prefixed 32-byte hex."}), 400

    else:
        return jsonify({"error": "Send either a PDF file or a JSON body with a 'hash' field."}), 400

    # ── Query the blockchain ───────────────────────────────────────────────────
    result = verify_certificate_on_chain(pdf_hash)
    result["queried_hash"] = pdf_hash

    status_code = 200 if result.get("found") else 404
    return jsonify(result), status_code


# ── Revoke Certificate (Admin Only) ───────────────────────────────────────────
@app.route("/revoke_certificate", methods=["POST"])
def revoke_certificate():
    """
    Expects JSON body:
      { "hash": "0x...", "admin_key": "your_secret" }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required."}), 400

    if data.get("admin_key") != ADMIN_SECRET:
        return jsonify({"error": "Unauthorized. Invalid admin key."}), 403

    pdf_hash = data.get("hash", "").strip()
    if not pdf_hash:
        return jsonify({"error": "'hash' field is required."}), 400

    try:
        result = revoke_certificate_on_chain(pdf_hash)
        return jsonify({
            "message": "Certificate revoked successfully.",
            "tx_hash": result["tx_hash"],
            "etherscan_url": result["etherscan_url"],
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Run ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 CertiLedger Flask API starting on http://localhost:5000")
    app.run(debug=True, host="0.0.0.0", port=5000)