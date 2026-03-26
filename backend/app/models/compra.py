"""
Modelo Compra - Compras de insumos a proveedores
"""
from datetime import datetime
from .base import db


class Compra(db.Model):
    """Compra de productos a proveedor"""
    __tablename__ = "compra"

    id_compra = db.Column(db.BigInteger, primary_key=True)
    id_proveedor = db.Column(db.BigInteger, db.ForeignKey("proveedor.id_proveedor"), nullable=False)
    id_superadmin = db.Column(db.BigInteger, db.ForeignKey("superadmin.id_superadmin"), nullable=False)
    numero_factura = db.Column(db.String(50), nullable=True)
    fecha = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    estado = db.Column(db.String(20), nullable=False, default="completado")
    observaciones = db.Column(db.Text, nullable=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    proveedor = db.relationship("Proveedor", backref="compras")
    superadmin = db.relationship("SuperAdmin", backref="compras")
    detalles = db.relationship("DetalleCompra", backref="compra", cascade="all, delete-orphan")

    def to_dict(self, include_relations=True):
        data = {
            "id_compra": self.id_compra,
            "id_proveedor": self.id_proveedor,
            "id_superadmin": self.id_superadmin,
            "numero_factura": self.numero_factura,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "total": float(self.total or 0),
            "estado": self.estado,
            "observaciones": self.observaciones,
        }
        if include_relations:
            data["proveedor"] = self.proveedor.to_dict() if self.proveedor else None
            data["superadmin"] = self.superadmin.to_dict() if self.superadmin else None
            data["detalles"] = [d.to_dict() for d in self.detalles]
        return data


class DetalleCompra(db.Model):
    """Detalle de una compra"""
    __tablename__ = "detalle_compra"

    id_detalle_compra = db.Column(db.BigInteger, primary_key=True)
    id_compra = db.Column(db.BigInteger, db.ForeignKey("compra.id_compra"), nullable=False)
    id_producto_talla = db.Column(db.BigInteger, db.ForeignKey("producto_talla.id_producto_talla"), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)

    producto_talla = db.relationship("ProductoTalla", backref="detalles_compra")

    def to_dict(self):
        return {
            "id_detalle_compra": self.id_detalle_compra,
            "id_compra": self.id_compra,
            "id_producto_talla": self.id_producto_talla,
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario or 0),
            "subtotal": float(self.subtotal or 0),
            "producto_talla": self.producto_talla.to_dict() if self.producto_talla else None,
        }
