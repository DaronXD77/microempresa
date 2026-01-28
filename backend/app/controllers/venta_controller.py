from datetime import date, datetime, timedelta
import os
import uuid

from flask import Blueprint, jsonify, request, send_from_directory
from flask_login import current_user
from sqlalchemy import func
from ..services.email_service import send_pedido_estado_email

from ..models import (
    Cliente,
    ClienteMicroempresa,
    Microempresa,
    Producto,
    Venta,
    DetalleVenta,
    Pago,
    Entrega,
    EntregaOpcion,
    db,
)
from ..services.auth_service import get_current_role, hash_password, has_permission
from ..services.venta_storage_service import build_upload_url, save_comprobante

venta_bp = Blueprint("venta", __name__)


def _require_microempresa():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "microempresa":
        return jsonify({"error": "No autorizado"}), 403
    return None


def _require_perm(perm):
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    role = get_current_role(current_user)
    if role == "microempresa":
        return None
    if role == "empleado" and has_permission(current_user, perm):
        return None
    return jsonify({"error": "No autorizado"}), 403


def _require_cliente():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "cliente":
        return jsonify({"error": "No autorizado"}), 403
    return None


def _require_super():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    if get_current_role(current_user) != "super_usuario":
        return jsonify({"error": "No autorizado"}), 403
    return None


def _tenant_id():
    if not current_user.is_authenticated:
        return None
    if get_current_role(current_user) not in {"microempresa", "empleado"}:
        return None
    return getattr(current_user, "tenant_id", None)


def _parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _serialize_venta(venta: Venta, tenant_map=None):
    data = venta.to_dict()
    cliente = venta.cliente
    if cliente:
        data["cliente_nombre"] = " ".join(
            [cliente.nombre, cliente.apellido_paterno, cliente.apellido_materno]
        ).strip()
        data["cliente_email"] = cliente.email
        data["cliente_ci"] = cliente.ci
        data["cliente_razon_social"] = cliente.razon_social
    pagos = data.get("pagos") or []
    entregas = data.get("entregas") or []
    detalles = data.get("detalles") or []

    comprobante_url = None
    metodo_pago = None
    if pagos:
        ref = pagos[0].get("referencia")
        if ref:
            comprobante_url = build_upload_url(ref)
        metodo_pago = pagos[0].get("metodo")

    entrega_data = entregas[0] if entregas else None
    estado_envio = entrega_data.get("estado") if entrega_data else venta.estado
    tipo_entrega = entrega_data.get("tipo_entrega") if entrega_data else None

    data["items"] = [
        {
            "id_item": d.get("id_detalle_venta"),
            "id_producto": d.get("id_producto"),
            "nombre": d.get("nombre"),
            "cantidad": d.get("cantidad"),
            "precio_unitario": d.get("precio_unitario"),
            "subtotal": d.get("subtotal"),
        }
        for d in detalles
    ]
    data["comprobante_url"] = comprobante_url
    data["estado_envio"] = estado_envio
    data["metodo_pago"] = metodo_pago
    data["tipo"] = tipo_entrega or "virtual"
    data["created_at"] = data.get("fecha")
    data["entrega"] = entrega_data
    if tenant_map is not None:
        micro = tenant_map.get(venta.tenant_id)
        if micro:
            data["microempresa_nombre"] = micro.nombre
            data["microempresa_email"] = micro.email
            data["microempresa_estado"] = micro.estado
    return data


