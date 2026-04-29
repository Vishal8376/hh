import { useState } from "react";

export default function ResultPage({ data, onReset }) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(data.hashId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDob = (dob) => {
    if (!dob) return "—";
    const d = new Date(dob);
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  };

  // Format hash into groups of 8 for readability
  const formatHash = (hash) => {
    return hash.match(/.{1,8}/g)?.join(" ") || hash;
  };

  return (
    <main className="result-page">
      <div className="result-bg" />
      <div className="result-card fade-up">
        <div className="result-badge">Verified</div>

        <h1 className="result-name">{data.name}</h1>
        <p className="result-message">Your identity has been securely verified</p>

        <div className="result-meta fade-up-delay">
          <div className="meta-item">
            <span className="meta-label">Date of Birth</span>
            <span className="meta-value">{formatDob(data.dob)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Status</span>
            <span className="meta-value" style={{ color: "var(--accent)" }}>✓ Verified</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Algorithm</span>
            <span className="meta-value">SHA-256</span>
          </div>
        </div>

        <div className="result-divider" />

        <div className="hash-container fade-up-delay2">
          <div className="hash-label">Unique Digital Identity (Hash ID)</div>
          <div className="hash-value">{formatHash(data.hashId)}</div>
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button className="btn btn-ghost" onClick={copyHash}>
            {copied ? "✓ Copied" : "Copy Hash"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={onReset}
            style={{ fontSize: "0.82rem" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
