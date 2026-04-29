"""
TrustVault — Anomaly Detection Routes.
"""

from flask import Blueprint, request, jsonify
import json

from models import get_db, log_anomaly_event
from services.anomaly_engine import AnomalyEngine

anomaly_bp = Blueprint("anomaly", __name__)
engine = AnomalyEngine()


@anomaly_bp.route("/api/anomaly/check", methods=["POST"])
def check_anomaly():
    """Run anomaly detection on a verification session and persist alerts."""
    data = request.get_json() or {}

    session_data = {
        "session_id": data.get("session_id"),
        "device": data.get("device", {}),
        "behavior": data.get("behavior", {}),
        "biometrics": data.get("biometrics", {}),
        "velocity": data.get("velocity", {}),
        "documents": data.get("documents", {}),
        "geolocation": data.get("geolocation", {}),
    }

    result = engine.analyze_session(session_data)

    # Persist each alert as a real anomaly_event row
    for alert in result.get("alerts", []):
        log_anomaly_event(
            session_id=session_data.get("session_id"),
            event_type=alert["type"],
            severity="high" if alert["risk_score"] >= 0.65 else "medium",
            description=alert["description"],
            details={"flags": alert["flags"], "risk_score": alert["risk_score"]},
        )

    # Update session's anomaly score
    if session_data.get("session_id"):
        db = get_db()
        db.execute(
            "UPDATE verification_sessions SET anomaly_score = ?, risk_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (result["aggregate_risk_score"], result["severity"], session_data["session_id"]),
        )
        db.commit()

    return jsonify(result)


@anomaly_bp.route("/api/anomaly/dashboard", methods=["GET"])
def dashboard_metrics():
    """Real-time anomaly dashboard metrics from actual DB data."""
    db = get_db()
    metrics = engine.get_dashboard_metrics(db)
    return jsonify(metrics)


@anomaly_bp.route("/api/anomaly/alerts", methods=["GET"])
def recent_alerts():
    """Fetch recent anomaly alerts from the database."""
    db = get_db()
    rows = db.execute(
        """SELECT * FROM anomaly_events
           ORDER BY detected_at DESC
           LIMIT 20"""
    ).fetchall()

    alerts = []
    for row in rows:
        alerts.append({
            "id": row["id"],
            "event_type": row["event_type"],
            "severity": row["severity"],
            "description": row["description"],
            "details": json.loads(row["details"]) if row["details"] else {},
            "detected_at": row["detected_at"],
        })

    return jsonify({"alerts": alerts, "total": len(alerts)})
