// frontend/src/components/AdminDashboard.jsx
import { useState, useRef } from "react";

const API = "https://certiledger-api.onrender.com";

const STEPS = [
  { id: "upload",     icon: "📄", label: "PDF Upload" },
  { id: "hash",       icon: "🔐", label: "SHA-256 Hash" },
  { id: "ipfs",       icon: "📌", label: "IPFS Pin" },
  { id: "blockchain", icon: "⛓️",  label: "Blockchain" },
  { id: "done",       icon: "✅", label: "Complete" },
];

export default function AdminDashboard() {
  const [name,       setName]       = useState("");
  const [course,     setCourse]     = useState("");
  const [adminKey,   setAdminKey]   = useState("");
  const [file,       setFile]       = useState(null);
  const [dragOver,   setDragOver]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState(null);

  // Revoke state
  const [revokeHash, setRevokeHash] = useState("");
  const [revokeKey,  setRevokeKey]  = useState("");
  const [revokeRes,  setRevokeRes]  = useState(null);
  const [revokeErr,  setRevokeErr]  = useState(null);
  const [revoking,   setRevoking]   = useState(false);

  const fileInputRef = useRef();

  const handleFile = (f) => {
    if (f && f.type === "application/pdf") {
      setFile(f); setError(null);
    } else {
      setError("Please select a valid PDF file.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleIssue = async () => {
    if (!file || !name || !course || !adminKey) {
      setError("All fields and the PDF file are required."); return;
    }
    setLoading(true); setResult(null); setError(null);

    const formData = new FormData();
    formData.append("file",      file);
    formData.append("name",      name);
    formData.append("course",    course);
    formData.append("admin_key", adminKey);

    // Animate through pipeline steps
    const stepDelay = (step, ms) =>
      new Promise(res => { setActiveStep(step); setTimeout(res, ms); });

    try {
      setActiveStep("upload");
      const response = await fetch(`${API}/issue_certificate`, {
        method: "POST",
        body: formData,
      });

      // Simulate step progression while waiting
      await stepDelay("hash",       800);
      await stepDelay("ipfs",       900);
      await stepDelay("blockchain", 1000);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");

      setActiveStep("done");
      setResult(data);
    } catch (e) {
      setError(e.message);
      setActiveStep(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeHash || !revokeKey) { setRevokeErr("Hash and admin key are required."); return; }
    setRevoking(true); setRevokeRes(null); setRevokeErr(null);
    try {
      const res = await fetch(`${API}/revoke_certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: revokeHash, admin_key: revokeKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revocation failed");
      setRevokeRes(data);
    } catch (e) {
      setRevokeErr(e.message);
    } finally {
      setRevoking(false);
    }
  };

  const getStepState = (stepId) => {
    if (!activeStep) return "idle";
    const idx        = STEPS.findIndex(s => s.id === stepId);
    const activeIdx  = STEPS.findIndex(s => s.id === activeStep);
    if (idx < activeIdx)  return "done";
    if (idx === activeIdx) return "active";
    return "idle";
  };

  return (
    <div>
      {/* Hero */}
      <div className="section-hero">
        <span className="section-tag">🔒 Admin Only</span>
        <h1 className="section-title">Issue Certificates</h1>
        <p className="section-subtitle">
          Upload a PDF to permanently anchor its cryptographic fingerprint on the Ethereum blockchain.
        </p>
      </div>

      {/* Pipeline Visualizer */}
      {loading && (
        <div className="pipeline">
          {STEPS.map((step, i) => (
            <>
              <div key={step.id} className={`pipeline-step ${getStepState(step.id)}`}>
                <div className="step-icon">{step.icon}</div>
                <span className="step-label">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && <span key={`arrow-${i}`} className="pipeline-arrow">→</span>}
            </>
          ))}
        </div>
      )}

      {/* Issue Form */}
      <div className="card">
        <p className="card-title">Certificate Details</p>

        <div className="field">
          <label>Student Full Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Mohammed Aryan Khan" />
        </div>
        <div className="field">
          <label>Course / Degree</label>
          <input type="text" value={course} onChange={e => setCourse(e.target.value)}
            placeholder="e.g. B.Tech Computer Science, 2024" />
        </div>
        <div className="field">
          <label>Admin Secret Key</label>
          <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)}
            placeholder="Enter ADMIN_SECRET from your .env" />
        </div>

        <div className="field">
          <label>PDF Certificate</label>
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
            <div className="dropzone-icon">📄</div>
            <div className="dropzone-text">Drop PDF here or click to browse</div>
            <div className="dropzone-sub">Only .pdf files accepted</div>
            {file && <div className="file-selected">✓ {file.name} ({(file.size/1024).toFixed(1)} KB)</div>}
          </div>
        </div>

        {error && (
          <div className="result-panel error" style={{ marginTop: "1rem", padding: "1rem" }}>
            <span style={{ color: "var(--error)" }}>❌ {error}</span>
          </div>
        )}

        <button className="btn btn-primary btn-full" onClick={handleIssue} disabled={loading}>
          {loading
            ? <><span className="btn-spinner">⟳</span> Processing...</>
            : <><span>🎓</span> Issue Certificate</>
          }
        </button>
      </div>

      {/* Success Result */}
      {result && (
        <div className="result-panel success">
          <div className="result-badge success">✅ Certificate Issued Successfully</div>
          <div className="data-row"><span className="data-label">Student</span>    <span className="data-value">{result.student_name}</span></div>
          <div className="data-row"><span className="data-label">Course</span>     <span className="data-value">{result.course}</span></div>
          <div className="data-row"><span className="data-label">PDF Hash</span>   <span className="data-value mono">{result.pdf_hash}</span></div>
          <div className="data-row"><span className="data-label">IPFS CID</span>   <span className="data-value mono"><a href={result.ipfs_url} target="_blank" rel="noreferrer">{result.ipfs_cid}</a></span></div>
          <div className="data-row"><span className="data-label">Block</span>      <span className="data-value mono">#{result.block_number}</span></div>
          <div className="data-row"><span className="data-label">Tx Hash</span>    <span className="data-value mono"><a href={result.etherscan_url} target="_blank" rel="noreferrer">{result.tx_hash.slice(0,20)}...↗</a></span></div>
        </div>
      )}

      {/* Revoke Section */}
      <div className="card" style={{ marginTop: "2.5rem" }}>
        <p className="card-title">⚠️ Revoke Certificate</p>
        <div className="field">
          <label>Certificate Hash (0x...)</label>
          <input type="text" value={revokeHash} onChange={e => setRevokeHash(e.target.value)}
            placeholder="0xabc123..." />
        </div>
        <div className="field">
          <label>Admin Secret Key</label>
          <input type="password" value={revokeKey} onChange={e => setRevokeKey(e.target.value)}
            placeholder="Enter ADMIN_SECRET" />
        </div>
        {revokeErr && <p style={{ color: "var(--error)", fontSize: "0.85rem", marginBottom: "1rem" }}>❌ {revokeErr}</p>}
        {revokeRes && (
          <div className="result-panel warning" style={{ marginBottom: "1rem" }}>
            <div className="result-badge warning">⚠️ Certificate Revoked</div>
            <div className="data-row"><span className="data-label">Tx</span><span className="data-value mono"><a href={revokeRes.etherscan_url} target="_blank" rel="noreferrer">{revokeRes.tx_hash?.slice(0,24)}...↗</a></span></div>
          </div>
        )}
        <button className="btn btn-danger btn-full" onClick={handleRevoke} disabled={revoking}>
          {revoking ? <><span className="btn-spinner">⟳</span> Revoking...</> : "Revoke Certificate"}
        </button>
      </div>
    </div>
  );
}