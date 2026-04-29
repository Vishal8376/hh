# TrustVault — User-Controlled Financial Identity Verification

A user-controlled financial identity verification system that combats deepfake impersonation, synthetic identity fraud, and credential theft in regulated financial services.

## Features

- **Deepfake Detection** — Multi-layer AI analysis with 8-point checks, liveness challenges, and injection attack detection
- **Portable Credential Wallet** — Tamper-proof verifiable credentials aligned with DigiLocker & W3C VC standards
- **ZKP Selective Disclosure** — Privacy-preserving identity sharing without exposing raw PII
- **Real-time Anomaly Detection** — Behavioral analysis, device fingerprinting, and velocity monitoring
- **Inclusive Access** — High contrast, large text, voice guidance, and low bandwidth modes

## Quick Start

```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Run the server
python app.py
```

Open **http://localhost:5000** in your browser.

## Architecture

```
Frontend (HTML/CSS/JS)  →  Flask API  →  Services (Deepfake, ZKP, Anomaly, Credential)
                                      →  SQLite Database
```

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing | `/` | Overview and CTA |
| Verify | `/verify.html` | 4-step identity verification with webcam |
| Wallet | `/wallet.html` | Credential wallet with detail/revoke |
| Consent | `/consent.html` | ZKP selective disclosure sharing |
| Anomaly | `/anomaly.html` | Real-time threat monitoring dashboard |
