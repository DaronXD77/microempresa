from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..models import Empleado, EmpleadoPermiso, db
from ..services.auth_service import get_current_role, hash_password

empleado_bp = Blueprint("empleado", __name__)


def _require_owner():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "microempresa":
        return jsonify({"error": "No autorizado"}), 403
    return None


def _tenant_id():
    if not current_user.is_authenticated:
        return None
    if get_current_role(current_user) != "microempresa":
        return None
    return getattr(current_user, "tenant_id", None)


@empleado_bp.get("/api/microempresa/empleados")
def list_empleados():
    error = _require_owner()
    if error:
        return error
    tenant_id = _tenant_id()
    empleados = Empleado.query.filter_by(tenant_id=tenant_id).order_by(Empleado.id_empleado.desc()).all()
    return jsonify({"empleados": [e.to_dict() for e in empleados]})


@empleado_bp.post("/api/microempresa/empleados")
def create_empleado():
    error = _require_owner()
    if error:
        return error

    tenant_id = _tenant_id()
    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    apellido_paterno = (payload.get("apellido_paterno") or "").strip()
    apellido_materno = (payload.get("apellido_materno") or "").strip()
    email = (payload.get("email") or "").strip()
    ci = (payload.get("ci") or "").strip()
    password = payload.get("password") or ""
    permisos = payload.get("permisos") or []

    if not all([nombre, apellido_paterno, apellido_materno, email, ci]):
        return jsonify({"error": "Nombre, apellidos, email y CI son requeridos"}), 400

    if Empleado.query.filter_by(email=email).first():
        return jsonify({"error": "Email ya registrado"}), 409

    force_reset = True
    if not password:
        password = ci
    else:
        force_reset = False

    empleado = Empleado(
        tenant_id=tenant_id,
        nombre=nombre,
        apellido_paterno=apellido_paterno,
        apellido_materno=apellido_materno,
        email=email,
        ci=ci,
        password=hash_password(password),
        estado="activo",
        force_password_reset=force_reset,
    )
    db.session.add(empleado)
    db.session.flush()

    EmpleadoPermiso.query.filter_by(id_empleado=empleado.id_empleado).delete()
    for perm in permisos:
        if not perm:
            continue
        db.session.add(EmpleadoPermiso(id_empleado=empleado.id_empleado, permiso=str(perm)))

    db.session.commit()
    return jsonify({"empleado": empleado.to_dict()}), 201


@empleado_bp.put("/api/microempresa/empleados/<int:empleado_id>")
def update_empleado(empleado_id):
    error = _require_owner()
    if error:
        return error
    tenant_id = _tenant_id()
    empleado = Empleado.query.filter_by(id_empleado=empleado_id, tenant_id=tenant_id).first()
    if not empleado:
        return jsonify({"error": "Empleado no encontrado"}), 404

    payload = request.get_json(silent=True) or {}
    for field in ["nombre", "apellido_paterno", "apellido_materno", "email", "ci", "estado"]:
        if field in payload and payload.get(field) is not None:
            setattr(empleado, field, str(payload.get(field)).strip())

    if "permisos" in payload:
        EmpleadoPermiso.query.filter_by(id_empleado=empleado.id_empleado).delete()
        for perm in payload.get("permisos") or []:
            if not perm:
                continue
            db.session.add(EmpleadoPermiso(id_empleado=empleado.id_empleado, permiso=str(perm)))

    db.session.commit()
    return jsonify({"empleado": empleado.to_dict()})


@empleado_bp.patch("/api/microempresa/empleados/<int:empleado_id>/reset-password")
def reset_empleado_password(empleado_id):
    error = _require_owner()
    if error:
        return error
    tenant_id = _tenant_id()
    empleado = Empleado.query.filter_by(id_empleado=empleado_id, tenant_id=tenant_id).first()
    if not empleado:
        return jsonify({"error": "Empleado no encontrado"}), 404
    empleado.password = hash_password(empleado.ci)
    empleado.force_password_reset = True
    db.session.commit()
    return jsonify({"message": "Contraseña reiniciada"})


@empleado_bp.put("/api/empleados/me")
def update_empleado_me():
    if not current_user.is_authenticated or get_current_role(current_user) != "empleado":
        return jsonify({"error": "No autorizado"}), 403

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    apellido_paterno = (payload.get("apellido_paterno") or "").strip()
    apellido_materno = (payload.get("apellido_materno") or "").strip()
    ci = (payload.get("ci") or "").strip()
    password = payload.get("password")

    if nombre:
        current_user.nombre = nombre
    if apellido_paterno:
        current_user.apellido_paterno = apellido_paterno
    if apellido_materno:
        current_user.apellido_materno = apellido_materno
    if ci:
        current_user.ci = ci
    if password:
        current_user.password = hash_password(password)
        current_user.force_password_reset = False

    db.session.commit()
    return jsonify({"empleado": current_user.to_dict()})
