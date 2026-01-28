from datetime import datetime
from .base import db


class Entrega(db.Model):
    __tablename__ = "entrega"

    id_entrega = db.Column(db.BigInteger, primary_key=True)
    id_venta = db.Column(db.BigInteger, db.ForeignKey("venta.id_venta"), nullable=False, index=True)

    tipo_entrega = db.Column(db.String(20), nullable=False, default="virtual")
    direccion_entrega = db.Column(db.Text)
    fecha_entrega = db.Column(db.DateTime)
    estado = db.Column(db.String(20), nullable=False, default="pendiente")
    seleccion_opcion_id = db.Column(db.BigInteger, db.ForeignKey("entrega_opcion.id_opcion"), nullable=True)
    seleccion_at = db.Column(db.DateTime)

    venta = db.relationship("Venta", back_populates="entregas")
    opciones = db.relationship(
        "EntregaOpcion",
        back_populates="entrega",
        cascade="all, delete-orphan",
        lazy="selectin",
        foreign_keys="EntregaOpcion.id_entrega",
    )

    def to_dict(self):
        return {
            "id_entrega": self.id_entrega,
            "id_venta": self.id_venta,
            "tipo_entrega": self.tipo_entrega,
            "direccion_entrega": self.direccion_entrega,
            "fecha_entrega": self.fecha_entrega.isoformat() if self.fecha_entrega else None,
            "estado": self.estado,
            "seleccion_opcion_id": self.seleccion_opcion_id,
            "seleccion_at": self.seleccion_at.isoformat() if self.seleccion_at else None,
            "opciones": [o.to_dict() for o in self.opciones],
        }
