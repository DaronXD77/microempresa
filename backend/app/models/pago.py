"""
Modelo Pago - Pagos de ventas
"""
from datetime import datetime
from .base import db


class Pago(db.Model):
    """Pago de una venta (solo QR por ahora)"""
    __tablename__ = "pago"

    id_pago = db.Column(db.BigInteger, primary_key=True)
    id_venta = db.Column(db.BigInteger, db.ForeignKey("venta.id_venta"), nullable=False, unique=True)
    monto = db.Column(db.Numeric(10, 2), nullable=False)
    metodo_pago = db.Column(db.String(20), nullable=False, default="qr")
    referencia = db.Column(db.String(100), nullable=True)
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_pago": self.id_pago,
            "id_venta": self.id_venta,
            "monto": float(self.monto or 0),
            "metodo_pago": self.metodo_pago,
            "referencia": self.referencia,
            "fecha": self.fecha.isoformat() if self.fecha else None,
        }
