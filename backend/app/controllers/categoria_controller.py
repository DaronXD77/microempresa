from flask import Blueprint, jsonify, request
from flask_login import current_user

from ..models import Categoria, db
from ..services.auth_service import get_current_role

categoria_bp = Blueprint("categoria", __name__)


def require_super_admin():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "super_usuario":
        return jsonify({"error": "No autorizado"}), 403
    return None


def _is_microempresa():
    return current_user.is_authenticated and get_current_role(current_user) == "microempresa"


@categoria_bp.get("/api/categorias")
def list_categorias():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autorizado"}), 403

    if get_current_role(current_user) == "super_usuario":
        categorias = Categoria.query.order_by(Categoria.nombre).all()
    else:
        categorias = (
            Categoria.query.filter_by(estado="activo")
            .order_by(Categoria.nombre)
            .all()
        )

    return jsonify({"categorias": [c.to_dict() for c in categorias]})


@categoria_bp.post("/api/categorias")
def create_categoria():
    error = require_super_admin()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400

    existing = Categoria.query.filter_by(nombre=nombre).first()
    if existing:
        return jsonify({"error": "Categoria ya existe"}), 409

    categoria = Categoria(
        nombre=nombre,
        estado="activo",
        id_su=getattr(current_user, "id_su", None),
    )
    db.session.add(categoria)
    db.session.commit()
    return jsonify({"categoria": categoria.to_dict()}), 201


@categoria_bp.put("/api/categorias/<int:categoria_id>")
def update_categoria(categoria_id):
    error = require_super_admin()
    if error:
        return error

    categoria = Categoria.query.get_or_404(categoria_id)
    payload = request.get_json(silent=True) or {}

    nombre = payload.get("nombre")
    estado = payload.get("estado")

    if nombre is not None:
        nombre = nombre.strip()
        if not nombre:
            return jsonify({"error": "Nombre requerido"}), 400
        if nombre != categoria.nombre:
            existing = Categoria.query.filter_by(nombre=nombre).first()
            if existing:
                return jsonify({"error": "Categoria ya existe"}), 409
        categoria.nombre = nombre

    if estado is not None:
        estado = estado.strip().lower()
        if estado not in {"activo", "inactivo"}:
            return jsonify({"error": "Estado invalido"}), 400
        categoria.estado = estado

    db.session.commit()
    return jsonify({"categoria": categoria.to_dict()})


@categoria_bp.patch("/api/categorias/<int:categoria_id>/deactivate")
def deactivate_categoria(categoria_id):
    error = require_super_admin()
    if error:
        return error

    categoria = Categoria.query.get_or_404(categoria_id)
    categoria.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Categoria inactivada"})


@categoria_bp.patch("/api/categorias/<int:categoria_id>/activate")
def activate_categoria(categoria_id):
    error = require_super_admin()
    if error:
        return error

    categoria = Categoria.query.get_or_404(categoria_id)
    categoria.estado = "activo"
    db.session.commit()
    return jsonify({"message": "Categoria activada"})


@categoria_bp.get("/api/categorias/activas")
def list_categorias_activas():
    if not _is_microempresa():
        return jsonify({"error": "No autorizado"}), 403

    categorias = Categoria.query.filter_by(estado="activo").order_by(Categoria.nombre).all()
    return jsonify({"categorias": [c.to_dict() for c in categorias]})