def _resolve_cliente(payload, tenant_id: int | None):
    if current_user.is_authenticated and get_current_role(current_user) == "cliente":
        return current_user, False, None

    cliente_payload = payload.get("cliente") or {}
    email = (cliente_payload.get("email") or "").strip()
    nombre = (cliente_payload.get("nombre") or "").strip()
    apellido_paterno = (cliente_payload.get("apellido_paterno") or "").strip()
    apellido_materno = (cliente_payload.get("apellido_materno") or "").strip()
    ci = (cliente_payload.get("ci") or "").strip()
    razon_social = (cliente_payload.get("razon_social") or "").strip()
    es_empresa = bool(cliente_payload.get("es_empresa")) if cliente_payload.get("es_empresa") is not None else False

    if not email:
        return None, False, None

    existing = Cliente.query.filter_by(email=email).first()
    if existing:
        if ci and not existing.ci:
            existing.ci = ci
            db.session.commit()
        if tenant_id:
            relation = ClienteMicroempresa.query.filter_by(
                id_cliente=existing.id_cliente,
                tenant_id=tenant_id,
            ).first()
            if not relation:
                db.session.add(ClienteMicroempresa(id_cliente=existing.id_cliente, tenant_id=tenant_id))
                db.session.commit()
        return existing, False, None

    if not ci:
        raise ValueError("CI requerido para crear el cliente")
    if Cliente.query.filter_by(tenant_id=tenant_id, ci=ci).first():
        raise ValueError("CI ya registrado en esta microempresa")

    password = "123456"
    cliente = Cliente(
        tenant_id=tenant_id,
        nombre=nombre or "Cliente",
        apellido_paterno=apellido_paterno or "-",
        apellido_materno=apellido_materno or "-",
        ci=ci,
        razon_social=razon_social or None,
        es_generico=False,
        email=email,
        password=hash_password(password),
        force_password_reset=True,
        creation_source="invitado",
        temp_password=password,
        temp_password_set_at=datetime.utcnow(),
        estado="activo",
    )
    db.session.add(cliente)
    db.session.flush()

    if tenant_id:
        db.session.add(ClienteMicroempresa(id_cliente=cliente.id_cliente, tenant_id=tenant_id))

    db.session.commit()
    return cliente, True, password


def _build_items(items_raw, tenant_id: int):
    items = []
    producto_ids = []
    for item in items_raw or []:
        pid = _parse_int(item.get("id_producto"))
        qty = _parse_int(item.get("cantidad"), 0)
        if not pid or qty <= 0:
            continue
        items.append({"id_producto": pid, "cantidad": qty})
        producto_ids.append(pid)

    if not items:
        return None, "Items requeridos"

    productos = (
        Producto.query.filter(Producto.tenant_id == tenant_id)
        .filter(Producto.id_producto.in_(producto_ids))
        .all()
    )
    producto_map = {p.id_producto: p for p in productos}

    line_items = []
    total = 0
    for item in items:
        producto = producto_map.get(item["id_producto"])
        if not producto:
            return None, "Producto inválido"
        if producto.estado != "activo":
            return None, f"Producto inactivo: {producto.nombre}"
        if producto.stock is not None and producto.stock < item["cantidad"]:
            return None, f"Stock insuficiente para {producto.nombre}"

        precio = float(producto.precio_unitario or 0)
        subtotal = precio * item["cantidad"]
        total += subtotal
        line_items.append({"producto": producto, "cantidad": item["cantidad"], "precio": precio, "subtotal": subtotal})

    return {"items": line_items, "total": total}, None


def _adjust_stock(detalles, tenant_id: int, direction: int):
    if not detalles:
        return
    producto_ids = [d.id_producto for d in detalles if d.id_producto]
    if not producto_ids:
        return
    productos = (
        Producto.query.filter(Producto.tenant_id == tenant_id)
        .filter(Producto.id_producto.in_(producto_ids))
        .all()
    )
    producto_map = {p.id_producto: p for p in productos}
    for detalle in detalles:
        producto = producto_map.get(detalle.id_producto)
        if not producto or producto.stock is None:
            continue
        if direction < 0:
            producto.stock = max(0, (producto.stock or 0) - detalle.cantidad)
        else:
            producto.stock = (producto.stock or 0) + detalle.cantidad


