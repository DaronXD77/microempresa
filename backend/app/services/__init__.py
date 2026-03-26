"""
Servicios del sistema
"""
from .auth_service import (
    hash_password,
    verify_password,
    load_user,
    get_user_by_email,
    get_user_for_role,
    get_users_by_email,
    serialize_user,
    is_active,
    validate_email,
    validate_ci,
    validate_phone,
    sanitize_string,
)
from .auditoria_service import registrar_auditoria, get_auditoria
from .qr_service import generar_qr_pago, generar_qr_base64, guardar_qr_local
from .inventario_service import (
    actualizar_stock,
    verificar_stock_suficiente,
    get_stock_total_producto,
    productos_con_stock_bajo,
)

__all__ = [
    "hash_password",
    "verify_password",
    "load_user",
    "get_user_by_email",
    "get_user_for_role",
    "get_users_by_email",
    "serialize_user",
    "is_active",
    "validate_email",
    "validate_ci",
    "validate_phone",
    "sanitize_string",
    "registrar_auditoria",
    "get_auditoria",
    "generar_qr_pago",
    "generar_qr_base64",
    "guardar_qr_local",
    "actualizar_stock",
    "verificar_stock_suficiente",
    "get_stock_total_producto",
    "productos_con_stock_bajo",
]
