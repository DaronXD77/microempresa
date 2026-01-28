from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import func, or_

from ..models import Cliente, ClienteMicroempresa, Microempresa, db
from datetime import datetime
from ..services.auth_service import get_current_role, hash_password, has_permission
from ..views.cliente_view import cliente_detail, cliente_item

cliente_bp = Blueprint("cliente", __name__)


def is_super_admin():
    return current_user.is_authenticated and get_current_role(current_user) == "super_usuario"


def is_microempresa():
    if not current_user.is_authenticated:
        return False
    role = get_current_role(current_user)
    if role == "microempresa":
        return True
    if role == "empleado" and has_permission(current_user, "gestion_clientes"):
        return True
    return False


def _tenant_id_backend():
    if is_microempresa():
        return getattr(current_user, "tenant_id", None)
    return None


def can_access_cliente_obj(cliente: Cliente):
    if not current_user.is_authenticated:
        return False

    role = get_current_role(current_user)

    if role == "super_usuario":
        return True

    if role == "microempresa":
        return cliente.tenant_id == getattr(current_user, "tenant_id", None)

    if role == "empleado":
        return (
            has_permission(current_user, "gestion_clientes")
            and cliente.tenant_id == getattr(current_user, "tenant_id", None)
        )

    return role == "cliente" and getattr(current_user, "id_cliente", None) == cliente.id_cliente


@cliente_bp.get("/api/clientes")
def list_clientes():
    """
    - super_usuario: lista todos
    - microempresa: lista SOLO clientes de su tenant
    """
    if not current_user.is_authenticated:
        return jsonify({"error": "No autorizado"}), 403

    role = get_current_role(current_user)

    if role == "super_usuario":
        clientes = Cliente.query.order_by(Cliente.nombre).all()
        return jsonify({"clientes": [cliente_item(c) for c in clientes]})

    if role == "microempresa":
        tenant_id = _tenant_id_backend()
        if tenant_id is None:
            return jsonify({"error": "Tenant inválido"}), 400

        created = Cliente.query.filter_by(tenant_id=tenant_id)
        followed = (
            Cliente.query
            .join(ClienteMicroempresa, Cliente.id_cliente == ClienteMicroempresa.id_cliente)
            .filter(ClienteMicroempresa.tenant_id == tenant_id)
        )
        clientes = created.union(followed).order_by(Cliente.nombre).all()
        return jsonify({"clientes": [cliente_item(c) for c in clientes]})

    return jsonify({"error": "No autorizado"}), 403


@cliente_bp.get("/api/clientes/<int:cliente_id>")
def get_cliente(cliente_id):
    """
    CAMBIO
    - Primero obtienes el cliente
    - Luego validas acceso por rol/tenant
    """
    cliente = Cliente.query.get_or_404(cliente_id)

    if not can_access_cliente_obj(cliente):
        return jsonify({"error": "No autorizado"}), 403

    return jsonify({"cliente": cliente_detail(cliente)})


@cliente_bp.post("/api/clientes")
def create_cliente():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autorizado"}), 403

    role = get_current_role(current_user)

    if role not in {"super_usuario", "microempresa"}:
        return jsonify({"error": "No autorizado"}), 403

    payload = request.get_json(silent=True) or {}

    # enant_id definido por backend
    if role == "microempresa":
        tenant_id = _tenant_id_backend()
        if tenant_id is None:
            return jsonify({"error": "Tenant inválido"}), 400
    else:
        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            return jsonify({"error": "tenant_id requerido para super_usuario"}), 400

    nombre = (payload.get("nombre") or "").strip()
    apellido_paterno = (payload.get("apellido_paterno") or "").strip()
    apellido_materno = (payload.get("apellido_materno") or "").strip()
    ci = (payload.get("ci") or "").strip()
    razon_social = (payload.get("razon_social") or "").strip()
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    es_empresa = payload.get("es_empresa")
    es_generico = payload.get("es_generico", False)

    if not all([nombre, apellido_materno, ci, email, password]):
        return jsonify({"error": "Todos los campos son requeridos"}), 400
    if not isinstance(es_empresa, bool):
        return jsonify({"error": "es_empresa debe ser boolean"}), 400
    if es_empresa and not razon_social:
        return jsonify({"error": "Razón social requerida"}), 400
    if es_generico is not None and not isinstance(es_generico, bool):
        return jsonify({"error": "es_generico debe ser boolean"}), 400

    # Email único global
    if Cliente.query.filter_by(email=email).first():
        return jsonify({"error": "Email ya registrado"}), 409
    if Cliente.query.filter_by(tenant_id=tenant_id, ci=ci).first():
        return jsonify({"error": "CI ya registrado en esta microempresa"}), 409

    creation_source = "microempresa" if role == "microempresa" else "independiente"
    temp_password = password if creation_source == "microempresa" else None
    temp_password_set_at = datetime.utcnow() if temp_password else None

    cliente = Cliente(
        tenant_id=tenant_id,
        nombre=nombre,
        apellido_paterno=apellido_paterno,
        apellido_materno=apellido_materno,
        ci=ci,
        razon_social=razon_social or None,
        es_generico=bool(es_generico),
        email=email,
        password=hash_password(password),
        force_password_reset=False,
        creation_source=creation_source,
        temp_password=temp_password,
        temp_password_set_at=temp_password_set_at,
        estado="activo",
    )

    db.session.add(cliente)
    db.session.flush()

    if role == "microempresa" and tenant_id:
        db.session.add(
            ClienteMicroempresa(id_cliente=cliente.id_cliente, tenant_id=tenant_id)
        )

    db.session.commit()
    return jsonify({"cliente": cliente_detail(cliente)}), 201


