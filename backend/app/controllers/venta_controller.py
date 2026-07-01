"""
Controlador de ventas
"""
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_login import current_user
from ..models.base import db
from ..models import Venta, DetalleVenta, Pago, Envio, ProductoTalla, Vendedor
from ..services import (
    serialize_user, registrar_auditoria, verificar_stock_suficiente,
    actualizar_stock, generar_qr_pago, get_stock_total_producto
)

venta_bp = Blueprint("venta", __name__)


def require_auth():
    """Verifica que haya usuario autenticado"""
    return current_user.is_authenticated


@venta_bp.post("/api/ventas")
def create_venta():
    """Crea una venta"""
    if not require_auth():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    
    tipo_venta = payload.get("tipo_venta", "fisica")
    tipo_comprador = payload.get("tipo_comprador", "normal")
    comprador_nombre = payload.get("comprador_nombre")
    comprador_ci = payload.get("comprador_ci")
    comprador_ru_codigo = payload.get("comprador_ru_codigo")
    detalles = payload.get("detalles", [])
    observaciones = payload.get("observaciones")
    
    if tipo_comprador in ("estudiante", "administrativo", "docente"):
        if not comprador_nombre or not comprador_ci:
            return jsonify({"error": "Nombre y CI son requeridos para este tipo de comprador"}), 400
    
    if not detalles:
        return jsonify({"error": "Debe incluir productos"}), 400
    
    subtotal = 0
    detalle_venta_list = []
    
    for item in detalles:
        id_producto_talla = item.get("id_producto_talla")
        cantidad = item.get("cantidad", 1)
        precio_unitario = item.get("precio_unitario", 0)
        descuento = item.get("descuento", 0)
        
        if not verificar_stock_suficiente(id_producto_talla, cantidad):
            return jsonify({"error": "Stock insuficiente"}), 400
        
        item_subtotal = (float(precio_unitario) * cantidad) - float(descuento)
        subtotal += item_subtotal
        
        detalle_venta_list.append({
            "id_producto_talla": id_producto_talla,
            "cantidad": cantidad,
            "precio_unitario": precio_unitario,
            "descuento": descuento,
            "subtotal": item_subtotal,
        })
    
    user_data, role = serialize_user(current_user)
    id_vendedor = None
    id_cliente = None
    
    if role == "vendedor":
        id_vendedor = user_data.get("id_vendedor")
    elif role == "cliente":
        id_cliente = user_data.get("id_cliente")
    
    venta = Venta(
        id_vendedor=id_vendedor,
        id_cliente=id_cliente,
        tipo_venta=tipo_venta,
        tipo_comprador=tipo_comprador,
        comprador_nombre=comprador_nombre,
        comprador_ci=comprador_ci,
        comprador_ru_codigo=comprador_ru_codigo,
        subtotal=subtotal,
        total=subtotal,
        observaciones=observaciones,
    )
    db.session.add(venta)
    db.session.commit()
    
    for item in detalle_venta_list:
        det = DetalleVenta(
            id_venta=venta.id_venta,
            id_producto_talla=item["id_producto_talla"],
            cantidad=item["cantidad"],
            precio_unitario=item["precio_unitario"],
            descuento=item["descuento"],
            subtotal=item["subtotal"],
        )
        db.session.add(det)
        
        actualizar_stock(item["id_producto_talla"], item["cantidad"], "restar")
    
    db.session.commit()
    
    qr_data = generar_qr_pago(venta.id_venta, venta.total)
    
    pago = Pago(
        id_venta=venta.id_venta,
        monto=venta.total,
        metodo_pago="qr",
        referencia=f"QR_{venta.id_venta}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
    )
    db.session.add(pago)
    db.session.commit()
    
    registrar_auditoria(
        accion="registrar_venta",
        id_usuario=user_data.get(f"id_{role}"),
        tipo_usuario=role,
        entidad_afectada="venta",
        id_entidad=venta.id_venta,
        detalles={"total": float(venta.total), "tipo": tipo_venta}
    )
    
    return jsonify({
        "venta": venta.to_dict(),
        "qr_pago": qr_data,
        "pago": pago.to_dict(),
    }), 201


