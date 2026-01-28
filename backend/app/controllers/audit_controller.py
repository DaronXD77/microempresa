from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..models import AuditLog, db
from ..services.auth_service import get_current_role

audit_bp = Blueprint("audit", __name__)


def _require_super():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "super_usuario":
        return jsonify({"error": "No autorizado"}), 403
    return None


@audit_bp.get("/api/admin/auditoria")
def list_auditoria():
    error = _require_super()
    if error:
        return error

    role = (request.args.get("role") or "").strip()
    date_from = (request.args.get("from") or "").strip()
    date_to = (request.args.get("to") or "").strip()

    query = AuditLog.query
    if role:
        query = query.filter(AuditLog.role == role)

    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(AuditLog.login_at >= df)
        except ValueError:
            return jsonify({"error": "Fecha invalida (from)"}), 400

    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(AuditLog.login_at <= dt)
        except ValueError:
            return jsonify({"error": "Fecha invalida (to)"}), 400

    items = query.order_by(AuditLog.login_at.desc()).all()
    return jsonify({"auditoria": [a.to_dict() for a in items]})
