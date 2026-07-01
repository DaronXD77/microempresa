from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy.exc import SQLAlchemyError

from ..models import Proveedor, db
from ..services.auth_service import get_current_role, has_permission

proveedor_bp = Blueprint("proveedor", __name__)


def _require_perm():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    role = get_current_role(current_user)
    if role == "microempresa":
        return None
    if role == "empleado" and has_permission(current_user, "proveedores"):
        return None
    return jsonify({"error": "No autorizado"}), 403


def _tenant_id():
    if not current_user.is_authenticated:
        return None
    if get_current_role(current_user) not in {"microempresa", "empleado"}:
        return None
    return getattr(current_user, "tenant_id", None)


@proveedor_bp.get("/api/proveedores")
def list_proveedores():
    error = _require_perm()
    if error:
        return error
    tenant_id = _tenant_id()
    proveedores = (
        Proveedor.query
        .filter_by(tenant_id=tenant_id)
        .order_by(Proveedor.nombre)
        .all()
    )
    return jsonify({"proveedores": [p.to_dict() for p in proveedores]})


@proveedor_bp.post("/api/proveedores")
def create_proveedor():
    error = _require_perm()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    direccion = (payload.get("direccion") or "").strip()
    email = (payload.get("email") or "").strip()
    estado = (payload.get("estado") or "activo").strip().lower()

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400
    if estado not in {"activo", "inactivo"}:
        return jsonify({"error": "Estado invalido"}), 400

    tenant_id = _tenant_id()
    proveedor = Proveedor(
        tenant_id=tenant_id,
        nombre=nombre,
        direccion=direccion or None,
        email=email or None,
        estado=estado,
    )
    try:
        db.session.add(proveedor)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        return jsonify({"error": f"No se pudo crear el proveedor: {exc.__class__.__name__}"}), 500
    return jsonify({"proveedor": proveedor.to_dict()}), 201


@proveedor_bp.put("/api/proveedores/<int:proveedor_id>")
def update_proveedor(proveedor_id):
    error = _require_perm()
    if error:
        return error

    tenant_id = _tenant_id()
    proveedor = Proveedor.query.filter_by(id_proveedor=proveedor_id, tenant_id=tenant_id).first()
    if not proveedor:
        return jsonify({"error": "Proveedor no encontrado"}), 404

    payload = request.get_json(silent=True) or {}
    nombre = payload.get("nombre")
    direccion = payload.get("direccion")
    email = payload.get("email")
    estado = payload.get("estado")

    if nombre is not None:
        nombre = nombre.strip()
        if not nombre:
            return jsonify({"error": "Nombre requerido"}), 400
        proveedor.nombre = nombre

    if direccion is not None:
        proveedor.direccion = direccion.strip() or None

    if email is not None:
        proveedor.email = email.strip() or None

    if estado is not None:
        estado = estado.strip().lower()
        if estado not in {"activo", "inactivo"}:
            return jsonify({"error": "Estado invalido"}), 400
        proveedor.estado = estado

    db.session.commit()
    return jsonify({"proveedor": proveedor.to_dict()})


@proveedor_bp.patch("/api/proveedores/<int:proveedor_id>/deactivate")
def deactivate_proveedor(proveedor_id):
    error = _require_perm()
    if error:
        return error
    tenant_id = _tenant_id()
    proveedor = Proveedor.query.filter_by(id_proveedor=proveedor_id, tenant_id=tenant_id).first()
    if not proveedor:
        return jsonify({"error": "Proveedor no encontrado"}), 404
    proveedor.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Proveedor inactivado"})


@proveedor_bp.patch("/api/proveedores/<int:proveedor_id>/activate")
def activate_proveedor(proveedor_id):
    error = _require_perm()
    if error:
        return error
    tenant_id = _tenant_id()
    proveedor = Proveedor.query.filter_by(id_proveedor=proveedor_id, tenant_id=tenant_id).first()
    if not proveedor:
        return jsonify({"error": "Proveedor no encontrado"}), 404
    proveedor.estado = "activo"
    db.session.commit()
    return jsonify({"message": "Proveedor activado"})
