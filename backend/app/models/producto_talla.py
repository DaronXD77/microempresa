"""
Modelo ProductoTalla - Stock por talla de cada producto
"""
from datetime import datetime
from .base import db


class ProductoTalla(db.Model):
    """Stock de un producto por talla especifica"""
    __tablename__ = "producto_talla"

    id_producto_talla = db.Column(db.BigInteger, primary_key=True)
    id_producto = db.Column(db.BigInteger, db.ForeignKey("producto.id_producto"), nullable=False)
    id_talla = db.Column(db.BigInteger, db.ForeignKey("talla.id_talla"), nullable=True)
    stock = db.Column(db.Integer, nullable=False, default=0)
    stock_minimo = db.Column(db.Integer, nullable=False, default=0)
    estado = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    talla = db.relationship("Talla", backref="producto_tallas")

    def to_dict(self):
        return {
            "id_producto_talla": self.id_producto_talla,
            "id_producto": self.id_producto,
            "id_talla": self.id_talla,
            "stock": self.stock,
            "stock_minimo": self.stock_minimo,
            "estado": self.estado,
            "talla": self.talla.to_dict() if self.talla else None,
        }
