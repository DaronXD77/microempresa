"""
Modelo SuperAdmin - Administrador del sistema
"""
from flask_login import UserMixin
from .base import db


class SuperAdmin(UserMixin, db.Model):
    """Administrador principal del sistema"""
    __tablename__ = "superadmin"

    id_superadmin = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default="activo")
    creado_en = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())

    def get_id(self):
        return f"superadmin:{self.id_superadmin}"

    def to_dict(self):
        return {
            "id_superadmin": self.id_superadmin,
            "nombre": self.nombre,
            "email": self.email,
            "estado": self.estado,
        }
