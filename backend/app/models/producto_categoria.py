from .base import db


producto_categoria = db.Table(
    "producto_categoria",
    db.Column(
        "id_producto",
        db.BigInteger,
        db.ForeignKey("producto.id_producto", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "id_categoria",
        db.BigInteger,
        db.ForeignKey("categoria.id_categoria", ondelete="CASCADE"),
        primary_key=True,
    ),
)