def _require_cliente_role():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autorizado"}), 403
    if get_current_role(current_user) != "cliente":
        return jsonify({"error": "No autorizado"}), 403
    return None


@cliente_bp.get("/api/clientes/following")
def list_followed_microempresas():
    error = _require_cliente_role()
    if error:
        return error

    cliente_id = getattr(current_user, "id_cliente", None)
    microempresas = (
        Microempresa.query
        .join(ClienteMicroempresa, Microempresa.tenant_id == ClienteMicroempresa.tenant_id)
        .filter(ClienteMicroempresa.id_cliente == cliente_id)
        .order_by(Microempresa.nombre)
        .all()
    )

    return jsonify({
        "microempresas": [
            {
                "tenant_id": m.tenant_id,
                "nombre": m.nombre,
                "logo_url": m.logo_url,
                "email": m.email,
                "estado": m.estado,
            }
            for m in microempresas
        ]
    })


@cliente_bp.post("/api/clientes/follow")
def follow_microempresa():
    error = _require_cliente_role()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        return jsonify({"error": "tenant_id requerido"}), 400

    try:
        tenant_id = int(tenant_id)
    except (TypeError, ValueError):
        return jsonify({"error": "tenant_id inválido"}), 400

    micro = Microempresa.query.filter_by(tenant_id=tenant_id).first()
    if not micro:
        return jsonify({"error": "Microempresa inválida"}), 400

    cliente_id = getattr(current_user, "id_cliente", None)
    existing = ClienteMicroempresa.query.filter_by(
        id_cliente=cliente_id, tenant_id=tenant_id
    ).first()
    if not existing:
        db.session.add(ClienteMicroempresa(id_cliente=cliente_id, tenant_id=tenant_id))
        db.session.commit()

    return jsonify({"message": "Suscrito"}), 201


@cliente_bp.delete("/api/clientes/follow/<int:tenant_id>")
def unfollow_microempresa(tenant_id):
    error = _require_cliente_role()
    if error:
        return error

    cliente_id = getattr(current_user, "id_cliente", None)
    relation = ClienteMicroempresa.query.filter_by(
        id_cliente=cliente_id, tenant_id=tenant_id
    ).first()
    if relation:
        db.session.delete(relation)
        db.session.commit()

    return jsonify({"message": "Dejado de seguir"})


