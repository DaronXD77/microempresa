from .base import db


class DetalleVenta(db.Model):
    __tablename__ = "detalle_venta"

    id_detalle_venta = db.Column(db.BigInteger, primary_key=True)
    id_venta = db.Column(db.BigInteger, db.ForeignKey("venta.id_venta"), nullable=False, index=True)
    id_producto = db.Column(db.BigInteger, db.ForeignKey("producto.id_producto"), nullable=False)

    cantidad = db.Column(db.Integer, nullable=False, default=1)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    venta = db.relationship("Venta", back_populates="detalles")
    producto = db.relationship("Producto")

    def to_dict(self):
        return {
            "id_detalle_venta": self.id_detalle_venta,
            "id_venta": self.id_venta,
            "id_producto": self.id_producto,
            "nombre": self.producto.nombre if self.producto else None,
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario or 0),
            "subtotal": float(self.subtotal or 0),
        }
