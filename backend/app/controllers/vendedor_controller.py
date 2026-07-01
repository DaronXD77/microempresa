"""
Controlador de vendedores (solo superadmin)
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user
from ..models.base import db
from ..models import Vendedor
from ..services import (
    serialize_user, hash_password, validate_email,
    validate_ci, validate_phone, registrar_auditoria
)

vendedor_bp = Blueprint("vendedor", __name__)


def require_superadmin():
    """Verifica que sea superadmin"""
    if not current_user.is_authenticated:
        return False
    user_data, role = serialize_user(current_user)
    return role == "superadmin"


@vendedor_bp.get("/api/vendedores")
def list_vendedores():
    """Lista vendedores"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    vendedores = Vendedor.query.all()
    return jsonify({"vendedores": [v.to_dict() for v in vendedores]}), 200


@vendedor_bp.post("/api/vendedores")
def create_vendedor():
    """Crea vendedor"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    
    nombre = (payload.get("nombre") or "").strip()
    ci = (payload.get("ci") or "").strip()
    telefono = (payload.get("telefono") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    
    if not all([nombre, ci, password]):
        return jsonify({"error": "Nombre, CI y password son requeridos"}), 400
    
    if not validate_ci(ci):
        return jsonify({"error": "CI invalido (5-10 digitos)"}), 400
    
    if email and not validate_email(email):
        return jsonify({"error": "Email invalido"}), 400
    
    if telefono and not validate_phone(telefono):
        return jsonify({"error": "Telefono invalido"}), 400
    
    if len(password) < 8:
        return jsonify({"error": "Password debe tener al menos 8 caracteres"}), 400
    
    if Vendedor.query.filter_by(ci=ci).first():
        return jsonify({"error": "CI ya registrado"}), 409
    
    if email and Vendedor.query.filter_by(email=email).first():
        return jsonify({"error": "Email ya registrado"}), 409
    
    vendedor = Vendedor(
        nombre=nombre,
        ci=ci,
        telefono=telefono or None,
        email=email or None,
        password_hash=hash_password(password),
    )
    db.session.add(vendedor)
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="crear_vendedor",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="vendedor",
        id_entidad=vendedor.id_vendedor,
        detalles={"nombre": nombre, "ci": ci}
    )
    
    return jsonify({"vendedor": vendedor.to_dict()}), 201


@vendedor_bp.put("/api/vendedores/<int:vendedor_id>")
def update_vendedor(vendedor_id):
    """Actualiza vendedor"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    vendedor = db.session.get(Vendedor, vendedor_id)
    if not vendedor:
        return jsonify({"error": "Vendedor no encontrado"}), 404
    
    payload = request.get_json(silent=True) or {}
    
    if "nombre" in payload:
        vendedor.nombre = payload["nombre"].strip()
    if "ci" in payload:
        nuevo_ci = payload["ci"].strip()
        if nuevo_ci != vendedor.ci:
            if not validate_ci(nuevo_ci):
                return jsonify({"error": "CI invalido"}), 400
            if Vendedor.query.filter_by(ci=nuevo_ci).first():
                return jsonify({"error": "CI ya registrado"}), 409
            vendedor.ci = nuevo_ci
    if "telefono" in payload:
        vendedor.telefono = payload["telefono"].strip() or None
    if "email" in payload:
        nuevo_email = payload["email"].strip().lower() or None
        if nuevo_email and nuevo_email != vendedor.email:
            if not validate_email(nuevo_email):
                return jsonify({"error": "Email invalido"}), 400
            if Vendedor.query.filter_by(email=nuevo_email).first():
                return jsonify({"error": "Email ya registrado"}), 409
            vendedor.email = nuevo_email
    if "estado" in payload:
        vendedor.estado = "activo" if payload["estado"] else "inactivo"
    if "password" in payload and payload["password"]:
        if len(payload["password"]) < 8:
            return jsonify({"error": "Password debe tener al menos 8 caracteres"}), 400
        vendedor.password_hash = hash_password(payload["password"])
    
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="actualizar_vendedor",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="vendedor",
        id_entidad=vendedor_id,
    )
    
    return jsonify({"vendedor": vendedor.to_dict()}), 200


@vendedor_bp.delete("/api/vendedores/<int:vendedor_id>")
def delete_vendedor(vendedor_id):
    """Desactiva vendedor"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    vendedor = db.session.get(Vendedor, vendedor_id)
    if not vendedor:
        return jsonify({"error": "Vendedor no encontrado"}), 404
    
    vendedor.estado = "inactivo"
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="desactivar_vendedor",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="vendedor",
        id_entidad=vendedor_id,
    )
    
    return jsonify({"message": "Vendedor desactivado"}), 200
