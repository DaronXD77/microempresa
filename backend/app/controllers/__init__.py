"""
Controladores del sistema
"""
from .auth import auth_bp
from .auth_controller import auth_bp
from .producto_controller import producto_bp
from .venta_controller import venta_bp
from .compra_controller import compra_bp
from .dashboard_controller import dashboard_bp
from .vendedor_controller import vendedor_bp

__all__ = [
    "auth_bp",
    "producto_bp",
    "venta_bp",
    "compra_bp",
    "dashboard_bp",
    "vendedor_bp",
]
