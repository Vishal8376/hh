"""
TrustVault — Main Flask Application.

User-Controlled Financial Identity Verification System.
Serves the API backend and static frontend files.
"""

import os
import sys

# Add the backend directory to path so imports work
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, send_from_directory
from flask_cors import CORS

from models import init_db
from routes.identity import identity_bp
from routes.credentials import credentials_bp
from routes.consent import consent_bp
from routes.anomaly import anomaly_bp

app = Flask(__name__, static_folder=None)
CORS(app)

# Register API blueprints
app.register_blueprint(identity_bp)
app.register_blueprint(credentials_bp)
app.register_blueprint(consent_bp)
app.register_blueprint(anomaly_bp)

# Serve frontend static files
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "service": "TrustVault", "version": "1.0.0"}


# Initialize database on startup
with app.app_context():
    init_db()

if __name__ == "__main__":
    print("\n[TrustVault] Financial Identity Verification System")
    print("   Backend running on http://localhost:5000")
    print("   Frontend served from:", FRONTEND_DIR)
    print()
    app.run(debug=True, port=5000)
