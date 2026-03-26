"""
Modelo Venta - Ventas de productos
"""
from datetime import datetime
from .base import db


class Venta(db.Model):
    """Venta de productos"""
    __tablename__ = "venta"

    id_venta = db.Column(db.BigInteger, primary_key=True)
    id_vendedor = db.Column(db.BigInteger, db.ForeignKey("vendedor.id_vendedor"), nullable=True)
    id_cliente = db.Column(db.BigInteger, db.ForeignKey("cliente.id_cliente"), nullable=True)
    tipo_venta = db.Column(db.String(20), nullable=False, default="fisica")
    fecha = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    hora = db.Column(db.Time, nullable=False, default=datetime.utcnow().time)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    tipo_comprador = db.Column(db.String(20), nullable=False, default="normal")
    comprador_nombre = db.Column(db.String(150), nullable=True)
    comprador_ci = db.Column(db.String(20), nullable=True)
    comprador_ru_codigo = db.Column(db.String(50), nullable=True)
    estado = db.Column(db.String(20), nullable=False, default="completado")
    observaciones = db.Column(db.Text, nullable=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    vendedor = db.relationship("Vendedor", backref="ventas")
    cliente = db.relationship("Cliente", backref="ventas")
    detalles = db.relationship("DetalleVenta", backref="venta", cascade="all, delete-orphan")
    pago = db.relationship("Pago", backref="venta", uselist=False)
    envio = db.relationship("Envio", backref="venta", uselist=False)

    def to_dict(self, include_relations=True):
        data = {
            "id_venta": self.id_venta,
            "id_vendedor": self.id_vendedor,
            "id_cliente": self.id_cliente,
            "tipo_venta": self.tipo_venta,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "hora": str(self.hora) if self.hora else None,
            "subtotal": float(self.subtotal or 0),
            "total": float(self.total or 0),
            "tipo_comprador": self.tipo_comprador,
            "comprador_nombre": self.comprador_nombre,
            "comprador_ci": self.comprador_ci,
            "comprador_ru_codigo": self.comprador_ru_codigo,
            "estado": self.estado,
            "observaciones": self.observaciones,
        }
        if include_relations:
            data["vendedor"] = self.vendedor.to_dict() if self.vendedor else None
            data["cliente"] = self.cliente.to_dict() if self.cliente else None
            data["detalles"] = [d.to_dict() for d in self.detalles]
            data["pago"] = self.pago.to_dict() if self.pago else None
            data["envio"] = self.envio.to_dict() if self.envio else None
        return data


class DetalleVenta(db.Model):
    """Detalle de una venta"""
    __tablename__ = "detalle_venta"

    id_detalle_venta = db.Column(db.BigInteger, primary_key=True)
    id_venta = db.Column(db.BigInteger, db.ForeignKey("venta.id_venta"), nullable=False)
    id_producto_talla = db.Column(db.BigInteger, db.ForeignKey("producto_talla.id_producto_talla"), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    descuento = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)

    producto_talla = db.relationship("ProductoTalla", backref="detalles_venta")

    def to_dict(self):
        return {
            "id_detalle_venta": self.id_detalle_venta,
            "id_venta": self.id_venta,
            "id_producto_talla": self.id_producto_talla,
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario or 0),
            "descuento": float(self.descuento or 0),
            "subtotal": float(self.subtotal or 0),
            "producto_talla": self.producto_talla.to_dict() if self.producto_talla else None,
        }
