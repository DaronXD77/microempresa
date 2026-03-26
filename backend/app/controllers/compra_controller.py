"""
Controlador de compras (solo superadmin)
"""
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_login import current_user
from ...models.base import db
from ...models import Compra, DetalleCompra, Proveedor, ProductoTalla
from ...services import serialize_user, registrar_auditoria, actualizar_stock

compra_bp = Blueprint("compra", __name__)


def require_superadmin():
    """Verifica que sea superadmin"""
    if not current_user.is_authenticated:
        return False
    user_data, role = serialize_user(current_user)
    return role == "superadmin"


@compra_bp.get("/api/proveedores")
def list_proveedores():
    """Lista proveedores"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    proveedores = Proveedor.query.all()
    return jsonify({"proveedores": [p.to_dict() for p in proveedores]}), 200


@compra_bp.post("/api/proveedores")
def create_proveedor():
    """Crea proveedor"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    
    nombre = (payload.get("nombre") or "").strip()
    nit = (payload.get("nit") or "").strip()
    telefono = (payload.get("telefono") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    direccion = (payload.get("direccion") or "").strip()
    
    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400
    
    if nit and Proveedor.query.filter_by(nit=nit).first():
        return jsonify({"error": "NIT ya registrado"}), 409
    
    proveedor = Proveedor(
        nombre=nombre,
        nit=nit or None,
        telefono=telefono or None,
        email=email or None,
        direccion=direccion or None,
    )
    db.session.add(proveedor)
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="crear_proveedor",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="proveedor",
        id_entidad=proveedor.id_proveedor,
        detalles={"nombre": nombre}
    )
    
    return jsonify({"proveedor": proveedor.to_dict()}), 201


@compra_bp.put("/api/proveedores/<int:proveedor_id>")
def update_proveedor(proveedor_id):
    """Actualiza proveedor"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    proveedor = db.session.get(Proveedor, proveedor_id)
    if not proveedor:
        return jsonify({"error": "Proveedor no encontrado"}), 404
    
    payload = request.get_json(silent=True) or {}
    
    if "nombre" in payload:
        proveedor.nombre = payload["nombre"].strip()
    if "nit" in payload:
        proveedor.nit = payload["nit"].strip() or None
    if "telefono" in payload:
        proveedor.telefono = payload["telefono"].strip() or None
    if "email" in payload:
        proveedor.email = payload["email"].strip().lower() or None
    if "direccion" in payload:
        proveedor.direccion = payload["direccion"].strip() or None
    if "estado" in payload:
        proveedor.estado = bool(payload["estado"])
    
    db.session.commit()
    
    return jsonify({"proveedor": proveedor.to_dict()}), 200


@compra_bp.get("/api/compras")
def list_compras():
    """Lista compras"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    
    query = Compra.query.order_by(Compra.fecha.desc(), Compra.id_compra.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        "compras": [c.to_dict(include_relations=False) for c in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page,
    }), 200


@compra_bp.post("/api/compras")
def create_compra():
    """Crea una compra"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    
    id_proveedor = payload.get("id_proveedor")
    numero_factura = (payload.get("numero_factura") or "").strip()
    observaciones = (payload.get("observaciones") or "").strip()
    detalles = payload.get("detalles", [])
    
    if not id_proveedor:
        return jsonify({"error": "Proveedor requerido"}), 400
    
    if not detalles:
        return jsonify({"error": "Debe incluir productos"}), 400
    
    proveedor = db.session.get(Proveedor, id_proveedor)
    if not proveedor or not proveedor.estado:
        return jsonify({"error": "Proveedor invalido"}), 400
    
    user_data, role = serialize_user(current_user)
    id_superadmin = user_data.get("id_superadmin")
    
    total = 0
    detalle_compra_list = []
    
    for item in detalles:
        id_producto_talla = item.get("id_producto_talla")
        cantidad = item.get("cantidad", 1)
        precio_unitario = item.get("precio_unitario", 0)
        
        item_subtotal = float(precio_unitario) * cantidad
        total += item_subtotal
        
        detalle_compra_list.append({
            "id_producto_talla": id_producto_talla,
            "cantidad": cantidad,
            "precio_unitario": precio_unitario,
            "subtotal": item_subtotal,
        })
    
    compra = Compra(
        id_proveedor=id_proveedor,
        id_superadmin=id_superadmin,
        numero_factura=numero_factura or None,
        total=total,
        observaciones=observaciones or None,
    )
    db.session.add(compra)
    db.session.commit()
    
    for item in detalle_compra_list:
        det = DetalleCompra(
            id_compra=compra.id_compra,
            id_producto_talla=item["id_producto_talla"],
            cantidad=item["cantidad"],
            precio_unitario=item["precio_unitario"],
            subtotal=item["subtotal"],
        )
        db.session.add(det)
        
        actualizar_stock(item["id_producto_talla"], item["cantidad"], "sumar")
    
    db.session.commit()
    
    registrar_auditoria(
        accion="registrar_compra",
        id_usuario=id_superadmin,
        tipo_usuario="superadmin",
        entidad_afectada="compra",
        id_entidad=compra.id_compra,
        detalles={"total": float(compra.total), "proveedor": proveedor.nombre}
    )
    
    return jsonify({"compra": compra.to_dict()}), 201


@compra_bp.get("/api/compras/<int:compra_id>")
def get_compra(compra_id):
    """Obtiene compra"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    compra = db.session.get(Compra, compra_id)
    if not compra:
        return jsonify({"error": "Compra no encontrada"}), 404
    
    return jsonify({"compra": compra.to_dict()}), 200
