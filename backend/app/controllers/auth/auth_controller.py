"""
Controlador de autenticacion
"""
from datetime import datetime
from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_user, logout_user
from ...models.base import db
from ...models import SuperAdmin, Vendedor, Cliente, Auditoria
from ...services import (
    hash_password,
    verify_password,
    get_users_by_email,
    serialize_user,
    is_active,
    validate_email,
    validate_ci,
    validate_phone,
    registrar_auditoria,
)

auth_bp = Blueprint("auth", __name__)


def _audit_login(user, role):
    """Registra login en auditoria"""
    registrar_auditoria(
        accion="login_exitoso",
        id_usuario=getattr(user, f"id_{role}" if role != "superadmin" else "id_superadmin"),
        tipo_usuario=role,
        detalles={"email": getattr(user, "email", "")}
    )


def _audit_logout():
    """Registra logout en auditoria"""
    if current_user.is_authenticated:
        user_dict, role = serialize_user(current_user)
        if role and user_dict:
            registrar_auditoria(
                accion="logout",
                id_usuario=user_dict.get(f"id_{role}" if role != "superadmin" else "id_superadmin"),
                tipo_usuario=role,
            )


@auth_bp.post("/api/login")
def login():
    """Inicio de sesion"""
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    
    if not email or not password:
        return jsonify({"error": "Email y password son requeridos"}), 400
    
    if not validate_email(email):
        return jsonify({"error": "Email invalido"}), 400
    
    users = get_users_by_email(email)
    
    for role, user in users.items():
        if user and verify_password(user.password_hash, password):
            if not is_active(user):
                return jsonify({"error": "Usuario inactivo"}), 401
            
            login_user(user)
            _audit_login(user, role)
            user_data, user_role = serialize_user(user)
            return jsonify({"user": user_data, "role": user_role}), 200
    
    registrar_auditoria(
        accion="login_fallido",
        detalles={"email": email}
    )
    
    return jsonify({"error": "Credenciales invalidas"}), 401


@auth_bp.post("/api/logout")
def logout():
    """Cierre de sesion"""
    _audit_logout()
    logout_user()
    return jsonify({"message": "Logout exitoso"}), 200


@auth_bp.get("/api/me")
def me():
    """Obtiene usuario actual"""
    if current_user.is_authenticated:
        user_data, user_role = serialize_user(current_user)
        return jsonify({"user": user_data, "role": user_role}), 200
    return jsonify({"user": None, "role": None}), 200


@auth_bp.post("/api/register/cliente")
def register_cliente():
    """Registro de cliente"""
    payload = request.get_json(silent=True) or {}
    
    nombre = (payload.get("nombre") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    telefono = (payload.get("telefono") or "").strip()
    password = payload.get("password") or ""
    
    if not all([nombre, email, password]):
        return jsonify({"error": "Nombre, email y password son requeridos"}), 400
    
    if not validate_email(email):
        return jsonify({"error": "Email invalido"}), 400
    
    if len(password) < 8:
        return jsonify({"error": "Password debe tener al menos 8 caracteres"}), 400
    
    if telefono and not validate_phone(telefono):
        return jsonify({"error": "Telefono invalido"}), 400
    
    if Cliente.query.filter_by(email=email).first():
        return jsonify({"error": "Email ya registrado"}), 409
    
    cliente = Cliente(
        nombre=nombre,
        email=email,
        telefono=telefono or None,
        password_hash=hash_password(password),
        estado="activo",
    )
    db.session.add(cliente)
    db.session.commit()
    
    login_user(cliente)
    _audit_login(cliente, "cliente")
    
    registrar_auditoria(
        accion="registrar_cliente",
        id_usuario=cliente.id_cliente,
        tipo_usuario="cliente",
        entidad_afectada="cliente",
        id_entidad=cliente.id_cliente,
        detalles={"email": email}
    )
    
    user_data, user_role = serialize_user(cliente)
    return jsonify({"user": user_data, "role": user_role}), 201
