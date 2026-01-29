from flask import Blueprint, jsonify
from flask_login import current_user
from sqlalchemy import func

from ..models import DetalleVenta, Producto, Venta, db
from ..services.auth_service import get_current_role, has_permission
from ..services.product_storage_service import build_producto_foto_url

economia_bp = Blueprint("economia", __name__)


def _require_microempresa():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    role = get_current_role(current_user)
    if role == "microempresa":
        return None
    if role == "empleado" and has_permission(current_user, "economia"):
        return None
    return jsonify({"error": "No autorizado"}), 403


@economia_bp.get("/api/microempresa/economia")
def list_economia():
    error = _require_microempresa()
    if error:
        return error

    tenant_id = getattr(current_user, "tenant_id", None)
    if tenant_id is None:
        return jsonify({"error": "Microempresa invalida"}), 400

    ventas = (
        db.session.query(
            DetalleVenta.id_producto.label("id_producto"),
            func.coalesce(func.sum(DetalleVenta.cantidad), 0).label("vendido"),
            func.coalesce(func.sum(DetalleVenta.cantidad * DetalleVenta.precio_unitario), 0).label("ingresos"),
        )
        .join(Venta, Venta.id_venta == DetalleVenta.id_venta)
        .filter(Venta.tenant_id == tenant_id)
        .filter(Venta.estado.in_(["pagado", "empaquetado", "entregado"]))
        .group_by(DetalleVenta.id_producto)
        .all()
    )

    ventas_map = {
        row.id_producto: {
            "vendido": float(row.vendido or 0),
            "ingresos": float(row.ingresos or 0),
        }
        for row in ventas
    }

    productos = Producto.query.filter_by(tenant_id=tenant_id).order_by(Producto.id_producto.desc()).all()
    payload = []
    for producto in productos:
        agg = ventas_map.get(producto.id_producto, {"vendido": 0.0, "ingresos": 0.0})
        vendido = float(agg["vendido"] or 0)
        ingresos = float(agg["ingresos"] or 0)
        stock_actual = int(producto.stock or 0)
        precio_compra = float(producto.precio_compra or 0)
        costo_ventas = vendido * precio_compra
        costo_inventario = stock_actual * precio_compra
        saldo = ingresos - costo_ventas

        foto_url = None
        if producto.fotos:
            principal = next((f for f in producto.fotos if f.es_principal), producto.fotos[0])
            foto_url = build_producto_foto_url(principal.url)

        payload.append(
            {
                "id_producto": producto.id_producto,
                "nombre": producto.nombre,
                "stock": stock_actual,
                "precio_compra": precio_compra,
                "precio_unitario": float(producto.precio_unitario or 0),
                "foto_url": foto_url,
                "vendido": vendido,
                "ingresos": ingresos,
                "costo_invertido": costo_ventas,
                "costo_inventario": costo_inventario,
                "saldo": saldo,
            }
        )

    return jsonify({"items": payload})