@venta_bp.get("/api/ventas")
def list_ventas():
    """Lista ventas"""
    if not require_auth():
        return jsonify({"error": "No autorizado"}), 401
    
    user_data, role = serialize_user(current_user)
    
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    fecha_inicio = request.args.get("fecha_inicio")
    fecha_fin = request.args.get("fecha_fin")
    
    query = Venta.query
    
    if role == "vendedor":
        query = query.filter_by(id_vendedor=user_data.get("id_vendedor"))
    elif role == "cliente":
        query = query.filter_by(id_cliente=user_data.get("id_cliente"))
    
    if fecha_inicio:
        try:
            query = query.filter(Venta.fecha >= datetime.strptime(fecha_inicio, "%Y-%m-%d").date())
        except ValueError:
            pass
    
    if fecha_fin:
        try:
            query = query.filter(Venta.fecha <= datetime.strptime(fecha_fin, "%Y-%m-%d").date())
        except ValueError:
            pass
    
    query = query.order_by(Venta.fecha.desc(), Venta.id_venta.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        "ventas": [v.to_dict(include_relations=False) for v in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    }), 200


@venta_bp.get("/api/ventas/<int:venta_id>")
def get_venta(venta_id):
    """Obtiene venta"""
    if not require_auth():
        return jsonify({"error": "No autorizado"}), 401
    
    venta = db.session.get(Venta, venta_id)
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404
    
    user_data, role = serialize_user(current_user)
    
    if role == "vendedor" and venta.id_vendedor != user_data.get("id_vendedor"):
        return jsonify({"error": "No autorizado"}), 403
    elif role == "cliente" and venta.id_cliente != user_data.get("id_cliente"):
        return jsonify({"error": "No autorizado"}), 403
    
    return jsonify({"venta": venta.to_dict()}), 200


@venta_bp.get("/api/ventas/<int:venta_id>/qr")
def get_qr_venta(venta_id):
    """Obtiene QR de pago para venta"""
    venta = db.session.get(Venta, venta_id)
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404
    
    qr_data = generar_qr_pago(venta.id_venta, venta.total)
    
    return jsonify({
        "qr": qr_data,
        "monto": float(venta.total),
        "referencia": f"VENTA-{venta.id_venta}",
    }), 200


@venta_bp.post("/api/ventas/<int:venta_id>/envio")
def create_envio(venta_id):
    """Crea envio para venta virtual"""
    if not require_auth():
        return jsonify({"error": "No autorizado"}), 401
    
    venta = db.session.get(Venta, venta_id)
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404
    
    if venta.tipo_venta != "virtual":
        return jsonify({"error": "Solo ventas virtuales tienen envio"}), 400
    
    if venta.envio:
        return jsonify({"error": "Ya existe envio para esta venta"}), 409
    
    payload = request.get_json(silent=True) or {}
    
    direccion = (payload.get("direccion") or "").strip()
    referencia = (payload.get("referencia") or "").strip()
    nombre_receptor = (payload.get("nombre_receptor") or "").strip()
    telefono = (payload.get("telefono") or "").strip()
    
    if not all([direccion, nombre_receptor, telefono]):
        return jsonify({"error": "Direccion, nombre receptor y telefono son requeridos"}), 400
    
    envio = Envio(
        id_venta=venta_id,
        direccion=direccion,
        referencia=referencia,
        nombre_receptor=nombre_receptor,
        telefono=telefono,
    )
    db.session.add(envio)
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="crear_envio",
        id_usuario=user_data.get(f"id_{role}"),
        tipo_usuario=role,
        entidad_afectada="envio",
        id_entidad=envio.id_envio,
        detalles={"venta_id": venta_id}
    )
    
    return jsonify({"envio": envio.to_dict()}), 201
