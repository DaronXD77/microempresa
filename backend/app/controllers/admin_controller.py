from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..models import AdminSu, db
from ..services.auth_service import get_current_role, hash_password
from ..views.admin_view import admin_item

admin_bp = Blueprint("admin", __name__)


def require_super_admin():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "super_usuario":
        return jsonify({"error": "No autorizado"}), 403
    return None


@admin_bp.get("/api/admins")
def list_admins():
    error = require_super_admin()
    if error:
        return error

    admins = AdminSu.query.order_by(AdminSu.apellido_paterno, AdminSu.nombre).all()
    return jsonify({"admins": [admin_item(admin) for admin in admins]})


@admin_bp.post("/api/admins")
def create_admin():
    error = require_super_admin()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    apellido_paterno = (payload.get("apellido_paterno") or "").strip()
    apellido_materno = (payload.get("apellido_materno") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    if not nombre or not apellido_paterno or not apellido_materno or not email or not password:
        return jsonify({"error": "Nombre, apellidos, email y password son requeridos"}), 400

    if AdminSu.query.filter_by(email=email).first():
        return jsonify({"error": "Email ya registrado"}), 409

    admin_user = AdminSu(
        nombre=nombre,
        apellido_paterno=apellido_paterno,
        apellido_materno=apellido_materno,
        email=email,
        password=hash_password(password),
        estado="activo",
    )
    db.session.add(admin_user)
    db.session.commit()
    return jsonify({"admin": admin_item(admin_user)}), 201


@admin_bp.put("/api/admins/<int:admin_id>")
def update_admin(admin_id):
    error = require_super_admin()
    if error:
        return error

    admin_user = AdminSu.query.get_or_404(admin_id)

    payload = request.get_json(silent=True) or {}
    nombre = payload.get("nombre")
    apellido_paterno = payload.get("apellido_paterno")
    apellido_materno = payload.get("apellido_materno")
    email = payload.get("email")
    password = payload.get("password")

    if nombre is not None:
        admin_user.nombre = nombre.strip()
    if apellido_paterno is not None:
        admin_user.apellido_paterno = apellido_paterno.strip()
    if apellido_materno is not None:
        admin_user.apellido_materno = apellido_materno.strip()
    if email is not None:
        email = email.strip()
        if email and email != admin_user.email:
            return jsonify({"error": "No puedes modificar el email"}), 400
    if password:
        admin_user.password = hash_password(password)

    db.session.commit()
    return jsonify({"admin": admin_item(admin_user)})


@admin_bp.patch("/api/admins/<int:admin_id>/activate")
def activate_admin(admin_id):
    error = require_super_admin()
    if error:
        return error

    admin_user = AdminSu.query.get_or_404(admin_id)
    admin_user.estado = "activo"
    db.session.commit()
    return jsonify({"message": "Admin activado"})


@admin_bp.delete("/api/admins/<int:admin_id>")
def delete_admin(admin_id):
    error = require_super_admin()
    if error:
        return error

    admin_user = AdminSu.query.get_or_404(admin_id)
    if admin_user.id_su == current_user.id_su:
        return jsonify({"error": "No puedes darte de baja"}), 403

    admin_user.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Admin inactivado"})
