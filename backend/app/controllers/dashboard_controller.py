# dashboard_controller.py
from flask import Blueprint, jsonify, session
from flask_login import current_user

from ..models import AdminSu, Cliente, ClienteMicroempresa, Microempresa, Producto, db
from ..services.auth_service import guest_payload, serialize_user

dashboard_bp = Blueprint("dashboard", __name__)


def resolve_identity():
    if current_user.is_authenticated:
        return serialize_user(current_user)
    if session.get("guest"):
        return guest_payload(), "cliente"
    return None, None


@dashboard_bp.get("/api/dashboard")
def dashboard():
    user_data, user_role = resolve_identity()

    if user_role == "super_usuario":
        microempresas = Microempresa.query.order_by(Microempresa.nombre).all()
        clientes = Cliente.query.order_by(Cliente.nombre).all()
        admins = AdminSu.query.order_by(AdminSu.apellido_paterno, AdminSu.nombre).all()

        relaciones = (
            db.session.query(ClienteMicroempresa, Microempresa)
            .join(Microempresa, Microempresa.tenant_id == ClienteMicroempresa.tenant_id)
            .all()
        )
        clientes_map = {}
        for rel, micro in relaciones:
            clientes_map.setdefault(rel.id_cliente, []).append(
                {
                    "tenant_id": micro.tenant_id,
                    "nombre": micro.nombre,
                }
            )

        return jsonify(
            {
                "role": user_role,
                "counts": {
                    "microempresas": len(microempresas),
                    "clientes": len(clientes),
                },
                "admins": [
                    {
                        "id_su": admin.id_su,
                        "nombre": admin.nombre,
                        "apellido_paterno": admin.apellido_paterno,
                        "apellido_materno": admin.apellido_materno,
                        "email": admin.email,
                        "estado": admin.estado,
                    }
                    for admin in admins
                ],
                "microempresas": [
                    {
                        "tenant_id": m.tenant_id,
                        "nombre": m.nombre,
                        "email": m.email,
                        "estado": m.estado,
                        "tipo_tienda": getattr(m, "tipo_tienda", None),
                        "direccion": m.direccion,
                        "horario_atencion": m.horario_atencion,
                    }
                    for m in microempresas
                ],
                "clientes": [
                    {
                        "id": c.id_cliente,
                        "tenant_id": (clientes_map.get(c.id_cliente) or [{}])[0].get("tenant_id"),
                        "microempresa_nombre": (clientes_map.get(c.id_cliente) or [{}])[0].get("nombre"),
                        "microempresas": clientes_map.get(c.id_cliente, []),
                        "nombre": c.nombre,
                        "apellido_paterno": c.apellido_paterno,
                        "apellido_materno": c.apellido_materno,
                        "ci": c.ci,
                        "razon_social": c.razon_social,
                        "es_generico": c.es_generico,
                        "email": c.email,
                        "estado": c.estado,
                        "creation_source": c.creation_source,
                    }
                    for c in clientes
                ],
            }
        )

    if user_role == "microempresa":
        tenant_id = user_data.get("tenant_id") if isinstance(user_data, dict) else None
        if tenant_id is None:
            return jsonify({"error": "Tenant inválido"}), 400

        productos_count = Producto.query.filter_by(tenant_id=tenant_id).count()
        clientes_count = (
            ClienteMicroempresa.query
            .filter_by(tenant_id=tenant_id)
            .count()
        )
        stock_alerts = (
            Producto.query
            .filter(Producto.tenant_id == tenant_id)
            .filter(Producto.estado == "activo")
            .filter(Producto.stock <= Producto.stock_minimo)
            .all()
        )

        return jsonify(
            {
                "role": user_role,
                "microempresa": user_data,
                "counts": {
                    "productos": productos_count,
                    "clientes": clientes_count,
                },
                "stock_alerts": [
                    {
                        "id_producto": p.id_producto,
                        "nombre": p.nombre,
                        "stock": p.stock,
                        "stock_minimo": p.stock_minimo,
                    }
                    for p in stock_alerts
                ],
            }
        )

    if user_role == "cliente":
        microempresas = Microempresa.query.order_by(Microempresa.nombre).all()
        return jsonify(
            {
                "role": user_role,
                "microempresas": [
                    {
                        "tenant_id": m.tenant_id,
                        "nombre": m.nombre,
                        "email": m.email,
                        "tipo_tienda": getattr(m, "tipo_tienda", None),
                        "estado": m.estado,
                    }
                    for m in microempresas
                ],
            }
        )

    return jsonify({"role": None}), 401
