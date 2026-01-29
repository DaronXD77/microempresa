import hashlib
from datetime import datetime
from urllib.parse import urlparse

from ..models import AdminSu, Cliente, Microempresa, Empleado, Suscripcion, SuscripcionSolicitud
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


def get_active_subscription(tenant_id: int | None):
    if not tenant_id:
        return None
    now = datetime.utcnow()
    return (
        Suscripcion.query
        .filter_by(tenant_id=tenant_id, estado="activa")
        .filter((Suscripcion.fecha_fin == None) | (Suscripcion.fecha_fin >= now))
        .order_by(Suscripcion.fecha_fin.desc(), Suscripcion.id_suscripcion.desc())
        .first()
    )


def ensure_pending_solicitud(tenant_id: int):
    latest = (
        SuscripcionSolicitud.query
        .filter_by(tenant_id=tenant_id)
        .order_by(SuscripcionSolicitud.creado_en.desc())
        .first()
    )
    if latest and (latest.estado or "").lower() in {"borrador", "plan_seleccionado", "en_espera"}:
        return latest

    raw_token, token_hash, expires = SuscripcionSolicitud.generate_onboarding_token()
    solicitud = SuscripcionSolicitud(
        tenant_id=tenant_id,
        id_plan=None,
        estado="borrador",
        onboarding_token_hash=token_hash,
        onboarding_expires_at=expires,
        qr_text=None,
        comprobante_path=None,
    )
    db.session.add(solicitud)
    db.session.commit()
    return solicitud


def check_microempresa_subscription(microempresa: Microempresa):
    if not microempresa:
        return True, None
    active = get_active_subscription(microempresa.tenant_id)
    if active:
        return True, None
    solicitud = ensure_pending_solicitud(microempresa.tenant_id)
    return False, solicitud


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
