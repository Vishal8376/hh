"""
TrustVault — In-memory data models (SQLite-backed for demo).
Stores users, verification sessions, credentials, consent logs, and anomaly events.
"""

import sqlite3
import json
import os
import threading

DB_PATH = os.path.join(os.path.dirname(__file__), "trustvault.db")
_local = threading.local()


def get_db():
    """Get thread-local database connection."""
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(DB_PATH)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
    return _local.conn


def init_db():
    """Initialize database tables."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS verification_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            status TEXT DEFAULT 'pending',
            document_type TEXT,
            document_verified INTEGER DEFAULT 0,
            liveness_score REAL DEFAULT 0.0,
            deepfake_score REAL DEFAULT 0.0,
            anomaly_score REAL DEFAULT 0.0,
            risk_level TEXT DEFAULT 'unknown',
            metadata TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS credentials (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            credential_type TEXT NOT NULL,
            issuer TEXT NOT NULL,
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            status TEXT DEFAULT 'active',
            claims TEXT DEFAULT '{}',
            proof_hash TEXT,
            signature TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS consent_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            institution_id TEXT NOT NULL,
            institution_name TEXT NOT NULL,
            credential_id TEXT,
            action TEXT NOT NULL,
            attributes_shared TEXT DEFAULT '[]',
            purpose TEXT,
            expires_at TIMESTAMP,
            zkp_proof TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (credential_id) REFERENCES credentials(id)
        );

        CREATE TABLE IF NOT EXISTS anomaly_events (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            event_type TEXT NOT NULL,
            severity TEXT DEFAULT 'low',
            description TEXT,
            details TEXT DEFAULT '{}',
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES verification_sessions(id)
        );
    """)
    conn.commit()


def ensure_user(user_id, name="User", email=None, phone=None):
    """Create a user row if it does not already exist. Returns user_id."""
    conn = get_db()
    row = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        conn.execute(
            "INSERT INTO users (id, name, email, phone) VALUES (?, ?, ?, ?)",
            (user_id, name, email, phone),
        )
        conn.commit()
    return user_id


def log_anomaly_event(session_id, event_type, severity, description, details=None):
    """Insert a real anomaly event into the database."""
    import uuid as _uuid
    conn = get_db()
    conn.execute(
        "INSERT INTO anomaly_events (id, session_id, event_type, severity, description, details) VALUES (?, ?, ?, ?, ?, ?)",
        (f"anomaly-{_uuid.uuid4().hex[:8]}", session_id, event_type, severity, description, json.dumps(details or {})),
    )
    conn.commit()
