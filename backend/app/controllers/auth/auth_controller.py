from datetime import datetime
from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_user, logout_user

from ...models import AdminSu, Cliente, Microempresa, Empleado, AuditLog, db
from ...services.auth_service import (
    get_roles_for_email,
    get_user_for_role,
    get_users_by_identifier,
    hash_password,
    is_active_user,
    is_valid_schedule,
    is_valid_url,
    check_microempresa_subscription,
    serialize_user,
)
from ...views.auth import auth_response, guest_response


auth_bp = Blueprint("auth", __name__)


def clear_guest_session():
    session.pop("guest", None)


def _audit_login(user, role):
    _audit_logout()
    name = ""
    email = getattr(user, "email", None)
    if role == "microempresa":
        name = getattr(user, "nombre", "") or "Microempresa"
    elif role == "empleado":
        parts = [getattr(user, "nombre", ""), getattr(user, "apellido_paterno", ""), getattr(user, "apellido_materno", "")]
        name = " ".join([p for p in parts if p]).strip()
    else:
        parts = [getattr(user, "nombre", ""), getattr(user, "apellido_paterno", ""), getattr(user, "apellido_materno", "")]
        name = " ".join([p for p in parts if p]).strip()
    audit = AuditLog(
        user_id=getattr(user, "id_su", None)
        if role == "super_usuario"
        else getattr(user, "id_cliente", None)
        if role == "cliente"
        else getattr(user, "id_empleado", None)
        if role == "empleado"
        else getattr(user, "tenant_id", None),
        role=role,
        nombre=name or None,
        email=email,
        ip=request.remote_addr,
        user_agent=request.headers.get("User-Agent"),
    )
    db.session.add(audit)
    db.session.commit()
    session["audit_id"] = audit.id_audit


def _audit_logout():
    audit_id = session.pop("audit_id", None)
    if not audit_id:
        return
    audit = AuditLog.query.filter_by(id_audit=audit_id).first()
    if audit and not audit.logout_at:
        audit.logout_at = datetime.utcnow()
        db.session.commit()


def _subscription_required_response(microempresa, solicitud):
    return (
        jsonify({
            "error": "Suscripción vencida o pendiente. Selecciona un plan para continuar.",
            "subscription_required": True,
            "tenant_id": getattr(microempresa, "tenant_id", None),
            "signup_id": getattr(solicitud, "id_solicitud", None),
        }),
        402,
    )


@auth_bp.post("/api/register")
def register():
    payload = request.get_json(silent=True) or {}
    role = payload.get("role", "microempresa")
    clear_guest_session()

    if role == "microempresa":
        nombre = (payload.get("nombre") or "").strip()
        logo_url = (payload.get("logo_url") or "").strip()
        direccion = (payload.get("direccion") or "").strip()
        horario = (payload.get("horario_atencion") or "").strip()
        nombre_prop = (payload.get("nombre_propietario") or "").strip()
        apellido_paterno_prop = (payload.get("apellido_paterno_propietario") or "").strip()
        apellido_materno_prop = (payload.get("apellido_materno_propietario") or "").strip()
        email = (payload.get("email") or "").strip()
        password = payload.get("password") or ""

        if not all(
            [
                nombre,
                direccion,
                horario,
                nombre_prop,
                apellido_paterno_prop,
                email,
                password,
            ]
        ):
            return jsonify({"error": "Todos los campos son requeridos"}), 400
        if logo_url and not is_valid_url(logo_url):
            return jsonify({"error": "Logo URL inválido"}), 400
        if not is_valid_schedule(horario):
            return jsonify({"error": "Horario inválido"}), 400

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
            email=email,
            password=hash_password(password),
            estado="activo",
        )
        db.session.add(microempresa)
        db.session.commit()
        login_user(microempresa)
        _audit_login(microempresa, "microempresa")
        available_roles = get_roles_for_email(microempresa.email, microempresa.password)
        return auth_response(microempresa.to_dict(), "microempresa", available_roles, 201)

    if role == "super_usuario":
        nombre = (payload.get("nombre") or "").strip()
        apellido_paterno = (payload.get("apellido_paterno") or "").strip()
        apellido_materno = (payload.get("apellido_materno") or "").strip()
        email = (payload.get("email") or "").strip()
        password = payload.get("password") or ""

        if not all([nombre, apellido_paterno, email, password]):
            return (
                jsonify({"error": "Nombre y apellido paterno son requeridos"}),
                400,
            )

        if AdminSu.query.filter_by(email=email).first():
            return jsonify({"error": "Email ya registrado"}), 409

        admin_user = AdminSu(
            nombre=nombre,
            apellido_paterno=apellido_paterno,
            apellido_materno=apellido_materno or None,
            email=email,
            password=hash_password(password),
            estado="activo",
        )
        db.session.add(admin_user)
        db.session.commit()
        login_user(admin_user)
        _audit_login(admin_user, "super_usuario")
        available_roles = get_roles_for_email(admin_user.email, admin_user.password)
        return auth_response(admin_user.to_dict(), "super_usuario", available_roles, 201)

    if role == "cliente":
        nombre = (payload.get("nombre") or "").strip()
        apellido_paterno = (payload.get("apellido_paterno") or "").strip()
        apellido_materno = (payload.get("apellido_materno") or "").strip()
        ci = (payload.get("ci") or "").strip()
        razon_social = (payload.get("razon_social") or "").strip()
        email = (payload.get("email") or "").strip()
        password = payload.get("password") or ""
        es_empresa = payload.get("es_empresa")
        es_generico = payload.get("es_generico", False)

        if not all([nombre, apellido_paterno, ci, email, password]):
            return jsonify({"error": "Todos los campos son requeridos"}), 400
        if not isinstance(es_empresa, bool):
            return jsonify({"error": "es_empresa debe ser boolean"}), 400
        if es_empresa and not razon_social:
            return jsonify({"error": "Razón social requerida"}), 400
        if es_generico is not None and not isinstance(es_generico, bool):
            return jsonify({"error": "es_generico debe ser boolean"}), 400

        if Cliente.query.filter_by(email=email).first():
            return jsonify({"error": "Email ya registrado"}), 409
        if Cliente.query.filter_by(ci=ci).first():
            return jsonify({"error": "CI ya registrado"}), 409

        cliente = Cliente(
            nombre=nombre,
            apellido_paterno=apellido_paterno,
            apellido_materno=apellido_materno or None,
            ci=ci,
            razon_social=razon_social or None,
            es_generico=bool(es_generico),
            email=email,
            password=hash_password(password),
            estado="activo",
        )
        db.session.add(cliente)
        db.session.commit()
        login_user(cliente)
        _audit_login(cliente, "cliente")
        available_roles = get_roles_for_email(cliente.email, cliente.password)
        return auth_response(cliente.to_dict(), "cliente", available_roles, 201)

    return jsonify({"error": "Rol inválido"}), 400


