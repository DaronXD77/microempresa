"""
Modelo Talla - Tallas para productos textiles
"""
from datetime import datetime
from .base import db


class Talla(db.Model):
    """Tallas disponibles para productos textiles"""
    __tablename__ = "talla"

    id_talla = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(20), nullable=False, unique=True)
    tipo = db.Column(db.String(50), nullable=True)
    estado = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_talla": self.id_talla,
            "nombre": self.nombre,
            "tipo": self.tipo,
            "estado": self.estado,
        }
