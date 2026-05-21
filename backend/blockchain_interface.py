# backend/blockchain_interface.py
import os
import json
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# ── Environment Variables ──────────────────────────────────────────────────────
SEPOLIA_RPC_URL   = os.getenv("SEPOLIA_RPC_URL")
PRIVATE_KEY       = os.getenv("PRIVATE_KEY")
CONTRACT_ADDRESS  = os.getenv("CONTRACT_ADDRESS")

# ── Load ABI from compiled Hardhat artifact ────────────────────────────────────
# After running `npx hardhat compile`, the ABI lives at:
# blockchain/artifacts/contracts/Certificates.sol/Certificates.json
ABI_PATH = os.path.join(
    os.path.dirname(__file__),
    "Certificates.json"
)

def _load_abi():
    try:
        with open(ABI_PATH, "r") as f:
            artifact = json.load(f)
        return artifact["abi"]
    except FileNotFoundError:
        raise FileNotFoundError(
            f"ABI not found at {ABI_PATH}. "
            "Run `npx hardhat compile` inside the blockchain/ folder first."
        )

# ── Web3 Connection ────────────────────────────────────────────────────────────
def _get_contract():
    """Returns a connected Web3 contract instance."""
    if not SEPOLIA_RPC_URL:
        raise EnvironmentError("SEPOLIA_RPC_URL is not set in backend/.env")
    if not CONTRACT_ADDRESS:
        raise EnvironmentError("CONTRACT_ADDRESS is not set in backend/.env")

    w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))
    if not w3.is_connected():
        raise ConnectionError("Failed to connect to Sepolia RPC. Check your SEPOLIA_RPC_URL.")

    abi = _load_abi()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=abi
    )
    return w3, contract


# ── Core Functions ─────────────────────────────────────────────────────────────

def issue_certificate_on_chain(name: str, course: str, ipfs_cid: str, pdf_hash_hex: str) -> dict:
    """
    Calls issueCertificate() on the smart contract.

    Args:
        name         : Student's full name
        course       : Course / degree name
        ipfs_cid     : The IPFS CID returned by Pinata
        pdf_hash_hex : The 0x-prefixed SHA-256 hex string from hashing_engine

    Returns:
        dict with 'tx_hash' and 'status'
    """
    if not PRIVATE_KEY:
        raise EnvironmentError("PRIVATE_KEY is not set in backend/.env")

    w3, contract = _get_contract()

    # Convert the 0x hex string → bytes32 that Solidity expects
    cert_hash_bytes = bytes.fromhex(pdf_hash_hex.removeprefix("0x"))

    admin_account = w3.eth.account.from_key(PRIVATE_KEY)
    nonce = w3.eth.get_transaction_count(admin_account.address)

    # Build the transaction
    txn = contract.functions.issueCertificate(
        name, course, ipfs_cid, cert_hash_bytes
    ).build_transaction({
        "chainId": 11155111,          # Sepolia chain ID
        "gas": 200_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": nonce,
        "from": admin_account.address,
    })

    # Sign and send
    signed_txn = w3.eth.account.sign_transaction(txn, private_key=PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)

    print(f"⏳ Transaction sent. Waiting for confirmation...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    status = "success" if receipt.status == 1 else "failed"
    tx_hash_hex = tx_hash.hex()

    print(f"✅ Transaction {status}: https://sepolia.etherscan.io/tx/{tx_hash_hex}")
    return {
        "tx_hash": tx_hash_hex,
        "status": status,
        "block_number": receipt.blockNumber,
        "etherscan_url": f"https://sepolia.etherscan.io/tx/{tx_hash_hex}"
    }


def verify_certificate_on_chain(pdf_hash_hex: str) -> dict:
    """
    Calls verifyCertificate() on the smart contract (read-only, no gas needed).

    Args:
        pdf_hash_hex : The 0x-prefixed SHA-256 hex string of the PDF

    Returns:
        dict with certificate data, or an error message
    """
    try:
        w3, contract = _get_contract()

        cert_hash_bytes = bytes.fromhex(pdf_hash_hex.removeprefix("0x"))

        name, course, ipfs_cid, is_valid = contract.functions.verifyCeritificate(
            cert_hash_bytes
        ).call()

        return {
            "found": True,
            "name": name,
            "course": course,
            "ipfs_cid": ipfs_cid,
            "ipfs_url": f"https://gateway.pinata.cloud/ipfs/{ipfs_cid}",
            "is_valid": is_valid,
            "status": "VERIFIED ✅" if is_valid else "REVOKED ❌"
        }

    except Exception as e:
        error_str = str(e)
        # Solidity revert message when cert doesn't exist
        if "Certificate does not exist" in error_str:
            return {"found": False, "status": "NOT FOUND ❌", "message": "No certificate exists for this hash."}
        return {"found": False, "status": "ERROR", "message": error_str}


def revoke_certificate_on_chain(pdf_hash_hex: str) -> dict:
    """
    Calls revokeCertificate() on the smart contract (admin only).
    """
    if not PRIVATE_KEY:
        raise EnvironmentError("PRIVATE_KEY is not set in backend/.env")

    w3, contract = _get_contract()
    cert_hash_bytes = bytes.fromhex(pdf_hash_hex.removeprefix("0x"))
    admin_account = w3.eth.account.from_key(PRIVATE_KEY)
    nonce = w3.eth.get_transaction_count(admin_account.address)

    txn = contract.functions.revokeCertificate(cert_hash_bytes).build_transaction({
        "chainId": 11155111,
        "gas": 100_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": nonce,
        "from": admin_account.address,
    })

    signed_txn = w3.eth.account.sign_transaction(txn, private_key=PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    status = "success" if receipt.status == 1 else "failed"
    tx_hash_hex = tx_hash.hex()
    return {
        "tx_hash": tx_hash_hex,
        "status": status,
        "etherscan_url": f"https://sepolia.etherscan.io/tx/{tx_hash_hex}"
    }


# ── Quick test when run directly ───────────────────────────────────────────────
if __name__ == "__main__":
    test_hash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    print("Testing verify (should return NOT FOUND on a fresh contract):")
    result = verify_certificate_on_chain(test_hash)
    print(result)