from extensions import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    kyc_records = db.relationship("KYC", backref="user", lazy=True)

    def to_dict(self):
        return {"id": self.id, "email": self.email}


class KYC(db.Model):
    __tablename__ = "kyc"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    dob = db.Column(db.String(20), nullable=False)
    id_number = db.Column(db.String(100), nullable=False)
    hash_id = db.Column(db.String(64), nullable=False, unique=True)
    verified = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "dob": self.dob,
            "hash_id": self.hash_id,
            "verified": self.verified,
        }
