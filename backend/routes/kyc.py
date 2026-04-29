import hashlib
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import KYC

kyc_bp = Blueprint("kyc", __name__)


@kyc_bp.route("/verify", methods=["POST"])
@jwt_required()
def verify():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    name = data.get("name", "").strip()
    dob = data.get("dob", "").strip()
    id_number = data.get("idNumber", "").strip()

    if not name or not dob or not id_number:
        return jsonify({"error": "Name, date of birth, and ID number are required"}), 400

    # Generate SHA-256 hash
    raw = f"{name.lower()}|{dob}|{id_number.upper()}"
    hash_id = hashlib.sha256(raw.encode()).hexdigest()

    # Check if already verified
    existing = KYC.query.filter_by(user_id=user_id).first()
    if existing:
        return jsonify({"verified": True, "hashId": existing.hash_id, "name": existing.name, "dob": existing.dob}), 200

    # Check if this exact hash exists (another user with same data)
    if KYC.query.filter_by(hash_id=hash_id).first():
        return jsonify({"error": "Identity already registered with another account"}), 409

    kyc = KYC(
        user_id=user_id,
        name=name,
        dob=dob,
        id_number=id_number,
        hash_id=hash_id,
        verified=True,
    )
    db.session.add(kyc)
    db.session.commit()

    return jsonify({"verified": True, "hashId": hash_id, "name": name, "dob": dob}), 201


@kyc_bp.route("/status", methods=["GET"])
@jwt_required()
def status():
    user_id = int(get_jwt_identity())
    kyc = KYC.query.filter_by(user_id=user_id).first()
    if not kyc:
        return jsonify({"verified": False}), 200
    return jsonify({"verified": True, "hashId": kyc.hash_id, "name": kyc.name, "dob": kyc.dob}), 200