def _create_venta(payload, tenant_id: int, tipo: str, metodo_pago: str, estado_envio: str):
    built, error = _build_items(payload.get("items") or [], tenant_id)
    if error:
        return None, error, None

    try:
        cliente, cliente_creado, temp_password = _resolve_cliente(payload, tenant_id)
    except ValueError as exc:
        return None, str(exc), None
    cliente_nombre = None
    cliente_email = None
    if cliente:
        cliente_nombre = " ".join(
            [cliente.nombre, cliente.apellido_paterno, cliente.apellido_materno]
        ).strip()
        cliente_email = cliente.email
    else:
        raw_cliente = payload.get("cliente") or {}
        cliente_nombre = (raw_cliente.get("nombre") or "").strip() or None
        cliente_email = (raw_cliente.get("email") or "").strip() or None

    venta = Venta(
        tenant_id=tenant_id,
        id_cliente=getattr(cliente, "id_cliente", None),
        fecha=datetime.utcnow(),
        total=built["total"],
        estado=estado_envio,
    )
    db.session.add(venta)
    db.session.flush()

    reduce_stock = estado_envio in {"entregado", "empaquetado"}

    for line in built["items"]:
        producto = line["producto"]
        cantidad = line["cantidad"]
        subtotal = line["subtotal"]

        item = DetalleVenta(
            id_venta=venta.id_venta,
            id_producto=producto.id_producto,
            cantidad=cantidad,
            precio_unitario=line["precio"],
            subtotal=subtotal,
        )
        if reduce_stock and producto.stock is not None:
            producto.stock = max(0, (producto.stock or 0) - cantidad)
        db.session.add(item)

    pago = Pago(
        id_venta=venta.id_venta,
        monto=built["total"],
        metodo=metodo_pago,
        estado="pagado" if estado_envio in {"pagado", "entregado"} else "pendiente",
    )
    entrega = Entrega(
        id_venta=venta.id_venta,
        tipo_entrega=tipo,
        estado=estado_envio,
    )
    db.session.add(pago)
    db.session.add(entrega)
    db.session.commit()
    credentials = None
    if cliente and cliente_creado and temp_password:
        credentials = {
            "email": cliente.email,
            "password": temp_password,
            "force_password_reset": True,
        }
    return venta, None, credentials


@venta_bp.get("/api/ventas")
def list_ventas():
    error = _require_perm("ventas")
    if error:
        return error

    tenant_id = _tenant_id()
    query = Venta.query.filter_by(tenant_id=tenant_id).order_by(Venta.fecha.desc())

    ventas = query.all()
    total_general = sum(float(v.total or 0) for v in ventas)
    daily_map = {}
    for v in ventas:
        if not v.fecha:
            continue
        key = v.fecha.date().isoformat()
        daily_map[key] = daily_map.get(key, 0) + float(v.total or 0)
    daily_totals = [
        {"date": k, "total": float(v)}
        for k, v in sorted(daily_map.items(), reverse=True)
    ]

    return jsonify({
        "ventas": [_serialize_venta(v) for v in ventas],
        "total_general": float(total_general or 0),
        "daily_totals": daily_totals,
    })


@venta_bp.get("/api/admin/ventas")
def list_ventas_admin():
    error = _require_super()
    if error:
        return error

    tenant_id = _parse_int(request.args.get("tenant_id"))
    date_str = (request.args.get("date") or "").strip()

    query = Venta.query
    if tenant_id:
        query = query.filter(Venta.tenant_id == tenant_id)
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Fecha invalida (YYYY-MM-DD)"}), 400
        query = query.filter(func.date(Venta.fecha) == target_date)

    ventas = query.order_by(Venta.fecha.desc()).all()
    tenant_ids = {v.tenant_id for v in ventas}
    microempresas = (
        Microempresa.query.filter(Microempresa.tenant_id.in_(tenant_ids)).all()
        if tenant_ids
        else []
    )
    tenant_map = {m.tenant_id: m for m in microempresas}

    return jsonify({"ventas": [_serialize_venta(v, tenant_map) for v in ventas]})


@venta_bp.get("/api/admin/ventas/<int:venta_id>")
def get_venta_admin(venta_id):
    error = _require_super()
    if error:
        return error

    venta = Venta.query.get_or_404(venta_id)
    micro = Microempresa.query.filter_by(tenant_id=venta.tenant_id).first()
    tenant_map = {micro.tenant_id: micro} if micro else {}
    return jsonify({"venta": _serialize_venta(venta, tenant_map)})


