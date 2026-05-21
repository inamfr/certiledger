// frontend/src/App.jsx
import { useState } from "react";
import AdminDashboard from "./components/AdminDashboard";
import VerificationPortal from "./components/VerificationPortal";
import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = useState("verify");

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">Certi<span className="logo-accent">Ledger</span></span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${activeTab === "verify" ? "active" : ""}`}
              onClick={() => setActiveTab("verify")}
            >
              Verify Certificate
            </button>
            <button
              className={`nav-btn ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              Admin Portal
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {activeTab === "verify" ? <VerificationPortal /> : <AdminDashboard />}
      </main>

      <footer className="footer">
        <p>Secured by Ethereum Sepolia · Stored on IPFS · Hashed with SHA-256</p>
      </footer>
    </div>
  );
}