@cliente_bp.put("/api/clientes/<int:cliente_id>")
def update_cliente(cliente_id):
    """
    ✅ CAMBIO
    - microempresa solo puede modificar clientes de su tenant
    """
    cliente = Cliente.query.get_or_404(cliente_id)

    if not can_access_cliente_obj(cliente):
        return jsonify({"error": "No autorizado"}), 403

    payload = request.get_json(silent=True) or {}

    nombre = payload.get("nombre")
    apellido_paterno = payload.get("apellido_paterno")
    apellido_materno = payload.get("apellido_materno")
    ci = payload.get("ci")
    razon_social = payload.get("razon_social")
    email = payload.get("email")
    password = payload.get("password")
    es_empresa = payload.get("es_empresa")
    existing_is_empresa = cliente.razon_social is not None

    if nombre is not None:
        cliente.nombre = nombre.strip()
    if apellido_paterno is not None:
        cliente.apellido_paterno = apellido_paterno.strip()
    if apellido_materno is not None:
        cliente.apellido_materno = apellido_materno.strip()
    if ci is not None:
        ci = (ci or "").strip()
        if not ci:
            return jsonify({"error": "CI requerido"}), 400
        exists_ci = (
            Cliente.query
            .filter(Cliente.tenant_id == cliente.tenant_id)
            .filter(Cliente.ci == ci)
            .filter(Cliente.id_cliente != cliente.id_cliente)
            .first()
        )
        if exists_ci:
            return jsonify({"error": "CI ya registrado en esta microempresa"}), 409
        cliente.ci = ci

    if es_empresa is not None:
        if not isinstance(es_empresa, bool):
            return jsonify({"error": "es_empresa debe ser boolean"}), 400

    if razon_social is not None:
        razon_social = razon_social.strip()
        if es_empresa is True:
            # Empresa → razón social obligatoria
            if not razon_social:
                return jsonify({"error": "Razón social requerida"}), 400
            cliente.razon_social = razon_social
        else:
            # Persona o genérico → no puede tener razón social
            cliente.razon_social = None
            
        if email is not None:
            email = email.strip()

        if not email:
            return jsonify({"error": "Email requerido"}), 400

        # permitir cambiar email si es distinto
        if email != cliente.email:
            exists = Cliente.query.filter(Cliente.email == email).first()
            if exists:
                return jsonify({"error": "Email ya registrado"}), 409

            cliente.email = email

    if password:
        cliente.password = hash_password(password)
        if getattr(cliente, "force_password_reset", None) is not None:
            cliente.force_password_reset = False

    db.session.commit()
    return jsonify({"cliente": cliente_detail(cliente)})


@cliente_bp.get("/api/public/clientes/lookup")
def public_lookup_cliente():
    tenant_id = request.args.get("tenant_id")
    q = (request.args.get("q") or "").strip()

    try:
        tenant_id = int(tenant_id)
    except (TypeError, ValueError):
        return jsonify({"error": "tenant_id invalido"}), 400

    if not q or len(q) < 2:
        return jsonify({"error": "q requerido"}), 400

    q_lower = q.lower()

    full_name = func.lower(
        func.coalesce(Cliente.nombre, "")
        + " "
        + func.coalesce(Cliente.apellido_paterno, "")
        + " "
        + func.coalesce(Cliente.apellido_materno, "")
    )

    filters = [
        func.lower(Cliente.email) == q_lower,
        func.lower(func.coalesce(Cliente.ci, "")).contains(q_lower),
        func.lower(Cliente.nombre).contains(q_lower),
        func.lower(Cliente.apellido_paterno).contains(q_lower),
        func.lower(Cliente.apellido_materno).contains(q_lower),
        full_name.contains(q_lower),
    ]

    cliente = (
        Cliente.query
        .filter(Cliente.tenant_id == tenant_id)
        .filter(or_(*filters))
        .order_by(Cliente.id_cliente.desc())
        .first()
    )

    if not cliente:
        return jsonify({"cliente": None}), 200

    return jsonify({
        "cliente": {
            "id": cliente.id_cliente,
            "nombre": cliente.nombre,
            "apellido_paterno": cliente.apellido_paterno,
            "apellido_materno": cliente.apellido_materno,
            "ci": cliente.ci,
            "email": cliente.email,
            "razon_social": cliente.razon_social,
        }
    })


@cliente_bp.patch("/api/clientes/<int:cliente_id>/deactivate")
def deactivate_cliente(cliente_id):
    """ CAMBIO
    - microempresa solo puede desactivar clientes de su tenant
    """
    cliente = Cliente.query.get_or_404(cliente_id)

    if not can_access_cliente_obj(cliente):
        return jsonify({"error": "No autorizado"}), 403

    cliente.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Cliente dado de baja"})


@cliente_bp.patch("/api/clientes/<int:cliente_id>/activate")
def activate_cliente(cliente_id):
    """ CAMBIO
    - super_usuario o microempresa del mismo tenant
    """
    cliente = Cliente.query.get_or_404(cliente_id)

    if not (is_super_admin() or (is_microempresa() and cliente.tenant_id == _tenant_id_backend())):
        return jsonify({"error": "No autorizado"}), 403

    cliente.estado = "activo"
    db.session.commit()
    return jsonify({"message": "Cliente activado"})


@cliente_bp.delete("/api/clientes/<int:cliente_id>")
def delete_cliente(cliente_id):
    """
    CAMBIO
    Soft-delete (inactivar) permitido para:
    - super_usuario
    - microempresa del mismo tenant
    """
    cliente = Cliente.query.get_or_404(cliente_id)

    if not (is_super_admin() or (is_microempresa() and cliente.tenant_id == _tenant_id_backend())):
        return jsonify({"error": "No autorizado"}), 403

    cliente.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Cliente inactivado"})
