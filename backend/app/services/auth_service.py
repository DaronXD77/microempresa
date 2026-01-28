import hashlib
from datetime import datetime
from urllib.parse import urlparse

from ..models import AdminSu, Cliente, Microempresa, Empleado
from ..services.venta_storage_service import build_upload_url
from ..models.auth import ROLE_TYPES
from ..models.base import db

ROLE_MODELS = {
    "super_usuario": AdminSu,
    "microempresa": Microempresa,
    "cliente": Cliente,
    "empleado": Empleado,
}


def hash_password(password):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def serialize_user(user):
    if isinstance(user, AdminSu):
        return user.to_dict(), "super_usuario"
    if isinstance(user, Microempresa):
        data = user.to_dict()
        if data.get("qr_url"):
            data["qr_url"] = build_upload_url(data["qr_url"])
        data["is_owner"] = True
        return data, "microempresa"
    if isinstance(user, Empleado):
        data = user.to_dict()
        data["is_owner"] = False
        return data, "empleado"
    if isinstance(user, Cliente):
        return user.to_dict(), "cliente"
    return None, None


def get_current_role(user):
    return serialize_user(user)[1]


def load_user(user_id):
    if not user_id:
        return None
    if ":" in user_id:
        role, raw_id = user_id.split(":", 1)
    else:
        role, raw_id = "microempresa", user_id
    model = ROLE_MODELS.get(role)
    if not model:
        return None
    return db.session.get(model, int(raw_id))


def is_valid_url(value):
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def is_valid_schedule(value):
    if not value or "-" not in value:
        return False
    start_raw, end_raw = [part.strip() for part in value.split("-", 1)]
    try:
        start = datetime.strptime(start_raw, "%H:%M")
        end = datetime.strptime(end_raw, "%H:%M")
    except ValueError:
        return False
    return start < end


def get_user_for_role(role, identifier):
    if role == "microempresa":
        user = Microempresa.query.filter_by(email=identifier).first()
        if not user:
            user = Microempresa.query.filter_by(nombre=identifier).first()
        return user
    model = ROLE_MODELS.get(role)
    if not model:
        return None
    return model.query.filter_by(email=identifier).first()


def get_users_by_identifier(identifier):
    return {
        role_key: get_user_for_role(role_key, identifier)
        for role_key in ROLE_TYPES
    }


def is_active_user(user):
    return getattr(user, "estado", "activo") == "activo"


def get_user_permissions(user):
    if isinstance(user, Empleado):
        return [p.permiso for p in user.permisos]
    return []


def has_permission(user, perm):
    if isinstance(user, Microempresa):
        return True
    if isinstance(user, Empleado):
        return perm in get_user_permissions(user)
    return False


def get_roles_for_email(email, password_hash):
    roles = []
    for role_key, model in ROLE_MODELS.items():
        user = model.query.filter_by(email=email).first()
        if (
            user
            and user.password
            and user.password == password_hash
            and is_active_user(user)
        ):
            roles.append(role_key)
    return roles


def guest_payload():
    return {"nombre": "Invitado"}