@venta_bp.get("/api/ventas/pedidos")
def list_pedidos():
    error = _require_perm("pedidos")
    if error:
        return error

    tenant_id = _tenant_id()
    ventas = (
        Venta.query.join(Entrega, Entrega.id_venta == Venta.id_venta)
        .filter(Venta.tenant_id == tenant_id)
        .filter(Entrega.tipo_entrega == "virtual")
        .filter(Venta.estado.in_(["pagado", "empaquetado", "pendiente", "rechazado"]))
        .order_by(Venta.fecha.desc())
        .all()
    )
    return jsonify({"pedidos": [_serialize_venta(v) for v in ventas]})


@venta_bp.get("/api/ventas/mis-pedidos")
def list_mis_pedidos():
    if current_user.is_authenticated and get_current_role(current_user) == "cliente":
        ventas = (
            Venta.query.filter_by(id_cliente=current_user.id_cliente)
            .order_by(Venta.fecha.desc())
            .all()
        )
        return jsonify({"pedidos": [_serialize_venta(v) for v in ventas]})

    email = (request.args.get("email") or "").strip()
    if email:
        clientes = Cliente.query.filter_by(email=email).all()
        ids = [c.id_cliente for c in clientes]
        if ids:
            ventas = (
                Venta.query.filter(Venta.id_cliente.in_(ids))
                .order_by(Venta.fecha.desc())
                .all()
            )
            return jsonify({"pedidos": [_serialize_venta(v) for v in ventas]})

    return jsonify({"pedidos": []})


@venta_bp.post("/api/ventas/pos")
def create_pos():
    error = _require_perm("pos")
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    tenant_id = _tenant_id()
    metodo_pago = (payload.get("metodo_pago") or "efectivo").strip().lower()
    if metodo_pago not in {"efectivo", "qr"}:
        return jsonify({"error": "Metodo de pago invalido"}), 400

    venta, error, credentials = _create_venta(payload, tenant_id, "fisica", metodo_pago, "entregado")
    if error:
        return jsonify({"error": error}), 400

    payload_resp = {"venta": _serialize_venta(venta)}
    if credentials:
        payload_resp["cliente_credentials"] = credentials
    return jsonify(payload_resp), 201


@venta_bp.post("/api/ventas/virtual")
def create_virtual():
    payload = request.get_json(silent=True) or {}
    if not current_user.is_authenticated or get_current_role(current_user) != "cliente":
        return jsonify({"error": "Debes iniciar sesión o registrarte para continuar."}), 401
    tenant_id = _parse_int(payload.get("tenant_id"))
    if not tenant_id:
        return jsonify({"error": "Microempresa requerida"}), 400

    micro = Microempresa.query.filter_by(tenant_id=tenant_id, estado="activo").first()
    if not micro:
        return jsonify({"error": "Microempresa invalida"}), 400

    venta, error, credentials = _create_venta(payload, tenant_id, "virtual", "qr", "pendiente")
    if error:
        return jsonify({"error": error}), 400

    payload_resp = {"venta": _serialize_venta(venta)}
    if credentials:
        payload_resp["cliente_credentials"] = credentials
    return jsonify(payload_resp), 201


