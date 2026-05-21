// frontend/src/components/VerificationPortal.jsx
import { useState, useRef } from "react";

const API = "http://localhost:5000";

export default function VerificationPortal() {
  const [mode,       setMode]     = useState("file"); // "file" or "hash"
  const [file,       setFile]     = useState(null);
  const [hashInput,  setHashInput]= useState("");
  const [dragOver,   setDragOver] = useState(false);
  const [loading,    setLoading]  = useState(false);
  const [result,     setResult]   = useState(null);
  const [error,      setError]    = useState(null);
  const fileInputRef = useRef();

  const handleFile = (f) => {
    if (f && f.type === "application/pdf") {
      setFile(f); setError(null); setResult(null);
    } else {
      setError("Please select a valid PDF file.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleVerify = async () => {
    setLoading(true); setResult(null); setError(null);
    try {
      let response;
      if (mode === "file") {
        if (!file) { setError("Please select a PDF file first."); setLoading(false); return; }
        const formData = new FormData();
        formData.append("file", file);
        response = await fetch(`${API}/verify_certificate`, { method: "POST", body: formData });
      } else {
        if (!hashInput.startsWith("0x") || hashInput.length !== 66) {
          setError("Hash must be a 0x-prefixed 64-character hex string."); setLoading(false); return;
        }
        response = await fetch(`${API}/verify_certificate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash: hashInput }),
        });
      }
      const data = await response.json();
      setResult(data);
    } catch (e) {
      setError("Could not reach the CertiLedger API. Is Flask running on port 5000?");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFile(null); setHashInput(""); setResult(null); setError(null); };

  const panelType = () => {
    if (!result) return null;
    if (!result.found) return "error";
    if (result.is_valid) return "success";
    return "warning";
  };

  return (
    <div>
      {/* Hero */}
      <div className="section-hero">
        <span className="section-tag">🔍 Public Access</span>
        <h1 className="section-title">Verify a Certificate</h1>
        <p className="section-subtitle">
          Upload the original PDF or paste its hash to instantly check whether it exists on the blockchain
          and has not been tampered with.
        </p>
      </div>

      {/* How it works */}
      <div className="pipeline" style={{ marginBottom: "2rem" }}>
        {[
          { icon: "📄", label: "Your PDF" },
          { icon: "🔐", label: "SHA-256" },
          { icon: "⛓️",  label: "Query Chain" },
          { icon: "✅", label: "Result" },
        ].map((s, i, arr) => (
          <>
            <div key={s.label} className="pipeline-step">
              <div className="step-icon">{s.icon}</div>
              <span className="step-label">{s.label}</span>
            </div>
            {i < arr.length - 1 && <span key={`a${i}`} className="pipeline-arrow">→</span>}
          </>
        ))}
      </div>

      {/* Mode Switcher */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {[
          { id: "file", label: "📄 Upload PDF" },
          { id: "hash", label: "🔑 Enter Hash" },
        ].map(m => (
          <button
            key={m.id}
            className={`nav-btn ${mode === m.id ? "active" : ""}`}
            onClick={() => { setMode(m.id); reset(); }}
          >{m.label}</button>
        ))}
      </div>

      {/* Input Card */}
      <div className="card">
        {mode === "file" ? (
          <>
            <p className="card-title">Upload Original Certificate PDF</p>
            <div
              className={`dropzone ${dragOver ? "drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input
                ref={fileInputRef} type="file" accept=".pdf"
                onChange={e => handleFile(e.target.files[0])}
                style={{ display: "none" }}
              />
              <div className="dropzone-icon">🔍</div>
              <div className="dropzone-text">Drop the original PDF here to verify</div>
              <div className="dropzone-sub">The file is hashed locally — it is never stored</div>
              {file && <div className="file-selected">✓ {file.name} ({(file.size/1024).toFixed(1)} KB)</div>}
            </div>
          </>
        ) : (
          <>
            <p className="card-title">Paste Certificate Hash</p>
            <div className="field">
              <label>SHA-256 Hash (0x-prefixed)</label>
              <input
                type="text" value={hashInput} onChange={e => setHashInput(e.target.value)}
                placeholder="0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}
              />
            </div>
          </>
        )}

        {error && (
          <div className="result-panel error" style={{ marginTop: "1rem", padding: "1rem" }}>
            <span style={{ color: "var(--error)" }}>❌ {error}</span>
          </div>
        )}

        <button className="btn btn-primary btn-full" onClick={handleVerify}
          disabled={loading} style={{ marginTop: "1.2rem" }}>
          {loading
            ? <><span className="btn-spinner">⟳</span> Querying blockchain...</>
            : <><span>🔍</span> Verify Certificate</>}
        </button>
      </div>

      {/* Result Panel */}
      {result && (
        <div className={`result-panel ${panelType()}`}>
          {result.found && result.is_valid && (
            <>
              <div className="result-badge success">✅ CERTIFICATE VERIFIED</div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
                This certificate is authentic and has not been tampered with.
              </p>
              <div className="data-row"><span className="data-label">Student</span>    <span className="data-value">{result.name}</span></div>
              <div className="data-row"><span className="data-label">Course</span>     <span className="data-value">{result.course}</span></div>
              <div className="data-row"><span className="data-label">IPFS Copy</span>  <span className="data-value mono"><a href={result.ipfs_url} target="_blank" rel="noreferrer">{result.ipfs_cid} ↗</a></span></div>
              <div className="data-row"><span className="data-label">Hash</span>       <span className="data-value mono">{result.queried_hash}</span></div>
            </>
          )}
          {result.found && !result.is_valid && (
            <>
              <div className="result-badge warning">⚠️ CERTIFICATE REVOKED</div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "1.2rem" }}>
                This certificate was found on-chain but has been revoked by the institution.
              </p>
              <div className="data-row"><span className="data-label">Student</span>   <span className="data-value">{result.name}</span></div>
              <div className="data-row"><span className="data-label">Course</span>    <span className="data-value">{result.course}</span></div>
              <div className="data-row"><span className="data-label">Status</span>    <span className="data-value" style={{ color: "var(--warning)" }}>REVOKED</span></div>
            </>
          )}
          {!result.found && (
            <>
              <div className="result-badge error">❌ NOT FOUND</div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {result.message || "No certificate matching this hash exists on the blockchain."}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.8rem", fontFamily: "var(--font-mono)" }}>
                Queried: {result.queried_hash}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}