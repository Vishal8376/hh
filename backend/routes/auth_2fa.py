"""
TrustVault — 2FA Authentication Routes.
"""

from flask import Blueprint, request, jsonify
import uuid
import json
from datetime import datetime
from models import get_db, log_anomaly_event

auth_2fa_bp = Blueprint("auth_2fa", __name__)

# In-memory session store for active 2FA flows
auth_sessions = {}

@auth_2fa_bp.route("/api/auth/init", methods=["POST"])
def init_auth():
    """Initialize a 2FA session with randomized challenges."""
    data = request.get_json() or {}
    user_id = data.get("user_id", "user-demo-001")
    
    session_id = f"auth-{uuid.uuid4().hex[:12]}"
    
    # Randomize face challenges
    challenges = ["blink", "turn", "smile"]
    import random
    random.shuffle(challenges)
    
    auth_sessions[session_id] = {
        "user_id": user_id,
        "challenges": challenges,
        "completed_challenges": [],
        "primary_passed": False,
        "secondary_method": None,
        "secondary_passed": False,
        "attempts": 0,
        "created_at": datetime.utcnow().isoformat()
    }
    
    return jsonify({
        "session_id": session_id,
        "challenges": challenges
    })

@auth_2fa_bp.route("/api/auth/verify-face", methods=["POST"])
def verify_face():
    """Verify face liveness and match (Primary Factor)."""
    data = request.get_json() or {}
    session_id = data.get("session_id")
    
    if session_id not in auth_sessions:
        return jsonify({"error": "Invalid session"}), 404
        
    session = auth_sessions[session_id]
    session["attempts"] += 1
    
    if session["attempts"] > 3:
        return jsonify({"status": "failed", "error": "Max attempts exceeded"}), 403

    liveness_score = data.get("liveness_score", 0)
    # Simple rule: score > 0.7 is pass
    if liveness_score >= 0.7:
        session["primary_passed"] = True
        
        # Log success
        db = get_db()
        db.execute(
            "INSERT INTO auth_logs (id, user_id, session_id, method, result) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), session["user_id"], session_id, "face_liveness", "success")
        )
        db.commit()
        
        return jsonify({"status": "passed", "next_factor": "secondary"})
    else:
        return jsonify({"status": "failed", "error": "Liveness check failed"})

@auth_2fa_bp.route("/api/auth/verify-secondary", methods=["POST"])
def verify_secondary():
    """Verify gesture or voice (Secondary Factor).

    Also supports standalone gesture-auth sessions that may not have
    been initialised via /api/auth/init (e.g. the gesture_auth.html page).
    """
    data = request.get_json() or {}
    session_id = data.get("session_id", f"standalone-{uuid.uuid4().hex[:8]}")
    method = data.get("method", "gesture")
    success = data.get("success", False)
    details = data.get("details", [])

    # If the session exists in the 2FA flow, enforce primary-first rule
    if session_id in auth_sessions:
        session = auth_sessions[session_id]
        if not session["primary_passed"]:
            return jsonify({"error": "Primary factor not passed"}), 403
        session["secondary_method"] = method
        if success:
            session["secondary_passed"] = True

    # Log every attempt (works for both 2FA and standalone)
    db = get_db()
    db.execute(
        "INSERT INTO auth_logs (id, user_id, session_id, method, result) VALUES (?, ?, ?, ?, ?)",
        (str(uuid.uuid4()),
         data.get("user_id", "user-demo-001"),
         session_id,
         method,
         "success" if success else "failed")
    )
    db.commit()

    return jsonify({
        "status": "authenticated" if success else "failed",
        "session_id": session_id,
        "method": method,
        "challenges_passed": sum(1 for d in details if d.get("passed")) if details else 0,
        "challenges_total": len(details) if details else 0,
    })

@auth_2fa_bp.route("/api/auth/status/<session_id>", methods=["GET"])
def auth_status(session_id):
    """Check authentication status."""
    if session_id not in auth_sessions:
        return jsonify({"error": "Session not found"}), 404
        
    session = auth_sessions[session_id]
    return jsonify({
        "authenticated": session["primary_passed"] and session["secondary_passed"],
        "primary": session["primary_passed"],
        "secondary": session["secondary_passed"]
    })
