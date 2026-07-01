from datetime import datetime
from .base import db


class Pago(db.Model):
    __tablename__ = "pago"

    id_pago = db.Column(db.BigInteger, primary_key=True)
    id_venta = db.Column(db.BigInteger, db.ForeignKey("venta.id_venta"), nullable=False, index=True)

    monto = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    metodo = db.Column(db.String(20), nullable=False, default="efectivo")
    referencia = db.Column(db.Text)
    estado = db.Column(db.String(20), nullable=False, default="pendiente")
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    venta = db.relationship("Venta", back_populates="pagos")

    def to_dict(self):
        return {
            "id_pago": self.id_pago,
            "id_venta": self.id_venta,
            "monto": float(self.monto or 0),
            "metodo": self.metodo,
            "referencia": self.referencia,
            "estado": self.estado,
            "fecha": self.fecha.isoformat() if self.fecha else None,
        }
