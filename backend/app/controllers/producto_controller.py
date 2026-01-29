from flask import Blueprint, jsonify, request
from flask_login import current_user
from sqlalchemy import func

from ..models import Categoria, FotoProducto, Microempresa, Producto, Proveedor, Cliente, ClienteMicroempresa, db
from ..services.auth_service import get_current_role, has_permission
from ..services.product_storage_service import build_producto_foto_url, save_producto_foto
from ..services.venta_storage_service import build_upload_url
from ..services.email_service import send_new_product_email

producto_bp = Blueprint("producto", __name__)


def _tenant_id():
    if not current_user.is_authenticated:
        return None
    if get_current_role(current_user) not in {"microempresa", "empleado"}:
        return None
    return getattr(current_user, "tenant_id", None)


def _require_microempresa():
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    role = get_current_role(current_user)
    if role == "microempresa":
        return None
    if role == "empleado" and has_permission(current_user, "inventario"):
        return None
    return jsonify({"error": "No autorizado"}), 403


def _parse_float(raw):
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _parse_int(raw, default=None):
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _attach_categorias(producto: Producto, categoria_ids):
    if categoria_ids is None:
        return
    ids = [cid for cid in categoria_ids if cid is not None]
    if not ids:
        producto.categorias = []  # type: ignore[assignment]
        return
    categorias = Categoria.query.filter(Categoria.id_categoria.in_(ids)).all()
    producto.categorias = categorias  # type: ignore[assignment]


def _serialize_producto(producto: Producto):
    data = producto.to_dict()
    data["fotos"] = [
        {**foto.to_dict(), "url": build_producto_foto_url(foto.url)} for foto in producto.fotos
    ]
    return data


@producto_bp.get("/api/productos")
def list_productos():
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    productos = Producto.query.filter_by(tenant_id=tenant_id).order_by(Producto.id_producto.desc()).all()

    return jsonify({"productos": [_serialize_producto(p) for p in productos]})


@producto_bp.post("/api/productos")
def create_producto():
    error = _require_microempresa()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    descripcion = (payload.get("descripcion") or "").strip()
    precio = _parse_float(payload.get("precio_unitario"))
    stock = _parse_int(payload.get("stock"), 0)
    stock_minimo = _parse_int(payload.get("stock_minimo"), 0)
    estado = (payload.get("estado") or "activo").strip().lower()
    categoria_ids = payload.get("categoria_ids") or []
    proveedor_id = _parse_int(payload.get("proveedor_id"))
    precio_compra = _parse_float(payload.get("precio_compra"))

    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400
    if precio is None:
        return jsonify({"error": "Precio invalido"}), 400
    if estado not in {"activo", "inactivo"}:
        return jsonify({"error": "Estado invalido"}), 400
    if proveedor_id:
        proveedor = Proveedor.query.filter_by(id_proveedor=proveedor_id, tenant_id=_tenant_id()).first()
        if not proveedor:
            return jsonify({"error": "Proveedor invalido"}), 400
    if precio_compra is not None and precio_compra >= precio:
        return jsonify({"error": "El precio de compra debe ser menor al precio de venta"}), 400

    tenant_id = _tenant_id()

    producto = Producto(
        tenant_id=tenant_id,
        nombre=nombre,
        descripcion=descripcion or None,
        precio_unitario=precio,
        stock=stock or 0,
        stock_inicial=stock or 0,
        stock_minimo=stock_minimo or 0,
        proveedor_id=proveedor_id,
        precio_compra=precio_compra if precio_compra is not None else None,
        estado=estado,
    )

    _attach_categorias(producto, categoria_ids)

    db.session.add(producto)
    db.session.commit()

    # Enviar notificación por email a clientes activos del tenant y seguidores
    # Nota: esto no bloquea la creación del producto si el correo falla
    emails_enviados = 0
    try:
        micro = Microempresa.query.filter_by(tenant_id=tenant_id).first()
        micro_nombre = micro.nombre if micro and micro.nombre else "Microempresa"

        # Clientes activos vinculados a esta microempresa
        clientes = (
            Cliente.query
            .filter(Cliente.estado == "activo")
            .join(ClienteMicroempresa, Cliente.id_cliente == ClienteMicroempresa.id_cliente)
            .filter(ClienteMicroempresa.tenant_id == tenant_id)
            .all()
        )

        # Deduplicar por email para evitar enviar 2 veces al mismo correo
        seen = set()
        for c in clientes:
            email = (c.email or "").strip().lower()
            if not email or email in seen:
                continue
            seen.add(email)

            send_new_product_email(
                to_email=c.email,
                micro_nombre=micro_nombre,
                producto_nombre=producto.nombre,
                precio=float(producto.precio_unitario or 0),
                cliente_nombre=c.nombre,
            )
            emails_enviados += 1

    except Exception:
        emails_enviados = 0

    return jsonify({"producto": _serialize_producto(producto), "emails_enviados": emails_enviados}), 201


