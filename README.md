# KYCVerify — Full-Stack KYC Verification App

A complete KYC (Know Your Customer) verification system with React frontend + Flask backend + SQLite database.

## Project Structure

```
kyc-app/
├── backend/
│   ├── app.py              # Flask app factory + entry point
│   ├── config.py           # Configuration (secrets, DB URI)
│   ├── extensions.py       # SQLAlchemy + JWT instances
│   ├── models.py           # User + KYC ORM models
│   ├── requirements.txt    # Python dependencies
│   └── routes/
│       ├── __init__.py
│       ├── auth.py         # POST /signup, POST /login
│       └── kyc.py          # POST /verify, GET /status
└── frontend/
    ├── package.json
    └── src/
        ├── App.js           # Root component + state routing
        ├── index.js         # React entry point
        ├── index.css        # Global styles
        ├── components/
        │   └── Navbar.js
        ├── pages/
        │   ├── AuthPage.js  # Login / Signup
        │   ├── KYCPage.js   # Identity verification form
        │   └── ResultPage.js # Digital identity display
        └── utils/
            ├── api.js           # Axios instance with JWT interceptor
            └── AuthContext.js   # Auth state + localStorage
```

## Prerequisites

- Python 3.8+
- Node.js 16+ and npm

---

## Setup & Run

### 1. Backend (Flask)

```bash
cd kyc-app/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server (runs on http://localhost:5000)
python app.py
```

The SQLite database (`kyc.db`) is auto-created on first run.

### 2. Frontend (React)

Open a second terminal:

```bash
cd kyc-app/frontend

# Install dependencies
npm install

# Start dev server (runs on http://localhost:3000)
npm start
```

The browser will open automatically at `http://localhost:3000`.

---

## API Reference

### Auth

| Method | Endpoint      | Body                        | Response                          |
|--------|---------------|-----------------------------|-----------------------------------|
| POST   | /api/signup   | `{email, password}`         | `{token, user}`                   |
| POST   | /api/login    | `{email, password}`         | `{token, user}`                   |

### KYC

| Method | Endpoint      | Auth   | Body                             | Response                          |
|--------|---------------|--------|----------------------------------|-----------------------------------|
| POST   | /api/verify   | JWT    | `{name, dob, idNumber}`          | `{verified, hashId, name, dob}`   |
| GET    | /api/status   | JWT    | —                                | `{verified, hashId, name, dob}`   |

---

## Security Features

- **Passwords**: Hashed with Werkzeug's PBKDF2-SHA256
- **JWT Tokens**: Stored in localStorage, sent via `Authorization: Bearer` header
- **Identity Hash**: SHA-256 of `name|dob|idNumber` (all normalized to lowercase/uppercase)
- **CORS**: Restricted to `http://localhost:3000`
- **No plaintext ID storage**: The raw `idNumber` is saved for display reference but the hash is the unique identifier

---

## Flow

```
User → Signup/Login → JWT issued
     → POST /verify (name, dob, idNumber)
     → Backend generates SHA-256(name|dob|idNumber)
     → Saves KYC record with verified=true
     → Returns {hashId, verified: true}
     → Frontend displays Digital Identity Card
```

---

## Environment Variables (Optional)

Set in backend for production:

```bash
export SECRET_KEY="your-flask-secret"
export JWT_SECRET_KEY="your-jwt-secret"
```
