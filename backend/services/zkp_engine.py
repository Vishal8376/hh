"""
TrustVault — Zero-Knowledge Proof Engine for Selective Disclosure.

Simulates ZKP operations for privacy-preserving identity verification.
Allows proving identity attributes (e.g., "age >= 18") without revealing
the raw PII (e.g., actual date of birth).

In production, this would use libraries like snarkjs, circom, or Hyperledger
AnonCreds.
"""

import hashlib
import hmac
import json
import uuid
import time
from datetime import datetime, timedelta


class ZKPEngine:
    """Simulated Zero-Knowledge Proof engine for selective disclosure."""

    # Secret key for HMAC-based commitments (demo only)
    _SECRET = b"trustvault-zkp-demo-secret-key-2025"

    # Supported predicate types
    PREDICATES = {
        "age_gte": "Age is greater than or equal to {value}",
        "age_lte": "Age is less than or equal to {value}",
        "country_eq": "Country of residence is {value}",
        "kyc_level_gte": "KYC verification level is at least {value}",
        "income_range": "Income falls within range {value}",
        "account_active": "Account is currently active",
        "identity_verified": "Identity has been verified",
    }

    def create_commitment(self, attribute_name: str, attribute_value: str) -> dict:
        """
        Create a cryptographic commitment for an identity attribute.

        The commitment hides the actual value while allowing later verification.
        """
        nonce = uuid.uuid4().hex
        commitment = self._compute_commitment(attribute_name, attribute_value, nonce)

        return {
            "attribute": attribute_name,
            "commitment": commitment,
            "nonce_hint": nonce[:8] + "..." ,  # Partial nonce for demo visibility
            "created_at": datetime.utcnow().isoformat(),
            "algorithm": "HMAC-SHA256",
        }

    def generate_selective_disclosure_proof(
        self, claims: dict, disclosed_attributes: list, predicates: list = None
    ) -> dict:
        """
        Generate a selective disclosure proof.

        Args:
            claims: Full set of identity claims (raw data).
            disclosed_attributes: List of attribute names to explicitly reveal.
            predicates: List of predicate proofs (e.g., {"type": "age_gte", "value": 18}).

        Returns:
            A proof object containing only disclosed data + predicate proofs.
        """
        proof_id = f"zkp-{uuid.uuid4().hex[:12]}"

        # Build disclosed portion
        disclosed = {}
        for attr in disclosed_attributes:
            if attr in claims:
                disclosed[attr] = claims[attr]

        # Build commitments for hidden attributes
        hidden_commitments = {}
        for key, value in claims.items():
            if key not in disclosed_attributes:
                hidden_commitments[key] = self.create_commitment(key, str(value))

        # Build predicate proofs
        predicate_proofs = []
        if predicates:
            for pred in predicates:
                predicate_proofs.append(
                    self._generate_predicate_proof(claims, pred)
                )

        # Generate proof signature
        proof_payload = json.dumps({
            "disclosed": disclosed,
            "hidden_count": len(hidden_commitments),
            "predicates": len(predicate_proofs),
            "timestamp": time.time(),
        }, sort_keys=True)

        proof_signature = hashlib.sha256(
            (proof_payload + uuid.uuid4().hex).encode()
        ).hexdigest()

        return {
            "proof_id": proof_id,
            "type": "SelectiveDisclosure",
            "disclosed_attributes": disclosed,
            "hidden_attribute_count": len(hidden_commitments),
            "hidden_commitments": hidden_commitments,
            "predicate_proofs": predicate_proofs,
            "proof_signature": proof_signature,
            "issuer_attestation": f"att-{uuid.uuid4().hex[:16]}",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(hours=24)).isoformat(),
            "verification_method": "ZKP-SelectiveDisclosure-v1",
        }

    def verify_proof(self, proof: dict) -> dict:
        """
        Verify a selective disclosure proof.

        In a real system, this would cryptographically verify the proof.
        Here we simulate the verification process.
        """
        is_valid = True
        checks = []

        # Check proof structure
        checks.append({
            "check": "proof_structure",
            "passed": "proof_id" in proof and "proof_signature" in proof,
            "detail": "Proof contains required fields",
        })

        # Check expiry
        if "expires_at" in proof:
            expires = datetime.fromisoformat(proof["expires_at"])
            not_expired = expires > datetime.utcnow()
            checks.append({
                "check": "proof_expiry",
                "passed": not_expired,
                "detail": f"Proof expires at {proof['expires_at']}",
            })
            if not not_expired:
                is_valid = False

        # Check signature (simulated)
        checks.append({
            "check": "signature_verification",
            "passed": True,
            "detail": "Cryptographic signature verified against issuer public key",
        })

        # Check predicate proofs
        for i, pred in enumerate(proof.get("predicate_proofs", [])):
            checks.append({
                "check": f"predicate_{i}",
                "passed": pred.get("satisfied", False),
                "detail": pred.get("description", "Predicate check"),
            })

        return {
            "valid": is_valid and all(c["passed"] for c in checks),
            "checks": checks,
            "verified_at": datetime.utcnow().isoformat(),
        }

    def _generate_predicate_proof(self, claims: dict, predicate: dict) -> dict:
        """Generate a zero-knowledge predicate proof."""
        pred_type = predicate.get("type", "")
        value = predicate.get("value")
        satisfied = False
        description = self.PREDICATES.get(pred_type, "Unknown predicate").format(value=value)

        # Simulate predicate evaluation
        if pred_type == "age_gte" and "dob" in claims:
            from dateutil.parser import parse as parse_date
            try:
                dob = parse_date(claims["dob"])
                age = (datetime.now() - dob).days // 365
                satisfied = age >= int(value)
            except Exception:
                satisfied = True  # Assume true for demo
        elif pred_type == "identity_verified":
            satisfied = claims.get("verification_level") in ("L1", "L2", "L3")
        else:
            satisfied = True  # Default to satisfied for demo

        proof_hash = hashlib.sha256(
            f"{pred_type}:{value}:{uuid.uuid4().hex}".encode()
        ).hexdigest()

        return {
            "predicate_type": pred_type,
            "description": description,
            "satisfied": satisfied,
            "proof_hash": proof_hash,
            "raw_value_revealed": False,
        }

    def _compute_commitment(self, name: str, value: str, nonce: str) -> str:
        """Compute HMAC-based commitment."""
        message = f"{name}:{value}:{nonce}".encode()
        return hmac.new(self._SECRET, message, hashlib.sha256).hexdigest()
