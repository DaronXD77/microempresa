"""
Controlador de autenticacion
"""
from datetime import datetime
from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_user, logout_user
from ...models.base import db
from ...models import SuperAdmin, Vendedor, Cliente, Auditoria
from ...services import (
    get_user_for_role,
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

ROLE_ALIASES = {
    "super_usuario": "superadmin",
    "superadmin": "superadmin",
    "empleado": "vendedor",
    "vendedor": "vendedor",
    "cliente": "cliente",
}


def _normalize_role(role):
    return ROLE_ALIASES.get((role or "").strip().lower())


def _auth_response(user_data, role, status=200, available_roles=None):
    return jsonify(
        {
            "user": user_data,
            "role": role,
            "available_roles": available_roles or ([role] if role else []),
        }
    ), status


def _guest_response():
    return _auth_response({"nombre": "Invitado"}, "cliente")


def _clear_guest_session():
    session.pop("guest", None)


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


def _login_and_respond(user, role, status=200):
    _clear_guest_session()
    login_user(user)
    _audit_login(user, role)
    user_data, user_role = serialize_user(user)
    return _auth_response(user_data, user_role, status)


@auth_bp.post("/api/login")
def login():
    """Inicio de sesion"""
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""
    requested_role = _normalize_role(payload.get("role"))
    
    if not email or not password:
        return jsonify({"error": "Email y password son requeridos"}), 400
    
    if not validate_email(email):
        return jsonify({"error": "Email invalido"}), 400
    
    users = get_users_by_email(email)
    valid_roles = []
    for role, user in users.items():
        if not user or not verify_password(user.password_hash, password):
            continue
        if not is_active(user):
            return jsonify({"error": "Usuario inactivo"}), 401
        valid_roles.append(role)

    if requested_role:
        user = users.get(requested_role)
        if not user or requested_role not in valid_roles:
            return jsonify({"error": "Credenciales invalidas"}), 401
        return _login_and_respond(user, requested_role)

    if len(valid_roles) > 1:
        return jsonify({"select_role": True, "roles": valid_roles}), 200

    if len(valid_roles) == 1:
        role = valid_roles[0]
        return _login_and_respond(users[role], role)
    
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
    _clear_guest_session()
    return jsonify({"message": "Logout exitoso"}), 200


@auth_bp.get("/api/me")
def me():
    """Obtiene usuario actual"""
    if current_user.is_authenticated:
        user_data, user_role = serialize_user(current_user)
        return _auth_response(user_data, user_role)
    if session.get("guest"):
        return _guest_response()
    return _auth_response(None, None, available_roles=[])


@auth_bp.post("/api/guest-login")
def guest_login():
    """Sesion temporal como invitado"""
    _audit_logout()
    logout_user()
    session["guest"] = True
    return _guest_response()


@auth_bp.post("/api/switch-role")
def switch_role():
    """Cambia al rol seleccionado para el mismo email"""
    if not current_user.is_authenticated:
        return jsonify({"error": "Rol invalido"}), 401

    payload = request.get_json(silent=True) or {}
    requested_role = _normalize_role(payload.get("role"))
    if not requested_role:
        return jsonify({"error": "Rol requerido"}), 400

    email = getattr(current_user, "email", None)
    if not email:
        return jsonify({"error": "Rol invalido"}), 400

    user = get_user_for_role(requested_role, email)
    current_password_hash = getattr(current_user, "password_hash", None)
    if (
        not user
        or not is_active(user)
        or not current_password_hash
        or getattr(user, "password_hash", None) != current_password_hash
    ):
        return jsonify({"error": "Rol invalido"}), 400

    return _login_and_respond(user, requested_role)


@auth_bp.post("/api/register")
def register():
    """Registro compatible con el frontend publicado"""
    payload = request.get_json(silent=True) or {}
    role = _normalize_role(payload.get("role"))

    if role == "cliente":
        return register_cliente()

    if role != "superadmin":
        return jsonify({"error": "Rol de registro no soportado"}), 400

    nombre = (payload.get("nombre") or "").strip()
    apellido_paterno = (payload.get("apellido_paterno") or "").strip()
    apellido_materno = (payload.get("apellido_materno") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not all([nombre, apellido_paterno, email, password]):
        return jsonify({"error": "Todos los campos son requeridos"}), 400

    if not validate_email(email):
        return jsonify({"error": "Email invalido"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password debe tener al menos 8 caracteres"}), 400

    existing_users = get_users_by_email(email)
    if any(existing_users.values()):
        return jsonify({"error": "Email ya registrado"}), 409

    full_name = " ".join(part for part in [nombre, apellido_paterno, apellido_materno] if part)
    admin = SuperAdmin(
        nombre=full_name,
        email=email,
        password_hash=hash_password(password),
        estado="activo",
    )
    db.session.add(admin)
    db.session.commit()

    registrar_auditoria(
        accion="registrar_superadmin",
        id_usuario=admin.id_superadmin,
        tipo_usuario="superadmin",
        entidad_afectada="superadmin",
        id_entidad=admin.id_superadmin,
        detalles={"email": email},
    )

    return _login_and_respond(admin, "superadmin", 201)


@auth_bp.post("/api/register/cliente")
def register_cliente():
    """Registro de cliente"""
    payload = request.get_json(silent=True) or {}
    
    nombre = (payload.get("nombre") or "").strip()
    apellido_paterno = (payload.get("apellido_paterno") or "").strip()
    apellido_materno = (payload.get("apellido_materno") or "").strip()
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
    
    existing_users = get_users_by_email(email)
    if any(existing_users.values()):
        return jsonify({"error": "Email ya registrado"}), 409

    full_name = " ".join(part for part in [nombre, apellido_paterno, apellido_materno] if part)
    
    cliente = Cliente(
        nombre=full_name or nombre,
        email=email,
        telefono=telefono or None,
        password_hash=hash_password(password),
        estado="activo",
    )
    db.session.add(cliente)
    db.session.commit()
    
    _clear_guest_session()
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
    return _auth_response(user_data, user_role, 201)
