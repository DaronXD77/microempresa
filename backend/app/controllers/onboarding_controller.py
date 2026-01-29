import os
from datetime import datetime

from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import Microempresa, Plan, SuscripcionSolicitud
from ..services.auth_service import hash_password, is_valid_schedule, is_valid_url
from ..services.cloudinary_service import is_configured as cloudinary_configured, upload_file

onboarding_bp = Blueprint("onboarding", __name__)

ALLOWED_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

# Placeholders para tienda virtual (coinciden con frontend)
VIRTUAL_DIRECCION = "Sin tienda física (virtual)"
VIRTUAL_HORARIO = "Atención online"


def _get_upload_root() -> str:
    upload_root = current_app.config.get("UPLOAD_FOLDER") or "uploads"
    if not os.path.isabs(upload_root):
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        upload_root = os.path.join(backend_root, upload_root)
    os.makedirs(upload_root, exist_ok=True)
    return upload_root


def _blocked_edit_state(solicitud: SuscripcionSolicitud) -> bool:
    return (solicitud.estado or "").lower() in {"en_espera", "aprobado", "rechazado"}


def _normalize_tipo_tienda(raw: str) -> str:
    t = (raw or "").strip().lower()
    if t in {"virtual", "v"}:
        return "virtual"
    if t in {"fisica", "física", "f"}:
        return "fisica"
    return ""


def _infer_virtual(tipo_tienda: str, direccion: str, horario: str) -> bool:
    """
    Decide si el registro es virtual.
    - Si viene tipo_tienda (virtual/fisica) lo respetamos.
    - Si no viene, inferimos con marcadores.
    """
    tipo = _normalize_tipo_tienda(tipo_tienda)
    if tipo == "virtual":
        return True
    if tipo == "fisica":
        return False

    h = (horario or "").strip()
    d = (direccion or "").strip()

    # Si horario es válido HH:MM - HH:MM => fisica
    if h and is_valid_schedule(h):
        return False

    low_h = h.lower()
    low_d = d.lower()

    markers = ["online", "virtual", "sin tienda", "sin local", "no disponible", "no aplica"]
    if any(m in low_h for m in markers) or any(m in low_d for m in markers):
        return True

    # si no podemos inferir, se considera fisica (y luego validará horario)
    return False


def _apply_virtual_defaults(direccion: str, horario: str) -> tuple[str, str]:
    d = (direccion or "").strip() or VIRTUAL_DIRECCION
    h = (horario or "").strip() or VIRTUAL_HORARIO
    return d, h


