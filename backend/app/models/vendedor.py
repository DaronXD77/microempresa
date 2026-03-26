"""
Modelo Vendedor - Personal de tienda que registra ventas fisicas
"""
from flask_login import UserMixin
from .base import db


class Vendedor(UserMixin, db.Model):
    """Vendedor de la tienda"""
    __tablename__ = "vendedor"

    id_vendedor = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    ci = db.Column(db.String(20), nullable=False, unique=True)
    telefono = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(150), nullable=True, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default="activo")
    creado_en = db.Column(db.DateTime, nullable=False, default=db.func.current_timestamp())

    def get_id(self):
        return f"vendedor:{self.id_vendedor}"

    def to_dict(self):
        return {
            "id_vendedor": self.id_vendedor,
            "nombre": self.nombre,
            "ci": self.ci,
            "telefono": self.telefono,
            "email": self.email,
            "estado": self.estado,
        }
