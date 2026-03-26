"""
Modelos de la base de datos
"""
from .base import db

from .superadmin import SuperAdmin
from .vendedor import Vendedor
from .cliente import Cliente
from .categoria import Categoria
from .talla import Talla
from .producto import Producto
from .producto_talla import ProductoTalla
from .producto_imagen import ProductoImagen
from .proveedor import Proveedor
from .compra import Compra, DetalleCompra
from .venta import Venta, DetalleVenta
from .pago import Pago
from .envio import Envio
from .auditoria import Auditoria

__all__ = [
    "db",
    "SuperAdmin",
    "Vendedor",
    "Cliente",
    "Categoria",
    "Talla",
    "Producto",
    "ProductoTalla",
    "ProductoImagen",
    "Proveedor",
    "Compra",
    "DetalleCompra",
    "Venta",
    "DetalleVenta",
    "Pago",
    "Envio",
    "Auditoria",
]
