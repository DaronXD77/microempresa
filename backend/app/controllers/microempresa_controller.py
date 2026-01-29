from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..models import Microempresa, db
from ..services.auth_service import (
    get_current_role,
    hash_password,
    is_valid_schedule,
    is_valid_url,
)
from ..views.microempresa_view import microempresa_detail, microempresa_item
from ..services.venta_storage_service import build_upload_url, save_qr_image

microempresa_bp = Blueprint("microempresa", __name__)

VIRTUAL_DIRECCION = "Sin tienda física (virtual)"
VIRTUAL_HORARIO = "Atención online"


def is_super_admin():
    return current_user.is_authenticated and get_current_role(current_user) == "super_usuario"


def can_access_microempresa(tenant_id):
    if not current_user.is_authenticated:
        return False
    role = get_current_role(current_user)
    if role == "super_usuario":
        return True
    return role == "microempresa" and current_user.tenant_id == tenant_id


def _normalize_tipo_tienda(raw: str) -> str:
    t = (raw or "").strip().lower()
    if t in {"virtual", "v"}:
        return "virtual"
    if t in {"fisica", "física", "f"}:
        return "fisica"
    return ""


def _looks_virtual(direccion: str, horario: str) -> bool:
    h = (horario or "").strip()
    d = (direccion or "").strip()
    # si es un rango horario válido => NO virtual
    if h and is_valid_schedule(h):
        return False
    low_h = h.lower()
    low_d = d.lower()
    markers = ["online", "virtual", "sin tienda", "sin local", "no disponible", "no aplica"]
    return any(m in low_h for m in markers) or any(m in low_d for m in markers) or (not is_valid_schedule(h))


def _apply_virtual_defaults(direccion: str, horario: str) -> tuple[str, str]:
    d = (direccion or "").strip() or VIRTUAL_DIRECCION
    h = (horario or "").strip() or VIRTUAL_HORARIO
    return d, h


@microempresa_bp.get("/api/microempresas")
def list_microempresas():
    if not is_super_admin():
        return jsonify({"error": "No autorizado"}), 403

    microempresas = Microempresa.query.order_by(Microempresa.nombre).all()
    return jsonify({"microempresas": [microempresa_item(m) for m in microempresas]})


@microempresa_bp.get("/api/microempresas/<int:tenant_id>")
def get_microempresa(tenant_id):
    if not can_access_microempresa(tenant_id):
        return jsonify({"error": "No autorizado"}), 403

    microempresa = Microempresa.query.get_or_404(tenant_id)
    return jsonify({"microempresa": microempresa_detail(microempresa)})


