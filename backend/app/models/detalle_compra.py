from .base import db


class DetalleCompra(db.Model):
    __tablename__ = "detalle_compra"

    id_detalle_compra = db.Column(db.BigInteger, primary_key=True)
    id_compra = db.Column(db.BigInteger, db.ForeignKey("compra.id_compra"), nullable=False, index=True)
    id_producto = db.Column(db.BigInteger, db.ForeignKey("producto.id_producto"), nullable=False)

    cantidad = db.Column(db.Integer, nullable=False, default=1)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    lote = db.Column(db.String(60), nullable=True)

    compra = db.relationship("Compra", back_populates="detalles")
    producto = db.relationship("Producto")

    def to_dict(self):
        return {
            "id_detalle_compra": self.id_detalle_compra,
            "id_compra": self.id_compra,
            "id_producto": self.id_producto,
            "nombre": self.producto.nombre if self.producto else None,
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario or 0),
            "subtotal": float(self.subtotal or 0),
            "lote": self.lote,
        }
