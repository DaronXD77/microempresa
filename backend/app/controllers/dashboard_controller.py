"""
Controlador de dashboard y reportes
"""
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import func
from ...models.base import db
from ...models import Venta, Compra, ProductoTalla, Auditoria
from ...services import serialize_user, productos_con_stock_bajo

dashboard_bp = Blueprint("dashboard", __name__)


def require_auth():
    """Verifica que haya usuario autenticado"""
    return current_user.is_authenticated


def require_superadmin():
    """Verifica que sea superadmin"""
    if not current_user.is_authenticated:
        return False
    user_data, role = serialize_user(current_user)
    return role == "superadmin"


@dashboard_bp.get("/api/dashboard")
def get_dashboard():
    """Obtiene datos del dashboard"""
    if not require_auth():
        return jsonify({"error": "No autorizado"}), 401
    
    user_data, role = serialize_user(current_user)
    
    hoy = datetime.now().date()
    inicio_mes = hoy.replace(day=1)
    
    ventas_dia = db.session.query(func.sum(Venta.total)).filter(
        Venta.fecha == hoy,
        Venta.estado == "completado"
    ).scalar() or 0
    
    ventas_mes = db.session.query(func.sum(Venta.total)).filter(
        Venta.fecha >= inicio_mes,
        Venta.fecha <= hoy,
        Venta.estado == "completado"
    ).scalar() or 0
    
    ventas_count_dia = Venta.query.filter(
        Venta.fecha == hoy,
        Venta.estado == "completado"
    ).count()
    
    ventas_count_mes = Venta.query.filter(
        Venta.fecha >= inicio_mes,
        Venta.fecha <= hoy,
        Venta.estado == "completado"
    ).count()
    
    if role == "superadmin":
        compras_mes = db.session.query(func.sum(Compra.total)).filter(
            Compra.fecha >= inicio_mes,
            Compra.fecha <= hoy,
            Compra.estado == "completado"
        ).scalar() or 0
        
        alertas_stock = productos_con_stock_bajo()
        
        return jsonify({
            "ventas_dia": float(ventas_dia),
            "ventas_mes": float(ventas_mes),
            "compras_mes": float(compras_mes),
            "ventas_count_dia": ventas_count_dia,
            "ventas_count_mes": ventas_count_mes,
            "alertas_stock": alertas_stock,
        }), 200
    
    return jsonify({
        "ventas_dia": float(ventas_dia),
        "ventas_mes": float(ventas_mes),
        "ventas_count_dia": ventas_count_dia,
        "ventas_count_mes": ventas_count_mes,
    }), 200


@dashboard_bp.get("/api/reportes/ventas")
def reporte_ventas():
    """Reporte de ventas por rango de fechas"""
    if not require_auth():
        return jsonify({"error": "No autorizado"}), 401
    
    fecha_inicio = request.args.get("fecha_inicio")
    fecha_fin = request.args.get("fecha_fin")
    
    if not fecha_inicio or not fecha_fin:
        return jsonify({"error": "fecha_inicio y fecha_fin son requeridos"}), 400
    
    try:
        inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d").date()
        fin = datetime.strptime(fecha_fin, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Formato de fecha invalido (YYYY-MM-DD)"}), 400
    
    query = Venta.query.filter(
        Venta.fecha >= inicio,
        Venta.fecha <= fin,
        Venta.estado == "completado"
    )
    
    user_data, role = serialize_user(current_user)
    if role == "vendedor":
        query = query.filter_by(id_vendedor=user_data.get("id_vendedor"))
    
    ventas = query.order_by(Venta.fecha.desc()).all()
    
    total_ventas = sum(float(v.total) for v in ventas)
    cantidad_ventas = len(ventas)
    
    por_dia = db.session.query(
        Venta.fecha,
        func.sum(Venta.total).label("total"),
        func.count(Venta.id_venta).label("cantidad")
    ).filter(
        Venta.fecha >= inicio,
        Venta.fecha <= fin,
        Venta.estado == "completado"
    ).group_by(Venta.fecha).order_by(Venta.fecha).all()
    
    return jsonify({
        "ventas": [v.to_dict(include_relations=False) for v in ventas],
        "resumen": {
            "total_ventas": total_ventas,
            "cantidad_ventas": cantidad_ventas,
            "fecha_inicio": str(inicio),
            "fecha_fin": str(fin),
        },
        "por_dia": [
            {"fecha": str(d.fecha), "total": float(d.total), "cantidad": d.cantidad}
            for d in por_dia
        ]
    }), 200


@dashboard_bp.get("/api/auditoria")
def list_auditoria():
    """Lista registros de auditoria (solo superadmin)"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    from ...services import get_auditoria
    
    page = request.args.get("page", 1, type=int)
    tipo_usuario = request.args.get("tipo_usuario")
    accion = request.args.get("accion")
    fecha_inicio = request.args.get("fecha_inicio")
    fecha_fin = request.args.get("fecha_fin")
    
    filtros = {}
    if tipo_usuario:
        filtros["tipo_usuario"] = tipo_usuario
    if accion:
        filtros["accion"] = accion
    if fecha_inicio:
        try:
            filtros["fecha_inicio"] = datetime.strptime(fecha_inicio, "%Y-%m-%d")
        except ValueError:
            pass
    if fecha_fin:
        try:
            filtros["fecha_fin"] = datetime.strptime(fecha_fin, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            pass
    
    result = get_auditoria(filtros=filtros, page=page)
    
    return jsonify(result), 200
