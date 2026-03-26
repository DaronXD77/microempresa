"""
Modelo Envio - Envios de ventas virtuales
"""
from datetime import datetime
from .base import db


class Envio(db.Model):
    """Envio de una venta virtual"""
    __tablename__ = "envio"

    id_envio = db.Column(db.BigInteger, primary_key=True)
    id_venta = db.Column(db.BigInteger, db.ForeignKey("venta.id_venta"), nullable=False, unique=True)
    direccion = db.Column(db.Text, nullable=False)
    referencia = db.Column(db.Text, nullable=True)
    nombre_receptor = db.Column(db.String(150), nullable=False)
    telefono = db.Column(db.String(20), nullable=False)
    estado_envio = db.Column(db.String(20), nullable=False, default="pendiente")
    fecha_envio = db.Column(db.DateTime, nullable=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_envio": self.id_envio,
            "id_venta": self.id_venta,
            "direccion": self.direccion,
            "referencia": self.referencia,
            "nombre_receptor": self.nombre_receptor,
            "telefono": self.telefono,
            "estado_envio": self.estado_envio,
            "fecha_envio": self.fecha_envio.isoformat() if self.fecha_envio else None,
        }
