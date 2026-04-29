import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "kyc-secret-key-change-in-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-secret-key-change-in-production")
    SQLALCHEMY_DATABASE_URI = "sqlite:///kyc.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