@producto_bp.put("/api/productos/<int:producto_id>")
def update_producto(producto_id):
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    producto = Producto.query.filter_by(id_producto=producto_id, tenant_id=tenant_id).first()
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    payload = request.get_json(silent=True) or {}

    nombre = payload.get("nombre")
    descripcion = payload.get("descripcion")
    precio = payload.get("precio_unitario")
    stock = payload.get("stock")
    stock_minimo = payload.get("stock_minimo")
    estado = payload.get("estado")
    categoria_ids = payload.get("categoria_ids")
    proveedor_id = payload.get("proveedor_id")
    precio_compra = payload.get("precio_compra")

    if nombre is not None:
        nombre = nombre.strip()
        if not nombre:
            return jsonify({"error": "Nombre requerido"}), 400
        producto.nombre = nombre

    if descripcion is not None:
        producto.descripcion = descripcion.strip() or None

    if precio is not None:
        parsed = _parse_float(precio)
        if parsed is None:
            return jsonify({"error": "Precio invalido"}), 400
        producto.precio_unitario = parsed
        if producto.precio_compra is not None and producto.precio_compra >= producto.precio_unitario:
            return jsonify({"error": "El precio de compra debe ser menor al precio de venta"}), 400

    if stock is not None:
        parsed = _parse_int(stock)
        if parsed is None:
            return jsonify({"error": "Stock invalido"}), 400
        if producto.stock_inicial is None:
            producto.stock_inicial = producto.stock
        producto.stock = parsed

    if stock_minimo is not None:
        parsed = _parse_int(stock_minimo)
        if parsed is None:
            return jsonify({"error": "Stock minimo invalido"}), 400
        producto.stock_minimo = parsed

    if proveedor_id is not None:
        if str(proveedor_id).strip() == "":
            producto.proveedor_id = None
        else:
            parsed = _parse_int(proveedor_id)
            if not parsed:
                return jsonify({"error": "Proveedor invalido"}), 400
            proveedor = Proveedor.query.filter_by(id_proveedor=parsed, tenant_id=tenant_id).first()
            if not proveedor:
                return jsonify({"error": "Proveedor invalido"}), 400
            producto.proveedor_id = parsed

    if precio_compra is not None:
        if str(precio_compra).strip() == "":
            producto.precio_compra = None
        else:
            parsed = _parse_float(precio_compra)
            if parsed is None:
                return jsonify({"error": "Precio compra invalido"}), 400
            if producto.precio_unitario is not None and parsed >= float(producto.precio_unitario):
                return jsonify({"error": "El precio de compra debe ser menor al precio de venta"}), 400
            producto.precio_compra = parsed

    if estado is not None:
        estado = estado.strip().lower()
        if estado not in {"activo", "inactivo"}:
            return jsonify({"error": "Estado invalido"}), 400
        producto.estado = estado

    if categoria_ids is not None:
        _attach_categorias(producto, categoria_ids)

    db.session.commit()
    return jsonify({"producto": _serialize_producto(producto)})


@producto_bp.patch("/api/productos/<int:producto_id>/deactivate")
def deactivate_producto(producto_id):
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    producto = Producto.query.filter_by(id_producto=producto_id, tenant_id=tenant_id).first()
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    producto.estado = "inactivo"
    db.session.commit()
    return jsonify({"message": "Producto inactivado"})


@producto_bp.patch("/api/productos/<int:producto_id>/activate")
def activate_producto(producto_id):
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    producto = Producto.query.filter_by(id_producto=producto_id, tenant_id=tenant_id).first()
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    producto.estado = "activo"
    db.session.commit()
    return jsonify({"message": "Producto activado"})


