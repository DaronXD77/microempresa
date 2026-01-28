from datetime import datetime
import uuid
from .base import db


class Venta(db.Model):
    __tablename__ = "venta"

    id_venta = db.Column(db.BigInteger, primary_key=True)
    tenant_id = db.Column(
        db.BigInteger, db.ForeignKey("microempresa.tenant_id"), nullable=False, index=True
    )
    id_cliente = db.Column(db.BigInteger, db.ForeignKey("cliente.id_cliente"), nullable=True, index=True)

    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    estado = db.Column(db.String(30), nullable=False, default="pendiente")

    # Campo extra para seguimiento de pedidos sin login (permitido)
    public_token = db.Column(db.String(64), nullable=False, default=lambda: uuid.uuid4().hex)

    cliente = db.relationship("Cliente")

    detalles = db.relationship(
        "DetalleVenta",
        back_populates="venta",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    pagos = db.relationship(
        "Pago",
        back_populates="venta",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    entregas = db.relationship(
        "Entrega",
        back_populates="venta",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self, include_relations: bool = True):
        data = {
            "id_venta": self.id_venta,
            "tenant_id": self.tenant_id,
            "id_cliente": self.id_cliente,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "total": float(self.total or 0),
            "estado": self.estado,
            "public_token": self.public_token,
        }
        if include_relations:
            data["detalles"] = [d.to_dict() for d in self.detalles]  # type: ignore[misc]
            data["pagos"] = [p.to_dict() for p in self.pagos]  # type: ignore[misc]
            data["entregas"] = [e.to_dict() for e in self.entregas]  # type: ignore[misc]
        return data
