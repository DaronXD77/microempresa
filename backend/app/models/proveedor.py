"""
Modelo Proveedor - Proveedores de productos
"""
from datetime import datetime
from .base import db


class Proveedor(db.Model):
    """Proveedor de la tienda"""
    __tablename__ = "proveedor"

    id_proveedor = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    nit = db.Column(db.String(20), nullable=True, unique=True)
    telefono = db.Column(db.String(20), nullable=True)
    email = db.Column(db.String(150), nullable=True)
    direccion = db.Column(db.Text, nullable=True)
    estado = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_proveedor": self.id_proveedor,
            "nombre": self.nombre,
            "nit": self.nit,
            "telefono": self.telefono,
            "email": self.email,
            "direccion": self.direccion,
            "estado": self.estado,
        }
