from datetime import datetime
from .base import db


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_token"

    id_token = db.Column(db.BigInteger, primary_key=True)
    email = db.Column(db.String(150), nullable=False, index=True)
    role = db.Column(db.String(30), nullable=False, index=True)  # super_usuario/microempresa/cliente
    token_hash = db.Column(db.String(64), nullable=False, index=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
