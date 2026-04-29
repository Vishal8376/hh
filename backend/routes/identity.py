"""
TrustVault — Identity Verification Routes.
"""

from flask import Blueprint, request, jsonify
import uuid
import json
from datetime import datetime

from models import get_db, ensure_user, log_anomaly_event
from services.deepfake_detector import DeepfakeDetector

identity_bp = Blueprint("identity", __name__)
detector = DeepfakeDetector()


@identity_bp.route("/api/verify/document", methods=["POST"])
def verify_document():
    """Upload and verify an identity document (Aadhaar, PAN, etc.)."""
    data = request.get_json() or {}

    session_id = f"session-{uuid.uuid4().hex[:12]}"
    doc_type = data.get("document_type", "aadhaar")
    user_id = data.get("user_id", "user-demo-001")
    ensure_user(user_id, name=data.get("name", "User"))

    # Simulated document verification
    verification_result = {
        "document_type": doc_type,
        "ocr_extracted": {
            "name": data.get("name", "Unknown User"),
            "document_number_masked": data.get("document_number", "XXXX-XXXX-0000"),
            "dob": data.get("dob", "1990-01-01"),
        },
        "document_authentic": True,
        "tampering_detected": False,
        "quality_score": 0.92,
    }

    # Store session
    db = get_db()
    db.execute(
        """INSERT INTO verification_sessions 
           (id, user_id, status, document_type, document_verified, metadata)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, user_id, "document_verified", doc_type, 1,
         json.dumps(verification_result)),
    )
    db.commit()

    return jsonify({
        "session_id": session_id,
        "status": "document_verified",
        "result": verification_result,
    })


@identity_bp.route("/api/verify/liveness", methods=["POST"])
def verify_liveness():
    """Submit liveness check results from the webcam flow."""
    data = request.get_json() or {}

    session_id = data.get("session_id", f"session-{uuid.uuid4().hex[:12]}")
    session_data = {
        "blink_detected": data.get("blink_detected", False),
        "blink_confidence": data.get("blink_confidence", 0),
        "head_turn_detected": data.get("head_turn_detected", False),
        "head_turn_magnitude": data.get("head_turn_magnitude", 0),
        "smile_detected": data.get("smile_detected", False),
        "smile_confidence": data.get("smile_confidence", 0),
        "frame_count": data.get("frame_count", 0),
        "landmark_variance": data.get("landmark_variance", 0),
    }

    result = detector.analyze_liveness(session_data)

    # Update session
    db = get_db()
    db.execute(
        """UPDATE verification_sessions 
           SET liveness_score = ?, status = ?, updated_at = ?
           WHERE id = ?""",
        (result["liveness_score"],
         "liveness_passed" if result["is_live"] else "liveness_failed",
         datetime.utcnow().isoformat(), session_id),
    )
    db.commit()

    return jsonify({
        "session_id": session_id,
        "result": result,
    })


@identity_bp.route("/api/verify/deepfake-score", methods=["POST"])
def deepfake_score():
    """Analyze biometric capture for deepfake indicators."""
    data = request.get_json() or {}

    frame_data = {
        "landmarks": data.get("landmarks", []),
        "expressions": data.get("expressions", {}),
        "detection_score": data.get("detection_score", 0),
        "face_box": data.get("face_box", {}),
        "device_name": data.get("device_name", "Built-in Camera"),
        "is_virtual_camera": data.get("is_virtual_camera", False),
        "history": data.get("history", []),
    }

    result = detector.analyze_frame(frame_data)
    session_id = data.get("session_id")

    if session_id:
        db = get_db()
        db.execute(
            """UPDATE verification_sessions 
               SET deepfake_score = ?, risk_level = ?, status = ?, updated_at = ?
               WHERE id = ?""",
            (result["deepfake_score"], result["risk_level"],
             "deepfake_analyzed", datetime.utcnow().isoformat(), session_id),
        )
        db.commit()

        # Log anomaly event if deepfake / injection flagged
        if result["injection_detected"]:
            log_anomaly_event(session_id, "injection_attack", "critical",
                              "Camera feed injection detected — " + frame_data["device_name"],
                              {"device": frame_data["device_name"], "blocked": True})
        if result["deepfake_score"] > 0.5:
            log_anomaly_event(session_id, "deepfake_attempt", "high",
                              f"Elevated deepfake score {result['deepfake_score']:.2f}",
                              {"score": result["deepfake_score"], "risk": result["risk_level"]})

    return jsonify({
        "session_id": session_id,
        "result": result,
    })


@identity_bp.route("/api/verify/status/<session_id>", methods=["GET"])
def verification_status(session_id):
    """Get verification session status."""
    db = get_db()
    row = db.execute(
        "SELECT * FROM verification_sessions WHERE id = ?", (session_id,)
    ).fetchone()

    if not row:
        return jsonify({"error": "Session not found"}), 404

    return jsonify({
        "session_id": row["id"],
        "user_id": row["user_id"],
        "status": row["status"],
        "document_type": row["document_type"],
        "document_verified": bool(row["document_verified"]),
        "liveness_score": row["liveness_score"],
        "deepfake_score": row["deepfake_score"],
        "anomaly_score": row["anomaly_score"],
        "risk_level": row["risk_level"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    })