@venta_bp.post("/api/ventas/<int:venta_id>/comprobante")
def upload_comprobante(venta_id):
    venta = Venta.query.get_or_404(venta_id)

    token = request.form.get("token") or request.args.get("token")
    if token and token != venta.public_token:
        return jsonify({"error": "Token invalido"}), 403

    if current_user.is_authenticated and get_current_role(current_user) == "cliente":
        if venta.id_cliente and venta.id_cliente != current_user.id_cliente:
            return jsonify({"error": "No autorizado"}), 403

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Archivo requerido"}), 400

    try:
        path = save_comprobante(file, venta_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    pagos = Pago.query.filter_by(id_venta=venta_id).all()
    pago = pagos[0] if pagos else None
    if not pago:
        pago = Pago(id_venta=venta_id, monto=venta.total, metodo="qr", estado="pendiente")
        db.session.add(pago)
    pago.referencia = path
    pago.estado = "pagado"

    venta.estado = "pagado"
    entrega = Entrega.query.filter_by(id_venta=venta_id).first()
    if entrega:
        entrega.estado = "pagado"
    db.session.commit()

    return jsonify({"venta": _serialize_venta(venta)})


@venta_bp.get("/api/ventas/<int:venta_id>/comprobante/download")
def download_comprobante(venta_id):
    venta = Venta.query.get_or_404(venta_id)

    if current_user.is_authenticated:
        role = get_current_role(current_user)
        if role == "cliente":
            if venta.id_cliente and venta.id_cliente != current_user.id_cliente:
                return jsonify({"error": "No autorizado"}), 403
        elif role == "microempresa":
            if venta.tenant_id != getattr(current_user, "tenant_id", None):
                return jsonify({"error": "No autorizado"}), 403
        else:
            return jsonify({"error": "No autorizado"}), 403
    else:
        token = request.args.get("token")
        if not token or token != venta.public_token:
            return jsonify({"error": "No autorizado"}), 403

    pago = Pago.query.filter_by(id_venta=venta_id).first()
    path = pago.referencia if pago else None
    if not path or not os.path.exists(path):
        return jsonify({"error": "Comprobante no encontrado"}), 404

    directory = os.path.dirname(path)
    filename = os.path.basename(path)
    download = str(request.args.get("download") or "").lower() in {"1", "true", "yes"}
    return send_from_directory(directory, filename, as_attachment=download)


@venta_bp.patch("/api/ventas/<int:venta_id>/empaquetar")
def marcar_empaquetado(venta_id):
    error = _require_perm("pedidos")
    if error:
        return error

    tenant_id = _tenant_id()
    venta = Venta.query.filter_by(id_venta=venta_id, tenant_id=tenant_id).first()
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404

    if venta.estado == "entregado":
        return jsonify({"error": "Venta ya entregada"}), 400

    if venta.estado not in {"empaquetado", "entregado"}:
        _adjust_stock(venta.detalles, tenant_id, -1)

    venta.estado = "empaquetado"
    entrega = Entrega.query.filter_by(id_venta=venta_id).first()
    if not entrega:
        return jsonify({"error": "Entrega no encontrada"}), 404

    entrega.estado = "empaquetado"
    payload = request.get_json(silent=True) or {}
    opciones = payload.get("opciones") or []
    if not opciones and not entrega.opciones:
        return jsonify({"error": "Debes registrar al menos una opcion de entrega"}), 400
    if opciones:
        EntregaOpcion.query.filter_by(id_entrega=entrega.id_entrega).delete()
        entrega.seleccion_opcion_id = None
        entrega.seleccion_at = None
        for opt in opciones:
            fecha = (opt.get("fecha") or "").strip()
            hora_inicio = (opt.get("hora_inicio") or "").strip()
            hora_fin = (opt.get("hora_fin") or "").strip()
            lugar = (opt.get("lugar_texto") or opt.get("lugar") or "").strip()
            maps_url = (opt.get("maps_url") or "").strip()
            if not fecha or not hora_inicio or not hora_fin or not lugar or not maps_url:
                return jsonify({"error": "Completa fecha, rango de hora, lugar y link de maps"}), 400
            db.session.add(
                EntregaOpcion(
                    id_entrega=entrega.id_entrega,
                    fecha=fecha,
                    hora_inicio=hora_inicio,
                    hora_fin=hora_fin,
                    lugar_texto=lugar,
                    maps_url=maps_url,
                )
            )
    db.session.commit()
    # Notificar al cliente por correo (si existe)
    if venta.id_cliente:
        try:
            cliente = Cliente.query.filter_by(id_cliente=venta.id_cliente).first()
            micro = Microempresa.query.filter_by(tenant_id=venta.tenant_id).first()
            if cliente and cliente.email and micro:
                send_pedido_estado_email(
                    to_email=cliente.email,
                    cliente_nombre=cliente.nombre,
                    micro_nombre=micro.nombre or "Microempresa",
                    venta_id=venta.id_venta,
                    estado="empaquetado",
                )
        except Exception as e:
            print("ERROR enviando email estado empaquetado:", e)

    return jsonify({"venta": _serialize_venta(venta)})


@venta_bp.patch("/api/ventas/<int:venta_id>/entrega/seleccionar")
def seleccionar_entrega(venta_id):
    venta = Venta.query.get_or_404(venta_id)

    if current_user.is_authenticated and get_current_role(current_user) == "cliente":
        if venta.id_cliente and venta.id_cliente != current_user.id_cliente:
            return jsonify({"error": "No autorizado"}), 403
    else:
        token = request.args.get("token")
        if not token or token != venta.public_token:
            return jsonify({"error": "No autorizado"}), 403

    if venta.estado == "rechazado":
        return jsonify({"error": "Pedido denegado"}), 400
    if venta.estado != "empaquetado":
        return jsonify({"error": "Pedido no disponible para seleccion"}), 400

    entrega = Entrega.query.filter_by(id_venta=venta_id).first()
    if not entrega:
        return jsonify({"error": "Entrega no encontrada"}), 404
    if entrega.seleccion_opcion_id:
        return jsonify({"error": "Ya seleccionaste una opcion"}), 400

    payload = request.get_json(silent=True) or {}
    opcion_id = _parse_int(payload.get("opcion_id"))
    if not opcion_id:
        return jsonify({"error": "Opcion requerida"}), 400
    opcion = EntregaOpcion.query.filter_by(id_opcion=opcion_id, id_entrega=entrega.id_entrega).first()
    if not opcion:
        return jsonify({"error": "Opcion invalida"}), 400

    entrega.seleccion_opcion_id = opcion.id_opcion
    entrega.seleccion_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"venta": _serialize_venta(venta)})


