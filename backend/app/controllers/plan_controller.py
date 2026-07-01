from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..extensions import db
from ..models import Plan, SystemSetting
from ..models.plan_caracteristica import PlanCaracteristica
from ..services.auth_service import get_current_role
from ..services.venta_storage_service import build_upload_url, save_system_qr

plan_bp = Blueprint("plan", __name__)

MAX_FEATURES = 12  # puedes cambiarlo
SYSTEM_QR_KEY = "system_qr_path"


def require_super_admin():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "super_usuario":
        return jsonify({"error": "No autorizado"}), 403
    return None


def _get_setting(key: str):
    return SystemSetting.query.filter_by(key=key).first()


def _set_setting(key: str, value: str | None):
    setting = SystemSetting.query.filter_by(key=key).first()
    if not setting:
        setting = SystemSetting(key=key, value=value)
        db.session.add(setting)
    else:
        setting.value = value
    db.session.commit()
    return setting


def parse_price(value):
    try:
        if value is None or value == "":
            return Decimal("0")
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def parse_days(value):
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_features(payload):
    """
    Recibe payload["caracteristicas"] como lista de strings
    y devuelve lista limpia (sin vacíos).
    """
    if "caracteristicas" not in payload:
        return None  # significa "no tocar" en update

    raw = payload.get("caracteristicas")
    if raw is None:
        return []

    if not isinstance(raw, list):
        return "invalid"

    cleaned = []
    for item in raw:
        if item is None:
            continue
        txt = str(item).strip()
        if not txt:
            continue
        if len(txt) > 200:
            return "too_long"
        cleaned.append(txt)

    if len(cleaned) > MAX_FEATURES:
        return "too_many"

    return cleaned


def set_plan_features(plan, features_list):
    """
    Reemplaza características del plan (simple y estable).
    """
    # borrar existentes
    PlanCaracteristica.query.filter_by(id_plan=plan.id_plan).delete(synchronize_session=False)

    # insertar nuevas
    for idx, txt in enumerate(features_list):
        db.session.add(PlanCaracteristica(id_plan=plan.id_plan, texto=txt, orden=idx))


# ==========================
# PUBLICO (solo activos)
# ==========================
@plan_bp.get("/api/plans")
def list_plans():
    plans = Plan.query.filter_by(estado="activo").order_by(Plan.precio.asc()).all()
    return jsonify({"plans": [p.to_dict() for p in plans]}), 200


@plan_bp.get("/api/planes")
def list_planes_alias():
    plans = Plan.query.filter_by(estado="activo").order_by(Plan.precio.asc()).all()
    return jsonify({"planes": [p.to_dict() for p in plans]}), 200


# ==========================
# ADMIN (super_usuario)
# ==========================
@plan_bp.get("/api/admin/plans")
def admin_list_plans():
    error = require_super_admin()
    if error:
        return error

    plans = Plan.query.order_by(Plan.id_plan.asc()).all()
    return jsonify({"plans": [p.to_dict() for p in plans]}), 200


@plan_bp.get("/api/admin/system/qr")
def admin_get_system_qr():
    error = require_super_admin()
    if error:
        return error

    setting = _get_setting(SYSTEM_QR_KEY)
    qr_url = build_upload_url(setting.value) if setting and setting.value else None
    return jsonify({"qr_url": qr_url}), 200


@plan_bp.post("/api/admin/system/qr")
def admin_upload_system_qr():
    error = require_super_admin()
    if error:
        return error

    file = request.files.get("file")
    try:
        path = save_system_qr(file)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    setting = _set_setting(SYSTEM_QR_KEY, path)
    return jsonify({"qr_url": build_upload_url(setting.value)}), 201


@plan_bp.post("/api/admin/plans")
def admin_create_plan():
    error = require_super_admin()
    if error:
        return error

    payload = request.get_json(silent=True) or {}

    nombre = (payload.get("nombre") or "").strip()
    estado = (payload.get("estado") or "activo").strip() or "activo"
    precio_raw = payload.get("precio")
    dias_validez_raw = payload.get("dias_validez")

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    if Plan.query.filter_by(nombre=nombre).first():
        return jsonify({"error": "Ya existe un plan con ese nombre"}), 409

    precio = parse_price(precio_raw)
    if precio is None:
        return jsonify({"error": "Precio inválido"}), 400
    if precio < 0:
        return jsonify({"error": "Precio no puede ser negativo"}), 400

    dias_validez = parse_days(dias_validez_raw)
    if dias_validez is None or dias_validez <= 0:
        return jsonify({"error": "Dias de validez inválido"}), 400

    features = normalize_features(payload)
    if features == "invalid":
        return jsonify({"error": "caracteristicas debe ser una lista"}), 400
    if features == "too_long":
        return jsonify({"error": "Una característica supera 200 caracteres"}), 400
    if features == "too_many":
        return jsonify({"error": f"Máximo {MAX_FEATURES} características"}), 400
    if features is None:
        features = []

    plan = Plan(nombre=nombre, precio=precio, dias_validez=dias_validez, estado=estado)
    db.session.add(plan)
    db.session.flush()  # para tener id_plan

    set_plan_features(plan, features)
    db.session.commit()

    return jsonify({"message": "Plan creado", "plan": plan.to_dict()}), 201


@plan_bp.patch("/api/admin/plans/<int:plan_id>")
def admin_update_plan(plan_id):
    error = require_super_admin()
    if error:
        return error

    plan = Plan.query.get_or_404(plan_id)
    payload = request.get_json(silent=True) or {}

    if "nombre" in payload:
        nombre = (payload.get("nombre") or "").strip()
        if not nombre:
            return jsonify({"error": "Nombre requerido"}), 400

        other = Plan.query.filter(Plan.nombre == nombre, Plan.id_plan != plan_id).first()
        if other:
            return jsonify({"error": "Ya existe otro plan con ese nombre"}), 409

        plan.nombre = nombre

    if "precio" in payload:
        precio = parse_price(payload.get("precio"))
        if precio is None:
            return jsonify({"error": "Precio inválido"}), 400
        if precio < 0:
            return jsonify({"error": "Precio no puede ser negativo"}), 400
        plan.precio = precio

    if "dias_validez" in payload:
        dias_validez = parse_days(payload.get("dias_validez"))
        if dias_validez is None or dias_validez <= 0:
            return jsonify({"error": "Dias de validez inválido"}), 400
        plan.dias_validez = dias_validez

    if "estado" in payload:
        estado = (payload.get("estado") or "").strip()
        if not estado:
            return jsonify({"error": "Estado inválido"}), 400
        plan.estado = estado

    features = normalize_features(payload)
    if features == "invalid":
        return jsonify({"error": "caracteristicas debe ser una lista"}), 400
    if features == "too_long":
        return jsonify({"error": "Una característica supera 200 caracteres"}), 400
    if features == "too_many":
        return jsonify({"error": f"Máximo {MAX_FEATURES} características"}), 400

    if features is not None:
        set_plan_features(plan, features)

    db.session.commit()
    return jsonify({"message": "Plan actualizado", "plan": plan.to_dict()}), 200


@plan_bp.delete("/api/admin/plans/<int:plan_id>")
def admin_delete_plan_logical(plan_id):
    error = require_super_admin()
    if error:
        return error

    plan = Plan.query.get_or_404(plan_id)
    plan.estado = "inactivo"
    db.session.commit()

    return jsonify({"message": "Plan desactivado (eliminación lógica)", "plan": plan.to_dict()}), 200