@onboarding_bp.post("/api/onboarding/microempresa/start")
def onboarding_start():
    payload = request.get_json(silent=True) or {}

    signup_id_raw = str(payload.get("signup_id") or ""). strip()

    tipo_tienda_raw = payload.get("tipo_tienda")
    nombre = (payload.get("nombre") or "").strip()
    logo_url = (payload.get("logo_url") or "").strip()
    direccion = (payload.get("direccion") or "").strip()
    horario_atencion = (payload.get("horario_atencion") or "").strip()
    telefono_contacto = (payload.get("telefono_contacto") or "").strip()

    nombre_prop = (payload.get("nombre_propietario") or "").strip()
    ap_pat = (payload.get("apellido_paterno_propietario") or "").strip()
    ap_mat = (payload.get("apellido_materno_propietario") or "").strip()

    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""

    is_virtual = _infer_virtual(tipo_tienda_raw, direccion, horario_atencion)

    # Campos siempre requeridos
    if not all([nombre, nombre_prop, ap_pat, email]):
        return jsonify({"error": "Campos requeridos: nombre, propietario, apellido paterno, email."}), 400

    # Dirección/horario opcionales; si falta, se considera virtual
    if not is_virtual:
        if direccion and horario_atencion:
            if not is_valid_schedule(horario_atencion):
                return jsonify({"error": "Horario inválido"}), 400
        else:
            is_virtual = True

    if is_virtual:
        direccion, horario_atencion = _apply_virtual_defaults(direccion, horario_atencion)

    if logo_url and not is_valid_url(logo_url):
        return jsonify({"error": "Logo URL inválido"}), 400

    if telefono_contacto:
        if not telefono_contacto.isdigit() or len(telefono_contacto) != 8:
            return jsonify({"error": "Celular debe tener 8 dígitos"}), 400

    # ============================
    # 1) MODO EDICION POR signup_id
    # ============================
    if signup_id_raw:
        try:
            signup_id = int(signup_id_raw)
        except ValueError:
            # si viene basura, ignoramos y seguimos al flujo por email
            signup_id = None

        if signup_id:
            solicitud = SuscripcionSolicitud.query.get(signup_id)

            # ✅ si NO existe, ignoramos y seguimos como creación/retomar por email
            if solicitud:
                microempresa = Microempresa.query.get(int(solicitud.tenant_id))
                if not microempresa:
                    solicitud = None
                else:
                    micro_email = (microempresa.email or "").strip().lower()
                    same_email = micro_email == (email or "").strip().lower()

                    if _blocked_edit_state(solicitud):
                        if not same_email:
                            solicitud = None
                        else:
                            return jsonify({"error": "No puedes editar: el comprobante ya fue enviado o el registro ya fue revisado."}), 409

                    if solicitud and (microempresa.estado or "").lower() != "pendiente":
                        if not same_email:
                            solicitud = None
                        else:
                            return jsonify({"error": "No puedes editar: la microempresa ya no está en estado pendiente."}), 409

                if solicitud:
                    other_email = Microempresa.query.filter(
                        Microempresa.email == email,
                        Microempresa.tenant_id != microempresa.tenant_id
                    ).first()
                    if other_email:
                        return jsonify({"error": "Email ya registrado por otra cuenta"}), 409

                    other_name = Microempresa.query.filter(
                        Microempresa.nombre == nombre,
                        Microempresa.tenant_id != microempresa.tenant_id
                    ).first()
                    if other_name:
                        return jsonify({"error": "Microempresa ya existe (nombre en uso)"}), 409

                    microempresa.nombre = nombre
                    microempresa.logo_url = logo_url or None
                    microempresa.direccion = direccion
                    microempresa.horario_atencion = horario_atencion
                    microempresa.nombre_propietario = nombre_prop
                    microempresa.apellido_paterno_propietario = ap_pat
                    microempresa.apellido_materno_propietario = ap_mat or None
                    microempresa.telefono_contacto = telefono_contacto or None
                    microempresa.email = email

                    if password:
                        microempresa.password = hash_password(password)

                    db.session.commit()

                    return jsonify({
                        "message": "Datos actualizados. Ahora selecciona el plan.",
                        "tenant_id": microempresa.tenant_id,
                        "signup_id": solicitud.id_solicitud,
                    }), 200

    # =================================
    # 2) MODO CREACION / RETOMAR POR EMAIL
    # =================================
    existing = Microempresa.query.filter_by(email=email).first()
    if existing:
        if (existing.estado or "").lower() != "pendiente":
            return jsonify({"error": "Email ya registrado"}), 409

        solicitud = (
            SuscripcionSolicitud.query
            .filter_by(tenant_id=existing.tenant_id)
            .order_by(SuscripcionSolicitud.creado_en.desc())
            .first()
        )

        if not solicitud:
            raw_token, token_hash, expires = SuscripcionSolicitud.generate_onboarding_token()
            solicitud = SuscripcionSolicitud(
                tenant_id=existing.tenant_id,
                id_plan=None,
                estado="borrador",
                onboarding_token_hash=token_hash,
                onboarding_expires_at=expires,
                qr_text=None,
                comprobante_path=None,
            )
            db.session.add(solicitud)
            db.session.flush()
        else:
            if _blocked_edit_state(solicitud):
                return jsonify({"error": "No puedes editar: el comprobante ya fue enviado o el registro ya fue revisado."}), 409

        other_name = Microempresa.query.filter(
            Microempresa.nombre == nombre,
            Microempresa.tenant_id != existing.tenant_id
        ).first()
        if other_name:
            return jsonify({"error": "Microempresa ya existe (nombre en uso)"}), 409

        existing.nombre = nombre
        existing.logo_url = logo_url or None
        existing.direccion = direccion
        existing.horario_atencion = horario_atencion
        existing.nombre_propietario = nombre_prop
        existing.apellido_paterno_propietario = ap_pat
        existing.apellido_materno_propietario = ap_mat or None
        existing.telefono_contacto = telefono_contacto or None

        if password:
            existing.password = hash_password(password)

        db.session.commit()

        return jsonify({
            "message": "Registro retomado/actualizado. Ahora selecciona un plan.",
            "tenant_id": existing.tenant_id,
            "signup_id": solicitud.id_solicitud,
        }), 200

    if Microempresa.query.filter_by(nombre=nombre).first():
        return jsonify({"error": "Microempresa ya existe"}), 409

    if not password:
        return jsonify({"error": "Password requerido"}), 400

    microempresa = Microempresa(
        nombre=nombre,
        logo_url=logo_url or None,
        direccion=direccion,
        horario_atencion=horario_atencion,
        nombre_propietario=nombre_prop,
        apellido_paterno_propietario=ap_pat,
        apellido_materno_propietario=ap_mat or None,
        telefono_contacto=telefono_contacto or None,
        email=email,
        password=hash_password(password),
        estado="pendiente",
    )
    db.session.add(microempresa)
    db.session.flush()

    raw_token, token_hash, expires = SuscripcionSolicitud.generate_onboarding_token()

    solicitud = SuscripcionSolicitud(
        tenant_id=microempresa.tenant_id,
        id_plan=None,
        estado="borrador",
        onboarding_token_hash=token_hash,
        onboarding_expires_at=expires,
        qr_text=None,
        comprobante_path=None,
    )
    db.session.add(solicitud)
    db.session.commit()

    return jsonify(
        {
            "message": "Registro iniciado. Ahora selecciona un plan.",
            "tenant_id": microempresa.tenant_id,
            "signup_id": solicitud.id_solicitud,
            "onboarding_token": raw_token,
        }
    ), 201


