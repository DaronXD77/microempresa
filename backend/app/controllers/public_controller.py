from flask import Blueprint, jsonify, request
from flask_login import login_user

from ..models import Categoria, Cliente, ClienteMicroempresa, Microempresa, SystemSetting, db
from ..services.auth_service import hash_password
from ..services.venta_storage_service import build_upload_url
from ..views.cliente_view import cliente_detail

public_bp = Blueprint("public", __name__)
SYSTEM_QR_KEY = "system_qr_path"

@public_bp.get("/api/public/microempresas")
def public_microempresas():
    query = Microempresa.query

    if hasattr(Microempresa, "estado"):
        query = query.filter(Microempresa.estado == "activo")

    items = query.order_by(Microempresa.nombre).all()
    return jsonify({
        "microempresas": [
            {
                "tenant_id": m.tenant_id,
                "nombre": m.nombre,
                "logo_url": m.logo_url,
                "qr_url": build_upload_url(m.qr_url) if getattr(m, "qr_url", None) else None,
                "estado": m.estado,
            }
            for m in items
        ]
    }), 200


@public_bp.get("/api/public/categorias")
def public_categorias():
    categorias = Categoria.query.filter_by(estado="activo").order_by(Categoria.nombre).all()
    return jsonify({"categorias": [c.to_dict() for c in categorias]}), 200


@public_bp.get("/api/public/system/qr")
def public_system_qr():
    setting = SystemSetting.query.filter_by(key=SYSTEM_QR_KEY).first()
    qr_url = build_upload_url(setting.value) if setting and setting.value else None
    return jsonify({"qr_url": qr_url}), 200



@public_bp.post("/api/public/clientes/register")
def public_register_cliente():
    try:
        payload = request.get_json(silent=True) or {}

        tenant_id = payload.get("tenant_id")
        nombre = (payload.get("nombre") or "").strip()
        apellido_paterno = (payload.get("apellido_paterno") or "").strip()
        apellido_materno = (payload.get("apellido_materno") or "").strip()
        ci = (payload.get("ci") or "").strip()
        email = (payload.get("email") or "").strip()
        password = payload.get("password") or ""
        es_empresa = payload.get("es_empresa")
        razon_social = (payload.get("razon_social") or "").strip()

        # Validaciones
        if tenant_id:
            tenant_id = int(tenant_id)
            micro = Microempresa.query.filter_by(tenant_id=tenant_id).first()
            if not micro:
                return jsonify({"error": "Microempresa inválida"}), 400

        if not all([nombre, apellido_paterno, ci, email, password]):
            return jsonify({"error": "Todos los campos son requeridos"}), 400

        if not isinstance(es_empresa, bool):
            return jsonify({"error": "es_empresa debe ser boolean"}), 400

        if es_empresa and not razon_social:
            return jsonify({"error": "Razón social requerida"}), 400

        # Email único global
        if Cliente.query.filter_by(email=email).first():
            return jsonify({"error": "Email ya registrado"}), 409
        if tenant_id:
            exists_ci = (
                ClienteMicroempresa.query
                .join(Cliente, Cliente.id_cliente == ClienteMicroempresa.id_cliente)
                .filter(ClienteMicroempresa.tenant_id == tenant_id)
                .filter(Cliente.ci == ci)
                .first()
            )
            if exists_ci:
                return jsonify({"error": "CI ya registrado en esta microempresa"}), 409

        # Crear cliente
        cliente = Cliente()
        cliente.nombre = nombre
        cliente.apellido_paterno = apellido_paterno
        cliente.apellido_materno = apellido_materno or None
        cliente.ci = ci
        cliente.razon_social = razon_social if es_empresa else None
        cliente.es_generico = False
        cliente.email = email
        cliente.password = hash_password(password)
        cliente.estado = "activo"
        cliente.creation_source = "independiente"
        cliente.temp_password = None

        db.session.add(cliente)
        db.session.flush()

        if tenant_id:
            db.session.add(ClienteMicroempresa(id_cliente=cliente.id_cliente, tenant_id=tenant_id))

        db.session.commit()

        # Loguear
        login_user(cliente)

        return jsonify({
            "role": "cliente",
            "user": cliente_detail(cliente),
            "available_roles": ["cliente"],
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