@auth_bp.post("/api/login")
def login():
    payload = request.get_json(silent=True) or {}
    identifier = (payload.get("username") or payload.get("email") or "").strip()
    password = payload.get("password") or ""
    role = payload.get("role")

    if not identifier or not password:
        return jsonify({"error": "Usuario y password son requeridos"}), 400

    password_hash = hash_password(password)
    clear_guest_session()

    if role:
        user = get_user_for_role(role, identifier)
        if (
            not user
            or not user.password
            or user.password != password_hash
            or not is_active_user(user)
        ):
            return jsonify({"error": "Credenciales inválidas"}), 401

        if role == "microempresa":
            ok, solicitud = check_microempresa_subscription(user)
            if not ok:
                return _subscription_required_response(user, solicitud)

        login_user(user)
        _audit_login(user, role)
        user_data, user_role = serialize_user(user)
        available_roles = get_roles_for_email(user.email, user.password)
        return auth_response(user_data, user_role, available_roles)

    users_by_role = get_users_by_identifier(identifier)
    available_roles = [
        role_key
        for role_key, user in users_by_role.items()
        if user and user.password and user.password == password_hash and is_active_user(user)
    ]

    if not available_roles:
        return jsonify({"error": "Credenciales inválidas"}), 401

    if available_roles == ["microempresa"]:
        user = users_by_role.get("microempresa")
        ok, solicitud = check_microempresa_subscription(user)
        if not ok:
            return _subscription_required_response(user, solicitud)

    if len(available_roles) > 1:
        return jsonify({"select_role": True, "roles": available_roles}), 200

    role_key = available_roles[0]
    user = users_by_role[role_key]
    if not user or not is_active_user(user):
        return jsonify({"error": "Credenciales inválidas"}), 401

    if role_key == "microempresa":
        ok, solicitud = check_microempresa_subscription(user)
        if not ok:
            return _subscription_required_response(user, solicitud)
    login_user(user)
    _audit_login(user, role_key)
    user_data, user_role = serialize_user(user)
    available_roles = get_roles_for_email(user.email, user.password)
    return auth_response(user_data, user_role, available_roles)


@auth_bp.post("/api/guest-login")
def guest_login():
    logout_user()
    _audit_logout()
    session["guest"] = True
    return guest_response()


@auth_bp.post("/api/logout")
def logout():
    _audit_logout()
    logout_user()
    clear_guest_session()
    return jsonify({"message": "Logout OK"}), 200


@auth_bp.get("/api/me")
def me():
    if current_user.is_authenticated:
        user_data, user_role = serialize_user(current_user)
        available_roles = get_roles_for_email(current_user.email, current_user.password)
        return auth_response(user_data, user_role, available_roles)

    if session.get("guest"):
        return guest_response()

    return jsonify({"user": None, "role": None, "available_roles": []}), 200


@auth_bp.post("/api/switch-role")
def switch_role():
    if not current_user.is_authenticated:
        return jsonify({"error": "Rol inválido"}), 401

    payload = request.get_json(silent=True) or {}
    role = payload.get("role")
    if not role:
        return jsonify({"error": "Rol requerido"}), 400

    available_roles = get_roles_for_email(current_user.email, current_user.password)
    if role not in available_roles:
        return jsonify({"error": "Rol inválido"}), 400

    user = get_user_for_role(role, current_user.email)
    if (
        not user
        or not user.password
        or user.password != current_user.password
        or not is_active_user(user)
    ):
        return jsonify({"error": "Credenciales inválidas"}), 401

    if role == "microempresa":
        ok, solicitud = check_microempresa_subscription(user)
        if not ok:
            return _subscription_required_response(user, solicitud)

    login_user(user)
    _audit_login(user, role)
    user_data, user_role = serialize_user(user)
    return auth_response(user_data, user_role, available_roles)
