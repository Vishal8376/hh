"""
TrustVault — Consent Management Routes.
"""

from flask import Blueprint, request, jsonify
import uuid
import json
from datetime import datetime, timedelta

from models import get_db
from services.zkp_engine import ZKPEngine

consent_bp = Blueprint("consent", __name__)
zkp = ZKPEngine()


@consent_bp.route("/api/consent/grant", methods=["POST"])
def grant_consent():
    """Grant consent to share credentials with an institution."""
    data = request.get_json() or {}

    user_id = data.get("user_id", "user-demo-001")
    institution_id = data.get("institution_id")
    institution_name = data.get("institution_name")
    credential_id = data.get("credential_id")
    attributes = data.get("attributes_shared", [])
    purpose = data.get("purpose", "KYC Verification")
    validity_days = data.get("validity_days", 90)

    # Fetch credential claims for ZKP proof
    db = get_db()
    cred_row = db.execute(
        "SELECT claims FROM credentials WHERE id = ?", (credential_id,)
    ).fetchone()

    claims = json.loads(cred_row["claims"]) if cred_row else {}

    # Generate ZKP proof for selective disclosure
    proof = zkp.generate_selective_disclosure_proof(
        claims, attributes, data.get("predicates", [])
    )

    consent_id = f"consent-{uuid.uuid4().hex[:12]}"
    expires_at = (datetime.utcnow() + timedelta(days=validity_days)).isoformat()

    db.execute(
        """INSERT INTO consent_logs 
           (id, user_id, institution_id, institution_name, credential_id, 
            action, attributes_shared, purpose, expires_at, zkp_proof)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            consent_id, user_id, institution_id, institution_name,
            credential_id, "grant", json.dumps(attributes), purpose,
            expires_at, json.dumps(proof),
        ),
    )
    db.commit()

    return jsonify({
        "consent_id": consent_id,
        "status": "granted",
        "institution": institution_name,
        "attributes_shared": attributes,
        "proof_id": proof["proof_id"],
        "expires_at": expires_at,
    })


@consent_bp.route("/api/consent/revoke", methods=["POST"])
def revoke_consent():
    """Revoke previously granted consent."""
    data = request.get_json() or {}
    consent_id = data.get("consent_id")
    user_id = data.get("user_id", "user-demo-001")

    db = get_db()

    # Log revocation
    db.execute(
        """INSERT INTO consent_logs 
           (id, user_id, institution_id, institution_name, credential_id, action, purpose)
           SELECT ?, user_id, institution_id, institution_name, credential_id, 'revoke', 'User revoked consent'
           FROM consent_logs WHERE id = ?""",
        (f"revoke-{uuid.uuid4().hex[:12]}", consent_id),
    )
    db.commit()

    return jsonify({
        "consent_id": consent_id,
        "status": "revoked",
        "revoked_at": datetime.utcnow().isoformat(),
    })


@consent_bp.route("/api/consent/active", methods=["GET"])
def active_consents():
    """Get all active consents for a user."""
    user_id = request.args.get("user_id", "user-demo-001")

    db = get_db()
    rows = db.execute(
        """SELECT * FROM consent_logs 
           WHERE user_id = ? AND action = 'grant'
           ORDER BY created_at DESC""",
        (user_id,),
    ).fetchall()

    consents = []
    for row in rows:
        consents.append({
            "id": row["id"],
            "institution_id": row["institution_id"],
            "institution_name": row["institution_name"],
            "credential_id": row["credential_id"],
            "attributes_shared": json.loads(row["attributes_shared"]) if row["attributes_shared"] else [],
            "purpose": row["purpose"],
            "expires_at": row["expires_at"],
            "granted_at": row["created_at"],
        })

    return jsonify({
        "user_id": user_id,
        "consents": consents,
        "total": len(consents),
    })


@consent_bp.route("/api/consent/log", methods=["GET"])
def consent_log():
    """Full audit trail of all consent actions."""
    user_id = request.args.get("user_id", "user-demo-001")

    db = get_db()
    rows = db.execute(
        """SELECT * FROM consent_logs 
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 50""",
        (user_id,),
    ).fetchall()

    logs = []
    for row in rows:
        logs.append({
            "id": row["id"],
            "action": row["action"],
            "institution_name": row["institution_name"],
            "credential_id": row["credential_id"],
            "attributes_shared": json.loads(row["attributes_shared"]) if row["attributes_shared"] else [],
            "purpose": row["purpose"],
            "timestamp": row["created_at"],
        })

    return jsonify({"logs": logs, "total": len(logs)})


# Available institutions for demo
DEMO_INSTITUTIONS = [
    {"id": "inst-sbi", "name": "State Bank of India", "type": "Bank", "logo_color": "#1a237e"},
    {"id": "inst-icici", "name": "ICICI Bank", "type": "Bank", "logo_color": "#b71c1c"},
    {"id": "inst-hdfc", "name": "HDFC Bank", "type": "Bank", "logo_color": "#004d40"},
    {"id": "inst-zerodha", "name": "Zerodha", "type": "Brokerage", "logo_color": "#e65100"},
    {"id": "inst-groww", "name": "Groww", "type": "Investment", "logo_color": "#00c853"},
    {"id": "inst-phonepe", "name": "PhonePe", "type": "UPI/Payments", "logo_color": "#5c2d91"},
    {"id": "inst-paytm", "name": "Paytm", "type": "Payments", "logo_color": "#00b0ff"},
    {"id": "inst-bajaj", "name": "Bajaj Finserv", "type": "NBFC", "logo_color": "#0d47a1"},
]


@consent_bp.route("/api/consent/institutions", methods=["GET"])
def list_institutions():
    """List available institutions for consent."""
    return jsonify({"institutions": DEMO_INSTITUTIONS})
