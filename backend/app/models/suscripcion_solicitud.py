import hashlib
import secrets
from datetime import datetime, timedelta

from flask import current_app
from .base import db


class SuscripcionSolicitud(db.Model):
    __tablename__ = "suscripcion_solicitud"

    id_solicitud = db.Column(db.BigInteger, primary_key=True)

    tenant_id = db.Column(db.BigInteger, db.ForeignKey("microempresa.tenant_id"), nullable=False, index=True)
    id_plan = db.Column(db.BigInteger, db.ForeignKey("plan.id_plan"), nullable=True)

    estado = db.Column(db.String(30), nullable=False, default="borrador")
    # borrador -> plan_seleccionado -> en_espera -> aprobado/rechazado

    onboarding_token_hash = db.Column(db.Text, nullable=False)
    onboarding_expires_at = db.Column(db.DateTime, nullable=False)

    qr_text = db.Column(db.Text, nullable=True)
    comprobante_path = db.Column(db.Text, nullable=True)

    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    revisado_en = db.Column(db.DateTime, nullable=True)
    revisado_por = db.Column(db.BigInteger, db.ForeignKey("admin_su.id_su"), nullable=True)
    observacion = db.Column(db.Text, nullable=True)

    @staticmethod
    def generate_onboarding_token():
        raw = secrets.token_urlsafe(24)
        token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        minutes = int(current_app.config.get("ONBOARDING_TOKEN_EXPIRE_MINUTES", 120))
        expires = datetime.utcnow() + timedelta(minutes=minutes)
        return raw, token_hash, expires

    def check_token(self, raw_token: str) -> bool:
        if not raw_token:
            return False
        if self.onboarding_expires_at and datetime.utcnow() > self.onboarding_expires_at:
            return False
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        return token_hash == self.onboarding_token_hash

    def to_dict(self):
        return {
            "id_solicitud": self.id_solicitud,
            "tenant_id": self.tenant_id,
            "id_plan": self.id_plan,
            "estado": self.estado,
            "qr_text": self.qr_text,
            "creado_en": self.creado_en.isoformat() if self.creado_en else None,
            "revisado_en": self.revisado_en.isoformat() if self.revisado_en else None,
            "revisado_por": self.revisado_por,
            "observacion": self.observacion,
            "tiene_comprobante": bool(self.comprobante_path),
        }
