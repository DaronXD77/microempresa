import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from flask import current_app

from ..models import AdminSu, Cliente, Microempresa, db
from ..models.password_reset import PasswordResetToken
from .auth_service import hash_password

ROLE_MODELS = {
    "super_usuario": AdminSu,
    "microempresa": Microempresa,
    "cliente": Cliente,
}


def _hash_token(raw_token: str) -> str:
    secret = (current_app.config.get("SECRET_KEY") or "dev-secret").encode("utf-8")
    return hmac.new(secret, raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


def roles_for_email(email: str) -> list[str]:
    roles = []
    for role, model in ROLE_MODELS.items():
        if model.query.filter_by(email=email).first():
            roles.append(role)
    return roles


def create_reset_token(email: str, role: str) -> tuple[str, PasswordResetToken]:
    raw_token = secrets.token_urlsafe(24)
    token_hash = _hash_token(raw_token)

    minutes = int(current_app.config.get("RESET_TOKEN_EXPIRE_MINUTES", 15))
    expires_at = datetime.utcnow() + timedelta(minutes=minutes)

    record = PasswordResetToken(
        email=email,
        role=role,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.session.add(record)
    db.session.commit()
    return raw_token, record


def validate_token(email: str, role: str, raw_token: str) -> PasswordResetToken | None:
    now = datetime.utcnow()
    token_hash = _hash_token(raw_token)

    record = (
        PasswordResetToken.query
        .filter_by(email=email, role=role, token_hash=token_hash)
        .filter(PasswordResetToken.used_at.is_(None))
        .filter(PasswordResetToken.expires_at > now)
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )
    return record


def reset_password(email: str, role: str, raw_token: str, new_password: str) -> tuple[bool, str, int]:
    model = ROLE_MODELS.get(role)
    if not model:
        return False, "Rol inválido", 400

    user = model.query.filter_by(email=email).first()
    if not user:
        return False, "No existe ninguna cuenta con ese correo", 404

    record = validate_token(email, role, raw_token)
    if not record:
        return False, "Token inválido o expirado", 400

    user.password = hash_password(new_password)
    record.used_at = datetime.utcnow()
    db.session.commit()
    return True, "Contraseña actualizada correctamente", 200