@microempresa_bp.post("/api/microempresas")
def create_microempresa():
    if not is_super_admin():
        return jsonify({"error": "No autorizado"}), 403

    payload = request.get_json(silent=True) or {}

    tipo_tienda = _normalize_tipo_tienda(payload.get("tipo_tienda"))

    nombre = (payload.get("nombre") or "").strip()
    logo_url = (payload.get("logo_url") or "").strip()
    if logo_url.startswith("www."):
        logo_url = f"https://{logo_url}"
    direccion = (payload.get("direccion") or "").strip()
    horario = (payload.get("horario_atencion") or "").strip()
    telefono_contacto = (payload.get("telefono_contacto") or "").strip()
    nombre_prop = (payload.get("nombre_propietario") or "").strip()
    apellido_paterno_prop = (payload.get("apellido_paterno_propietario") or "").strip()
    apellido_materno_prop = (payload.get("apellido_materno_propietario") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    # ✅ campos base requeridos
    if not all([nombre, nombre_prop, apellido_paterno_prop, email, password]):
        return jsonify({"error": "Campos requeridos: nombre, propietario, apellido paterno, email, password"}), 400

    # ✅ determinar virtual si no viene tipo_tienda
    if not tipo_tienda:
        tipo_tienda = "virtual" if _looks_virtual(direccion, horario) else "fisica"

    if tipo_tienda == "virtual":
        direccion, horario = _apply_virtual_defaults(direccion, horario)
    else:
        if not direccion or not horario:
            return jsonify({"error": "Dirección y horario son requeridos para tienda física"}), 400
        if not is_valid_schedule(horario):
            return jsonify({"error": "Horario inválido"}), 400

    if logo_url and not is_valid_url(logo_url):
        return jsonify({"error": "Logo URL inválido"}), 400

    if not telefono_contacto:
        if tipo_tienda == "fisica":
            return jsonify({"error": "Celular de contacto requerido"}), 400
    elif not telefono_contacto.isdigit() or len(telefono_contacto) != 8:
        return jsonify({"error": "Celular debe tener 8 dígitos"}), 400

    if Microempresa.query.filter_by(nombre=nombre).first():
        return jsonify({"error": "Microempresa ya existe"}), 409
    if Microempresa.query.filter_by(email=email).first():
        return jsonify({"error": "Email ya registrado"}), 409

    microempresa = Microempresa(
        nombre=nombre,
        logo_url=logo_url or None,
        direccion=direccion,
        horario_atencion=horario,
        nombre_propietario=nombre_prop,
        apellido_paterno_propietario=apellido_paterno_prop,
        apellido_materno_propietario=apellido_materno_prop or None,
        telefono_contacto=telefono_contacto or None,
        email=email,
        password=hash_password(password),
        estado="activo",
    )
    db.session.add(microempresa)
    db.session.commit()
    return jsonify({"microempresa": microempresa_detail(microempresa)}), 201


@microempresa_bp.put("/api/microempresas/<int:tenant_id>")
def update_microempresa(tenant_id):
    if not can_access_microempresa(tenant_id):
        return jsonify({"error": "No autorizado"}), 403

    microempresa = Microempresa.query.get_or_404(tenant_id)
    payload = request.get_json(silent=True) or {}

    # ✅ nuevo: tipo_tienda (opcional)
    tipo_tienda = _normalize_tipo_tienda(payload.get("tipo_tienda"))

    nombre = payload.get("nombre")
    logo_url = payload.get("logo_url")
    direccion = payload.get("direccion")
    horario = payload.get("horario_atencion")
    telefono_contacto = payload.get("telefono_contacto")
    nombre_prop = payload.get("nombre_propietario")
    apellido_paterno_prop = payload.get("apellido_paterno_propietario")
    apellido_materno_prop = payload.get("apellido_materno_propietario")
    email = payload.get("email")
    password = payload.get("password")

    # si no viene tipo_tienda, lo inferimos por lo que tiene ahora / lo que llega
    if not tipo_tienda:
        next_dir = (direccion if direccion is not None else microempresa.direccion) or ""
        next_hor = (horario if horario is not None else microempresa.horario_atencion) or ""
        tipo_tienda = "virtual" if _looks_virtual(next_dir, next_hor) else "fisica"

    # =====================
    # validaciones por tipo
    # =====================
    if tipo_tienda == "fisica":
        # si está pasando de virtual -> física, debe terminar con datos válidos
        final_dir = (direccion if direccion is not None else microempresa.direccion) or ""
        final_hor = (horario if horario is not None else microempresa.horario_atencion) or ""
        final_tel = (telefono_contacto if telefono_contacto is not None else microempresa.telefono_contacto) or ""

        if not str(final_dir).strip():
            return jsonify({"error": "Dirección requerida para tienda física"}), 400

        if not str(final_hor).strip():
            return jsonify({"error": "Horario requerido para tienda física"}), 400

        if not is_valid_schedule(str(final_hor).strip()):
            return jsonify({"error": "Horario inválido"}), 400

        if not str(final_tel).strip():
            return jsonify({"error": "Celular de contacto requerido"}), 400
        if not str(final_tel).isdigit() or len(str(final_tel)) != 8:
            return jsonify({"error": "Celular debe tener 8 dígitos"}), 400
    else:
        # virtual: si llegan vacíos, ponemos placeholders
        if direccion is not None and not str(direccion).strip():
            direccion = VIRTUAL_DIRECCION
        if horario is not None and not str(horario).strip():
            horario = VIRTUAL_HORARIO

    # ==========
    # actualiza
    # ==========
    if nombre is not None:
        microempresa.nombre = nombre.strip()

    if logo_url is not None:
        logo_url = (logo_url or "").strip()
        if logo_url.startswith("www."):
            logo_url = f"https://{logo_url}"
        if logo_url and not is_valid_url(logo_url):
            return jsonify({"error": "Logo URL inválido"}), 400
        microempresa.logo_url = logo_url or None

    if direccion is not None:
        d = str(direccion).strip()
        if tipo_tienda == "virtual":
            d = d or VIRTUAL_DIRECCION
        microempresa.direccion = d

    if horario is not None:
        h = str(horario).strip()
        if tipo_tienda == "virtual":
            # ✅ aceptamos texto tipo “Atención online”
            h = h or VIRTUAL_HORARIO
            microempresa.horario_atencion = h
        else:
            # fisica: ya validamos arriba
            microempresa.horario_atencion = h

    if telefono_contacto is not None:
        telefono_contacto = str(telefono_contacto).strip()
        if telefono_contacto:
            if not telefono_contacto.isdigit() or len(telefono_contacto) != 8:
                return jsonify({"error": "Celular debe tener 8 dígitos"}), 400
            microempresa.telefono_contacto = telefono_contacto
        else:
            microempresa.telefono_contacto = None

    if nombre_prop is not None:
        microempresa.nombre_propietario = nombre_prop.strip()
    if apellido_paterno_prop is not None:
        microempresa.apellido_paterno_propietario = apellido_paterno_prop.strip()
    if apellido_materno_prop is not None:
        microempresa.apellido_materno_propietario = (apellido_materno_prop or "").strip() or None

    if email is not None:
        email = email.strip()
        if email and email != microempresa.email:
            return jsonify({"error": "No puedes modificar el email"}), 400

    if password:
        microempresa.password = hash_password(password)

    # si virtual y no mandaron direccion/horario, garantizamos placeholders
    if tipo_tienda == "virtual":
        microempresa.direccion, microempresa.horario_atencion = _apply_virtual_defaults(
            microempresa.direccion, microempresa.horario_atencion
        )

    db.session.commit()
    return jsonify({"microempresa": microempresa_detail(microempresa)})


@microempresa_bp.post("/api/microempresas/<int:tenant_id>/qr")
def upload_microempresa_qr(tenant_id):
    if not can_access_microempresa(tenant_id):
        return jsonify({"error": "No autorizado"}), 403

    microempresa = Microempresa.query.get_or_404(tenant_id)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Archivo requerido"}), 400

    try:
        path = save_qr_image(file, tenant_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    microempresa.qr_url = path
    db.session.commit()

    payload = microempresa_detail(microempresa)
    if microempresa.qr_url:
        payload["qr_url"] = build_upload_url(microempresa.qr_url)
    return jsonify({"microempresa": payload})


@microempresa_bp.patch("/api/microempresas/<int:tenant_id>/deactivate")
def deactivate_microempresa(tenant_id):
    if not can_access_microempresa(tenant_id):
        return jsonify({"error": "No autorizado"}), 403

    microempresa = Microempresa.query.get_or_404(tenant_id)
    microempresa.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Microempresa dada de baja"})


@microempresa_bp.patch("/api/microempresas/<int:tenant_id>/activate")
def activate_microempresa(tenant_id):
    if not is_super_admin():
        return jsonify({"error": "No autorizado"}), 403

    microempresa = Microempresa.query.get_or_404(tenant_id)
    microempresa.estado = "activo"
    db.session.commit()
    return jsonify({"message": "Microempresa activada"})


@microempresa_bp.delete("/api/microempresas/<int:tenant_id>")
def delete_microempresa(tenant_id):
    if not is_super_admin():
        return jsonify({"error": "No autorizado"}), 403

    microempresa = Microempresa.query.get_or_404(tenant_id)
    microempresa.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Microempresa inactivada"})
