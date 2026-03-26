"""
Modelo Producto - Productos de la tienda
"""
from datetime import datetime
from .base import db


class Producto(db.Model):
    """Producto de la tienda"""
    __tablename__ = "producto"

    id_producto = db.Column(db.BigInteger, primary_key=True)
    id_categoria = db.Column(db.BigInteger, db.ForeignKey("categoria.id_categoria"), nullable=False)
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    precio_compra = db.Column(db.Numeric(10, 2), nullable=False)
    precio_venta = db.Column(db.Numeric(10, 2), nullable=False)
    es_textil = db.Column(db.Boolean, nullable=False, default=False)
    estado = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    categoria = db.relationship("Categoria", backref="productos")
    tallas = db.relationship("ProductoTalla", backref="producto", cascade="all, delete-orphan")
    imagenes = db.relationship("ProductoImagen", backref="producto", cascade="all, delete-orphan")

    def to_dict(self, include_relations=True):
        data = {
            "id_producto": self.id_producto,
            "id_categoria": self.id_categoria,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "precio_compra": float(self.precio_compra or 0),
            "precio_venta": float(self.precio_venta or 0),
            "es_textil": self.es_textil,
            "estado": self.estado,
        }
        if include_relations:
            data["categoria"] = self.categoria.to_dict() if self.categoria else None
            data["tallas"] = [t.to_dict() for t in self.tallas]
            data["imagenes"] = [i.to_dict() for i in self.imagenes]
        return data
