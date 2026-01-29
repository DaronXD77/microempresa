import os
from datetime import datetime, timedelta
import os

from flask import Blueprint, jsonify, send_from_directory, request, current_app, redirect
from flask_login import current_user

from ..extensions import db
from ..models import SuscripcionSolicitud, Microempresa, Plan, Suscripcion
from ..services.auth_service import get_current_role

subscription_review_bp = Blueprint("subscription_review", __name__)


def require_super_admin():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "super_usuario":
        return jsonify({"error": "No autorizado"}), 403
    return None


@subscription_review_bp.get("/api/onboarding/microempresa/pending")
def list_pending_microempresas():
    error = require_super_admin()
    if error:
        return error

    pendientes = (
        db.session.query(SuscripcionSolicitud, Microempresa, Plan)
        .join(Microempresa, Microempresa.tenant_id == SuscripcionSolicitud.tenant_id)
        .outerjoin(Plan, Plan.id_plan == SuscripcionSolicitud.id_plan)
        .filter(SuscripcionSolicitud.estado == "en_espera")
        .order_by(SuscripcionSolicitud.id_solicitud.desc())
        .all()
    )

    items = []
    for sol, micro, plan in pendientes:
        tiene_comprobante = bool(sol.comprobante_path)
        items.append(
            {
                "signup_id": sol.id_solicitud,
                "tenant_id": micro.tenant_id,
                "microempresa": {
                    "nombre": micro.nombre,
                    "email": micro.email,
                    "estado": micro.estado,
                },
                "plan": plan.to_dict() if plan else None,
                "tiene_comprobante": tiene_comprobante,
                "proof_url": f"/api/onboarding/microempresa/proof/{sol.id_solicitud}" if tiene_comprobante else None,
                "creado_en": sol.creado_en.isoformat() if sol.creado_en else None,
            }
        )

    return jsonify({"pendientes": items}), 200


@subscription_review_bp.get("/api/onboarding/microempresa/proof/<int:signup_id>")
def download_proof(signup_id: int):
    error = require_super_admin()
    if error:
        return error

    sol = SuscripcionSolicitud.query.get_or_404(signup_id)
    if not sol.comprobante_path:
        return jsonify({"error": "No hay comprobante"}), 404

    raw_path = sol.comprobante_path
    if raw_path.startswith("http://") or raw_path.startswith("https://"):
        return redirect(raw_path)

    path = os.path.normpath(raw_path)
    if not os.path.isabs(path):
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        path = os.path.normpath(os.path.join(backend_root, path))

    if not os.path.exists(path):
        base = current_app.config.get("UPLOAD_FOLDER") or "uploads"
        if not os.path.isabs(base):
            backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            base = os.path.join(backend_root, base)
        filename = os.path.basename(raw_path)
        candidates = [
            os.path.join(base, "comprobantes", str(sol.tenant_id), filename),
            os.path.join(base, "suscripciones", str(sol.tenant_id), filename),
        ]
        path = next((c for c in candidates if os.path.exists(c)), None)
        if not path:
            return jsonify({"error": "No hay comprobante"}), 404

    directory = os.path.dirname(path)
    filename = os.path.basename(path)
    return send_from_directory(directory, filename, as_attachment=True)


@subscription_review_bp.patch("/api/onboarding/microempresa/<int:tenant_id>/approve")
def approve_microempresa(tenant_id: int):
    error = require_super_admin()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    observacion = (payload.get("observacion") or "").strip()

    micro = Microempresa.query.get_or_404(tenant_id)

    sol = (
        SuscripcionSolicitud.query.filter_by(tenant_id=tenant_id)
        .order_by(SuscripcionSolicitud.id_solicitud.desc())
        .first()
    )
    if not sol or sol.estado != "en_espera":
        return jsonify({"error": "No hay solicitud en espera"}), 400
    if not sol.id_plan:
        return jsonify({"error": "Solicitud sin plan seleccionado"}), 400

    # activar microempresa
    micro.estado = "activo"

    # registrar suscripción activa
    plan = Plan.query.get(sol.id_plan)
    days = int(getattr(plan, "dias_validez", 0) or current_app.config.get("SUBSCRIPTION_DEFAULT_DAYS", 30))
    now = datetime.utcnow()

    sus = Suscripcion(
        tenant_id=tenant_id,
        id_plan=sol.id_plan,
        estado="activa",
        fecha_inicio=now,
        fecha_fin=now + timedelta(days=days),
    )
    db.session.add(sus)

    # marcar solicitud
    sol.estado = "aprobado"
    sol.revisado_en = now
    sol.revisado_por = getattr(current_user, "id_su", None)
    sol.observacion = observacion or None

    db.session.commit()
    return jsonify({"message": "Microempresa aprobada"}), 200


@subscription_review_bp.patch("/api/onboarding/microempresa/<int:tenant_id>/reject")
def reject_microempresa(tenant_id: int):
    error = require_super_admin()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    observacion = (payload.get("observacion") or "").strip()

    micro = Microempresa.query.get_or_404(tenant_id)
    sol = (
        SuscripcionSolicitud.query.filter_by(tenant_id=tenant_id)
        .order_by(SuscripcionSolicitud.id_solicitud.desc())
        .first()
    )
    if not sol or sol.estado != "en_espera":
        return jsonify({"error": "No hay solicitud en espera"}), 400

    micro.estado = "inactivo"

    now = datetime.utcnow()
    sol.estado = "rechazado"
    sol.revisado_en = now
    sol.revisado_por = getattr(current_user, "id_su", None)
    sol.observacion = observacion or None

    db.session.commit()
    return jsonify({"message": "Microempresa rechazada"}), 200
