from datetime import datetime

from .base import db


class Compra(db.Model):
    __tablename__ = "compra"

    id_compra = db.Column(db.BigInteger, primary_key=True)
    tenant_id = db.Column(
        db.BigInteger, db.ForeignKey("microempresa.tenant_id"), nullable=False, index=True
    )
    proveedor_id = db.Column(
        db.BigInteger, db.ForeignKey("proveedor.id_proveedor"), nullable=True, index=True
    )
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    estado = db.Column(db.String(20), nullable=False, default="registrada")

    detalles = db.relationship(
        "DetalleCompra",
        back_populates="compra",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    proveedor = db.relationship("Proveedor")

    def to_dict(self, include_relations: bool = True):
        data = {
            "id_compra": self.id_compra,
            "tenant_id": self.tenant_id,
            "proveedor_id": self.proveedor_id,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "total": float(self.total or 0),
            "estado": self.estado,
        }
        if include_relations:
            data["detalles"] = [d.to_dict() for d in self.detalles]
            if self.proveedor:
                data["proveedor"] = self.proveedor.to_dict()
        return data
