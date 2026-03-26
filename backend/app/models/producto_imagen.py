"""
Modelo ProductoImagen - Imagenes de productos
"""
from datetime import datetime
from .base import db


class ProductoImagen(db.Model):
    """Imagen de un producto"""
    __tablename__ = "producto_imagen"

    id_producto_imagen = db.Column(db.BigInteger, primary_key=True)
    id_producto = db.Column(db.BigInteger, db.ForeignKey("producto.id_producto"), nullable=False)
    url = db.Column(db.Text, nullable=False)
    es_principal = db.Column(db.Boolean, nullable=False, default=False)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_producto_imagen": self.id_producto_imagen,
            "id_producto": self.id_producto,
            "url": self.url,
            "es_principal": self.es_principal,
        }