@producto_bp.post("/api/productos/<int:producto_id>/fotos")
def upload_producto_foto(producto_id):
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    producto = Producto.query.filter_by(id_producto=producto_id, tenant_id=tenant_id).first()
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Archivo requerido"}), 400

    try:
        path = save_producto_foto(file, tenant_id, producto_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    orden = _parse_int(request.form.get("orden"), 0) or 0
    es_principal = str(request.form.get("es_principal") or "").lower() in {"1", "true", "yes"}

    if es_principal:
        FotoProducto.query.filter_by(id_producto=producto_id).update({"es_principal": False})

    foto = FotoProducto(
        id_producto=producto_id,
        url=path,
        orden=orden,
        es_principal=es_principal,
    )
    db.session.add(foto)
    db.session.commit()

    return jsonify({"foto": {**foto.to_dict(), "url": build_producto_foto_url(path)}}), 201


@producto_bp.delete("/api/productos/<int:producto_id>/fotos/<int:foto_id>")
def delete_producto_foto(producto_id, foto_id):
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    producto = Producto.query.filter_by(id_producto=producto_id, tenant_id=tenant_id).first()
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    foto = FotoProducto.query.filter_by(id_foto=foto_id, id_producto=producto_id).first()
    if not foto:
        return jsonify({"error": "Foto no encontrada"}), 404

    db.session.delete(foto)
    db.session.commit()
    return jsonify({"message": "Foto eliminada"})


@producto_bp.get("/api/productos/alerts/stock")
def stock_alerts():
    error = _require_microempresa()
    if error:
        return error

    tenant_id = _tenant_id()
    productos = Producto.query.filter_by(tenant_id=tenant_id, estado="activo").all()
    alerts = [
        p.to_dict(include_relations=False)
        for p in productos
        if p.stock is not None and p.stock <= (p.stock_minimo or 0)
    ]
    return jsonify({"alerts": alerts})


@producto_bp.get("/api/public/productos")
def public_productos():
    tenant_id = request.args.get("tenant_id")
    categoria_id = request.args.get("categoria_id")
    search = (request.args.get("q") or "").strip().lower()

    tenant_id_value = None
    categoria_id_value = None

    try:
        if tenant_id:
            tenant_id_value = int(tenant_id)
    except (TypeError, ValueError):
        tenant_id_value = None

    try:
        if categoria_id:
            categoria_id_value = int(categoria_id)
    except (TypeError, ValueError):
        categoria_id_value = None

    query = (
        db.session.query(Producto)
        .filter(Producto.estado == "activo")
        .filter(Producto.stock > 0)
    )

    if tenant_id_value is not None:
        query = query.filter(Producto.tenant_id == tenant_id_value)

    if categoria_id_value is not None:
        query = query.join(Producto.categorias).filter(Categoria.id_categoria == categoria_id_value)

    if search:
        query = query.filter(func.lower(Producto.nombre).contains(search))

    productos = query.order_by(Producto.id_producto.desc()).all()
    tenant_ids = {producto.tenant_id for producto in productos}
    microempresas = (
        Microempresa.query.filter(Microempresa.tenant_id.in_(tenant_ids)).all()
        if tenant_ids
        else []
    )
    micro_map = {m.tenant_id: m for m in microempresas}

    payload = []
    for producto in productos:
        data = producto.to_dict()
        data["fotos"] = [
            {**foto.to_dict(), "url": build_producto_foto_url(foto.url)} for foto in producto.fotos
        ]
        micro = micro_map.get(producto.tenant_id)
        data["microempresa"] = (
            {
                "tenant_id": micro.tenant_id,
                "nombre": micro.nombre,
                "logo_url": micro.logo_url,
                "qr_url": build_upload_url(micro.qr_url) if getattr(micro, "qr_url", None) else None,
            }
            if micro
            else None
        )
        payload.append(data)

    return jsonify({"productos": payload})


@producto_bp.get("/api/public/productos/<int:producto_id>")
def public_producto_detalle(producto_id):
    producto = Producto.query.filter(
        Producto.id_producto == producto_id,
        Producto.estado == "activo",
        Producto.stock > 0,
    ).first()
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404

    micro = Microempresa.query.filter_by(tenant_id=producto.tenant_id).first()
    data = producto.to_dict()
    data["fotos"] = [
        {**foto.to_dict(), "url": build_producto_foto_url(foto.url)} for foto in producto.fotos
    ]
    data["microempresa"] = (
        {
            "tenant_id": micro.tenant_id,
            "nombre": micro.nombre,
            "logo_url": micro.logo_url,
            "qr_url": build_upload_url(micro.qr_url) if getattr(micro, "qr_url", None) else None,
        }
        if micro
        else None
    )
    return jsonify({"producto": data})