@venta_bp.patch("/api/ventas/<int:venta_id>/entregar")
def marcar_entregado(venta_id):
    venta = Venta.query.get_or_404(venta_id)

    if current_user.is_authenticated and get_current_role(current_user) == "cliente":
        if venta.id_cliente and venta.id_cliente != current_user.id_cliente:
            return jsonify({"error": "No autorizado"}), 403
    else:
        token = request.args.get("token")
        if not token or token != venta.public_token:
            return jsonify({"error": "No autorizado"}), 403

    entrega = Entrega.query.filter_by(id_venta=venta_id).first()
    if entrega:
        if not entrega.seleccion_at or not entrega.seleccion_opcion_id:
            return jsonify({"error": "Debes seleccionar una opcion de entrega"}), 400
        disponible = entrega.seleccion_at + timedelta(minutes=5)
        if datetime.utcnow() < disponible:
            remaining = max(1, int((disponible - datetime.utcnow()).total_seconds() // 60) + 1)
            return jsonify({"error": f"Debes esperar {remaining} min antes de marcar entregado"}), 400

    venta.estado = "entregado"
    if entrega:
        entrega.estado = "entregado"
        entrega.fecha_entrega = datetime.utcnow()
    db.session.commit()
    # Notificar al cliente por correo (si existe)

    # Notificar al cliente por correo (si existe)
    if venta.id_cliente:
        try:
            cliente = Cliente.query.filter_by(id_cliente=venta.id_cliente).first()
            micro = Microempresa.query.filter_by(tenant_id=venta.tenant_id).first()
            if cliente and cliente.email and micro:
                send_pedido_estado_email(
                    to_email=cliente.email,
                    cliente_nombre=cliente.nombre,
                    micro_nombre=micro.nombre or "Microempresa",
                    venta_id=venta.id_venta,
                    estado="entregado",
                )
        except Exception as e:
            print("ERROR enviando email estado entregado:", e)

    return jsonify({"venta": _serialize_venta(venta)})


@venta_bp.patch("/api/ventas/<int:venta_id>/rechazar")
def rechazar_venta(venta_id):
    error = _require_perm("pedidos")
    if error:
        return error

    tenant_id = _tenant_id()
    venta = Venta.query.filter_by(id_venta=venta_id, tenant_id=tenant_id).first()
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404

    if venta.estado in {"empaquetado", "entregado"}:
        _adjust_stock(venta.detalles, tenant_id, 1)

    venta.estado = "rechazado"
    entrega = Entrega.query.filter_by(id_venta=venta_id).first()
    if entrega:
        entrega.estado = "rechazado"
    db.session.commit()
    return jsonify({"venta": _serialize_venta(venta)})