@onboarding_bp.post("/api/onboarding/microempresa/submit")
def onboarding_submit():
    signup_id = (request.form.get("signup_id") or "").strip()
    id_plan = (request.form.get("id_plan") or "").strip()
    file = request.files.get("file") or request.files.get("comprobante")

    if not signup_id or not id_plan:
        return jsonify({"error": "signup_id e id_plan son requeridos"}), 400
    if not file:
        return jsonify({"error": "Archivo requerido (file)"}), 400

    solicitud = SuscripcionSolicitud.query.get(int(signup_id))
    if not solicitud:
        return jsonify({"error": "signup_id no encontrado"}), 404

    if _blocked_edit_state(solicitud):
        return jsonify({"error": "Ya se envió comprobante o ya fue revisado. No puedes reenviar."}), 409

    plan = Plan.query.get(int(id_plan))
    if not plan or (plan.estado or "").lower() != "activo":
        return jsonify({"error": "Plan inválido"}), 400

    original_name = file.filename or "comprobante"
    filename = secure_filename(original_name)
    ext = os.path.splitext(filename)[1].lower()
    if ext and ext not in ALLOWED_EXTS:
        return jsonify({"error": "Formato no permitido. Usa PDF/JPG/PNG"}), 400

    tenant_id = int(solicitud.tenant_id)
    if cloudinary_configured():
        save_path = upload_file(file, f"suscripciones/{tenant_id}")
    else:
        upload_root = _get_upload_root()
        folder = os.path.join(upload_root, "comprobantes", str(tenant_id))
        os.makedirs(folder, exist_ok=True)

        stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        final_name = f"{stamp}_{filename}" if filename else f"{stamp}_comprobante"
        save_path = os.path.join(folder, final_name)
        file.save(save_path)

    solicitud.id_plan = plan.id_plan
    solicitud.estado = "en_espera"
    solicitud.comprobante_path = save_path

    if not solicitud.qr_text:
        solicitud.qr_text = f"MICROEMPRESA_SAAS|SIGNUP:{solicitud.id_solicitud}|TENANT:{tenant_id}|PLAN:{plan.id_plan}"

    db.session.commit()

    return jsonify({"message": "Comprobante enviado. Tu cuenta queda en espera de validación."}), 200


@onboarding_bp.get("/api/onboarding/microempresa/status")
def onboarding_status():
    signup_id = (request.args.get("signup_id") or "").strip()
    if not signup_id:
        return jsonify({"error": "signup_id requerido"}), 400

    solicitud = SuscripcionSolicitud.query.get(int(signup_id))
    if not solicitud:
        return jsonify({"error": "signup_id no encontrado"}), 404

    msg = {
        "borrador": "Registro iniciado. Falta seleccionar plan y enviar comprobante.",
        "plan_seleccionado": "Plan elegido. Falta enviar comprobante.",
        "en_espera": "En espera de validación por el superusuario.",
        "aprobado": "Cuenta aprobada. Ya puedes iniciar sesión.",
        "rechazado": "Cuenta rechazada. Contacta al administrador.",
    }.get((solicitud.estado or "").lower(), "Estado actualizado.")

    return jsonify(
        {
            "signup_id": solicitud.id_solicitud,
            "tenant_id": solicitud.tenant_id,
            "id_plan": solicitud.id_plan,
            "estado": solicitud.estado,
            "message": msg,
            "tiene_comprobante": bool(solicitud.comprobante_path),
        }
    ), 200
