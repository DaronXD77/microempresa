from datetime import datetime

from .base import db


class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id_audit = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(db.BigInteger, nullable=True, index=True)
    role = db.Column(db.String(40), nullable=False)
    nombre = db.Column(db.String(200))
    email = db.Column(db.String(150))
    ip = db.Column(db.String(80))
    user_agent = db.Column(db.String(300))
    login_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    logout_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id_audit": self.id_audit,
            "user_id": self.user_id,
            "role": self.role,
            "nombre": self.nombre,
            "email": self.email,
            "ip": self.ip,
            "user_agent": self.user_agent,
            "login_at": self.login_at.isoformat() if self.login_at else None,
            "logout_at": self.logout_at.isoformat() if self.logout_at else None,
        }
