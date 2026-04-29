"""
TrustVault — Anomaly Detection Engine.

Analyses real session signals and pulls dashboard metrics from the
actual database instead of generating random numbers.
"""

import json
import uuid
import math
from datetime import datetime, timedelta


class AnomalyEngine:
    """Live anomaly detection for financial identity verification."""

    WEIGHTS = {
        "device_fingerprint": 0.15,
        "behavioral_pattern": 0.20,
        "biometric_mismatch": 0.25,
        "velocity_check": 0.15,
        "document_consistency": 0.15,
        "geolocation": 0.10,
    }

    SEVERITY_THRESHOLDS = {
        "critical": 0.85,
        "high": 0.65,
        "medium": 0.40,
        "low": 0.20,
    }

    # ---- session analysis (deterministic on real input) ----------------------

    def analyze_session(self, session_data: dict) -> dict:
        factors = {}
        alerts = []

        device_score = self._analyze_device(session_data.get("device", {}))
        factors["device_fingerprint"] = device_score
        if device_score["risk"] > 0.5:
            alerts.append(self._alert("device_anomaly", device_score["risk"],
                                      "Suspicious device characteristics", device_score["flags"]))

        behavior_score = self._analyze_behavior(session_data.get("behavior", {}))
        factors["behavioral_pattern"] = behavior_score
        if behavior_score["risk"] > 0.5:
            alerts.append(self._alert("behavioral_anomaly", behavior_score["risk"],
                                      "Unusual interaction patterns", behavior_score["flags"]))

        biometric_score = self._analyze_biometrics(session_data.get("biometrics", {}))
        factors["biometric_mismatch"] = biometric_score
        if biometric_score["risk"] > 0.5:
            alerts.append(self._alert("biometric_mismatch", biometric_score["risk"],
                                      "Biometric data inconsistencies", biometric_score["flags"]))

        velocity_score = self._analyze_velocity(session_data.get("velocity", {}))
        factors["velocity_check"] = velocity_score
        if velocity_score["risk"] > 0.5:
            alerts.append(self._alert("velocity_anomaly", velocity_score["risk"],
                                      "Abnormal verification velocity", velocity_score["flags"]))

        doc_score = self._analyze_documents(session_data.get("documents", {}))
        factors["document_consistency"] = doc_score
        if doc_score["risk"] > 0.5:
            alerts.append(self._alert("document_inconsistency", doc_score["risk"],
                                      "Document data inconsistencies", doc_score["flags"]))

        geo_score = self._analyze_geo(session_data.get("geolocation", {}))
        factors["geolocation"] = geo_score
        if geo_score["risk"] > 0.5:
            alerts.append(self._alert("geo_anomaly", geo_score["risk"],
                                      "Geographic location anomaly", geo_score["flags"]))

        aggregate = sum(factors[k]["risk"] * self.WEIGHTS[k] for k in self.WEIGHTS if k in factors)
        severity = self._severity(aggregate)

        return {
            "session_id": session_data.get("session_id", f"session-{uuid.uuid4().hex[:8]}"),
            "aggregate_risk_score": round(aggregate, 3),
            "severity": severity,
            "factors": factors,
            "alerts": alerts,
            "recommendation": self._recommendation(severity),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    # ---- dashboard metrics from real DB ------------------------------------

    def get_dashboard_metrics(self, db) -> dict:
        """Pull metrics from the actual database."""
        now = datetime.utcnow()
        day_ago = (now - timedelta(hours=24)).isoformat()

        # Session stats
        total = db.execute(
            "SELECT COUNT(*) FROM verification_sessions WHERE created_at >= ?", (day_ago,)
        ).fetchone()[0]
        flagged = db.execute(
            "SELECT COUNT(*) FROM verification_sessions WHERE risk_level IN ('high','critical') AND created_at >= ?", (day_ago,)
        ).fetchone()[0]
        blocked = db.execute(
            "SELECT COUNT(*) FROM verification_sessions WHERE risk_level = 'critical' AND created_at >= ?", (day_ago,)
        ).fetchone()[0]
        passed = db.execute(
            "SELECT COUNT(*) FROM verification_sessions WHERE risk_level IN ('low','medium') AND created_at >= ?", (day_ago,)
        ).fetchone()[0]

        pass_rate = round(passed / max(total, 1), 3)

        # Average risk
        avg_row = db.execute(
            "SELECT AVG(deepfake_score) FROM verification_sessions WHERE created_at >= ?", (day_ago,)
        ).fetchone()
        avg_risk = round(avg_row[0] or 0, 3)

        # Hourly buckets — real data
        hourly_data = []
        for i in range(24):
            h_start = (now - timedelta(hours=23 - i)).replace(minute=0, second=0, microsecond=0)
            h_end = h_start + timedelta(hours=1)
            row = db.execute(
                """SELECT
                     COUNT(*) as total,
                     SUM(CASE WHEN risk_level IN ('high','critical') THEN 1 ELSE 0 END) as flagged,
                     SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as blocked,
                     SUM(CASE WHEN risk_level IN ('low','medium') THEN 1 ELSE 0 END) as passed
                   FROM verification_sessions
                   WHERE created_at >= ? AND created_at < ?""",
                (h_start.isoformat(), h_end.isoformat()),
            ).fetchone()
            hourly_data.append({
                "hour": h_start.strftime("%H:00"),
                "total_verifications": row[0] or 0,
                "flagged": row[1] or 0,
                "blocked": row[2] or 0,
                "passed": row[3] or 0,
            })

        # Threat distribution from anomaly_events
        threat_types = {}
        rows = db.execute(
            "SELECT event_type, COUNT(*) as cnt FROM anomaly_events WHERE detected_at >= ? GROUP BY event_type",
            (day_ago,),
        ).fetchall()
        for r in rows:
            threat_types[r[0]] = r[1]

        return {
            "summary": {
                "total_verifications_24h": total,
                "total_flagged_24h": flagged,
                "total_blocked_24h": blocked,
                "pass_rate": pass_rate,
                "avg_risk_score": avg_risk,
            },
            "hourly_data": hourly_data,
            "threat_distribution": threat_types,
            "active_alerts_count": flagged,
            "generated_at": now.isoformat(),
        }

    # ---- factor analysers (deterministic) -----------------------------------

    def _analyze_device(self, d):
        risk = 0.0
        flags = []
        if d.get("is_virtual_camera"):
            risk += 0.5
            flags.append("Virtual / injected camera source detected")
        if d.get("is_emulator"):
            risk += 0.4
            flags.append("Emulated device environment")
        if d.get("is_rooted"):
            risk += 0.3
            flags.append("Rooted / jailbroken device")
        if d.get("vpn_detected"):
            risk += 0.15
            flags.append("VPN connection")
        # Low screen resolution can signal headless browser
        w = d.get("screen_width", 1920)
        if w and w < 400:
            risk += 0.2
            flags.append(f"Unusually small screen ({w}px)")
        return {"risk": min(risk, 1.0), "flags": flags}

    def _analyze_behavior(self, b):
        risk = 0.0
        flags = []
        dur = b.get("session_duration_sec", 120)
        if dur < 10:
            risk += 0.4
            flags.append(f"Completed in {dur}s — possible automation")
        elif dur < 30:
            risk += 0.15
            flags.append(f"Fast completion ({dur}s)")
        clicks = b.get("click_count", 10)
        if clicks < 2:
            risk += 0.25
            flags.append("Almost no interaction events")
        if b.get("no_mouse_movement"):
            risk += 0.2
            flags.append("No mouse / touch movement detected")
        return {"risk": min(risk, 1.0), "flags": flags}

    def _analyze_biometrics(self, bio):
        risk = 0.0
        flags = []
        delta = bio.get("age_document_vs_face_delta", 0)
        if abs(delta) > 10:
            risk += 0.45
            flags.append(f"Age mismatch: document vs face = {delta} years")
        match = bio.get("face_match_score", 1.0)
        if match < 0.7:
            risk += 0.35
            flags.append(f"Low face-to-document match ({match:.2f})")
        deepfake = bio.get("deepfake_score", 0)
        if deepfake > 0.5:
            risk += 0.3
            flags.append(f"Elevated deepfake score ({deepfake:.2f})")
        return {"risk": min(risk, 1.0), "flags": flags}

    def _analyze_velocity(self, v):
        risk = 0.0
        flags = []
        att = v.get("attempts_1h", 1)
        if att > 3:
            risk += 0.35
            flags.append(f"{att} verification attempts in the last hour")
        inst = v.get("unique_institutions_24h", 1)
        if inst > 4:
            risk += 0.3
            flags.append(f"Onboarding at {inst} institutions in 24h")
        return {"risk": min(risk, 1.0), "flags": flags}

    def _analyze_documents(self, d):
        risk = 0.0
        flags = []
        if d.get("name_mismatch"):
            risk += 0.4
            flags.append("Name mismatch across documents")
        if d.get("address_mismatch"):
            risk += 0.2
            flags.append("Address inconsistency")
        if d.get("expired"):
            risk += 0.15
            flags.append("Document appears expired")
        return {"risk": min(risk, 1.0), "flags": flags}

    def _analyze_geo(self, g):
        risk = 0.0
        flags = []
        if g.get("impossible_travel"):
            risk += 0.55
            flags.append("Impossible travel — distant locations within short window")
        if g.get("proxy_detected"):
            risk += 0.2
            flags.append("Proxy / relay connection detected")
        return {"risk": min(risk, 1.0), "flags": flags}

    # ---- helpers ------------------------------------------------------------

    def _severity(self, s):
        for lvl, th in self.SEVERITY_THRESHOLDS.items():
            if s >= th:
                return lvl
        return "minimal"

    def _recommendation(self, sev):
        return {
            "critical": "BLOCK immediately. Escalate to fraud investigation.",
            "high": "FLAG for manual review. Require additional verification.",
            "medium": "MONITOR closely. Apply enhanced due diligence.",
        }.get(sev, "PROCEED with standard verification flow.")

    def _alert(self, atype, risk, desc, flags):
        return {
            "id": f"alert-{uuid.uuid4().hex[:8]}",
            "type": atype,
            "risk_score": round(risk, 3),
            "description": desc,
            "flags": flags,
            "timestamp": datetime.utcnow().isoformat(),
        }
