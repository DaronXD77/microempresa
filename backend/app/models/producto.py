from .base import db
from .producto_categoria import producto_categoria


class Producto(db.Model):
    __tablename__ = "producto"

    id_producto = db.Column(db.BigInteger, primary_key=True)
    tenant_id = db.Column(
        db.BigInteger, db.ForeignKey("microempresa.tenant_id"), nullable=False, index=True
    )
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    stock_inicial = db.Column(db.Integer, nullable=True)
    stock_minimo = db.Column(db.Integer, nullable=False, default=0)
    proveedor_id = db.Column(
        db.BigInteger, db.ForeignKey("proveedor.id_proveedor"), nullable=True, index=True
    )
    precio_compra = db.Column(db.Numeric(10, 2), nullable=True)
    estado = db.Column(db.String(20), nullable=False, default="activo")

    categorias = db.relationship(
        "Categoria",
        secondary=producto_categoria,
        back_populates="productos",
        lazy="selectin",
        overlaps="productos,categorias",
    )

    fotos = db.relationship(
        "FotoProducto",
        back_populates="producto",
        cascade="all, delete-orphan",
        order_by="FotoProducto.orden.asc()",
        lazy="selectin",
    )

    def to_dict(self, include_relations: bool = True):
        data = {
            "id_producto": self.id_producto,
            "tenant_id": self.tenant_id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "precio_unitario": float(self.precio_unitario or 0),
            "stock": self.stock,
            "stock_inicial": self.stock_inicial if self.stock_inicial is not None else self.stock,
            "stock_minimo": self.stock_minimo,
            "proveedor_id": self.proveedor_id,
            "precio_compra": float(self.precio_compra or 0) if self.precio_compra is not None else None,
            "estado": self.estado,
        }
        if include_relations:
            data["categorias"] = [c.to_dict() for c in self.categorias]  # type: ignore[misc]
            data["fotos"] = [f.to_dict() for f in self.fotos]  # type: ignore[misc]
        return data
