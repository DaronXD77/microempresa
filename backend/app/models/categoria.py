from datetime import datetime

from .base import db


class Categoria(db.Model):
    __tablename__ = "categoria"

    id_categoria = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False, unique=True)
    estado = db.Column(db.String(20), nullable=False, default="activo")
    id_su = db.Column(db.BigInteger, db.ForeignKey("admin_su.id_su"), nullable=False)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    productos = db.relationship(
        "Producto",
        secondary="producto_categoria",
        back_populates="categorias",
    )

    def to_dict(self):
        return {
            "id_categoria": self.id_categoria,
            "nombre": self.nombre,
            "estado": self.estado,
            "id_su": self.id_su,
        }
