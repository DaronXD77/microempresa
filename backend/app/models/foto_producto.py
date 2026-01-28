from datetime import datetime

from .base import db


class FotoProducto(db.Model):
    __tablename__ = "foto_producto"

    id_foto = db.Column(db.BigInteger, primary_key=True)
    id_producto = db.Column(
        db.BigInteger,
        db.ForeignKey("producto.id_producto", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url = db.Column(db.Text, nullable=False)
    orden = db.Column(db.Integer, nullable=False, default=0)
    es_principal = db.Column(db.Boolean, nullable=False, default=False)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    producto = db.relationship("Producto", back_populates="fotos")

    def to_dict(self):
        return {
            "id_foto": self.id_foto,
            "id_producto": self.id_producto,
            "url": self.url,
            "orden": self.orden,
            "es_principal": self.es_principal,
        }
