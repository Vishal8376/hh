import { useState } from "react";
import API from "../utils/api";

export default function KYCPage({ onVerified }) {
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setError("");
    if (!name || !dob || !idNumber) { setError("Please fill in all fields."); return; }
    if (name.trim().length < 2) { setError("Please enter your full name."); return; }

    setLoading(true);
    try {
      const res = await API.post("/verify", { name, dob, idNumber });
      onVerified(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="kyc-page">
      <div className="kyc-bg" />
      <div className="kyc-container">
        <div className="kyc-heading fade-up">
          <div className="kyc-step-label">Step 01</div>
          <h1 className="kyc-title">Verify your<br /><em>identity</em></h1>
          <p className="kyc-desc">
            Enter your details below. Your identity will be secured with SHA-256 cryptographic hashing.
          </p>
        </div>

        <div className="kyc-card fade-up-delay">
          <div className="kyc-form">
            {error && <div className="error-box">{error}</div>}

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="As on government ID"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                className="form-input"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                style={{ colorScheme: "dark" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ID Number</label>
              <input
                className="form-input"
                type="text"
                placeholder="Aadhaar / PAN / Passport"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value.toUpperCase())}
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
              />
            </div>

            <div className="kyc-notice">
              <span style={{ fontSize: "1rem", marginTop: "1px" }}>🔒</span>
              <span>
                Your data is hashed locally using SHA-256. The original ID number is not stored in plaintext after hashing.
              </span>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleVerify}
              disabled={loading}
            >
              {loading
                ? <><div className="spinner" /> Verifying identity...</>
                : "→ Verify Identity"
              }
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
