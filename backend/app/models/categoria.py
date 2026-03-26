"""
Modelo Categoria - Categorias de productos
"""
from datetime import datetime
from .base import db


class Categoria(db.Model):
    """Categoria de productos"""
    __tablename__ = "categoria"

    id_categoria = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.Text, nullable=True)
    estado = db.Column(db.Boolean, nullable=False, default=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_categoria": self.id_categoria,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "estado": self.estado,
        }
