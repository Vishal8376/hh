"""
TrustVault — Credential Management Routes.
"""

from flask import Blueprint, request, jsonify
import uuid
import json
from datetime import datetime

from models import get_db
from services.credential_service import CredentialService
from services.zkp_engine import ZKPEngine

credentials_bp = Blueprint("credentials", __name__)
cred_service = CredentialService()
zkp = ZKPEngine()


@credentials_bp.route("/api/credentials/issue", methods=["POST"])
def issue_credential():
    """Issue a new verifiable credential after successful verification."""
    data = request.get_json() or {}

    user_id = data.get("user_id", "user-demo-001")
    credential_type = data.get("credential_type", "video_kyc")
    claims = data.get("claims", {
        "full_name": "Arjun Mehta",
        "dob": "1995-06-15",
        "verification_level": "L3",
        "verified_at": datetime.utcnow().isoformat(),
    })
    session_id = data.get("session_id")

    credential = cred_service.issue_credential(
        user_id, credential_type, claims, session_id
    )

    # Store in database
    db = get_db()
    db.execute(
        """INSERT INTO credentials 
           (id, user_id, credential_type, issuer, claims, proof_hash, signature, expires_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            credential["id"], user_id,
            credential["metadata"]["display_name"],
            credential["issuer"]["name"],
            json.dumps(credential["credentialSubject"]["claims"]),
            credential["proof"]["proofHash"],
            credential["proof"]["signature"],
            credential["expirationDate"],
            "active",
        ),
    )
    db.commit()

    return jsonify({"credential": credential})


@credentials_bp.route("/api/credentials/wallet", methods=["GET"])
def get_wallet():
    """Retrieve user's credential wallet."""
    user_id = request.args.get("user_id", "user-demo-001")

    db = get_db()
    rows = db.execute(
        "SELECT * FROM credentials WHERE user_id = ? AND status = 'active' ORDER BY issued_at DESC",
        (user_id,),
    ).fetchall()

    credentials = []
    for row in rows:
        cred_type_key = row["credential_type"].lower().replace(" ", "_")
        type_info = cred_service.CREDENTIAL_TYPES.get(cred_type_key, {})

        credentials.append({
            "id": row["id"],
            "type": row["credential_type"],
            "issuer": row["issuer"],
            "issued_at": row["issued_at"],
            "expires_at": row["expires_at"],
            "status": row["status"],
            "claims": json.loads(row["claims"]) if row["claims"] else {},
            "proof_hash": row["proof_hash"],
            "icon": type_info.get("icon", "shield"),
            "color": type_info.get("color", "#424242"),
            "verification_level": type_info.get("verification_level", "L1"),
        })

    return jsonify({
        "user_id": user_id,
        "credentials": credentials,
        "total": len(credentials),
    })


@credentials_bp.route("/api/credentials/share", methods=["POST"])
def share_credential():
    """Generate a shareable credential proof using ZKP selective disclosure."""
    data = request.get_json() or {}

    credential_id = data.get("credential_id")
    disclosed_attributes = data.get("disclosed_attributes", [])
    predicates = data.get("predicates", [])

    # Fetch credential claims
    db = get_db()
    row = db.execute(
        "SELECT * FROM credentials WHERE id = ?", (credential_id,)
    ).fetchone()

    if not row:
        return jsonify({"error": "Credential not found"}), 404

    claims = json.loads(row["claims"]) if row["claims"] else {}

    # Generate ZKP selective disclosure proof
    proof = zkp.generate_selective_disclosure_proof(
        claims, disclosed_attributes, predicates
    )

    return jsonify({
        "credential_id": credential_id,
        "proof": proof,
        "share_url": f"https://trustvault.example/verify/{proof['proof_id']}",
    })


@credentials_bp.route("/api/credentials/verify", methods=["POST"])
def verify_credential():
    """Verify a credential's integrity."""
    data = request.get_json() or {}
    credential = data.get("credential", {})

    result = cred_service.verify_credential(credential)
    return jsonify(result)


@credentials_bp.route("/api/credentials/revoke", methods=["POST"])
def revoke_credential():
    """Revoke a credential."""
    data = request.get_json() or {}
    credential_id = data.get("credential_id")

    db = get_db()
    db.execute(
        "UPDATE credentials SET status = 'revoked' WHERE id = ?",
        (credential_id,),
    )
    db.commit()

    return jsonify({
        "credential_id": credential_id,
        "status": "revoked",
        "revoked_at": datetime.utcnow().isoformat(),
    })


@credentials_bp.route("/api/credentials/types", methods=["GET"])
def credential_types():
    """List all supported credential types."""
    return jsonify({"types": cred_service.get_credential_types()})
