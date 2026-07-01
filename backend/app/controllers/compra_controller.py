from io import BytesIO

from datetime import timezone

from flask import Blueprint, jsonify, request, send_file
from flask_login import current_user
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from ..models import Compra, DetalleCompra, Producto, Proveedor, db
from ..services.auth_service import get_current_role, has_permission

compra_bp = Blueprint("compra", __name__)


def _format_fecha_local(dt):
    if not dt:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone().strftime("%d/%m/%Y %H:%M")


def _require_perm(perm):
    if not current_user.is_authenticated:
        return jsonify({"error": "No autenticado"}), 401
    role = get_current_role(current_user)
    if role == "microempresa":
        return None
    if role == "empleado" and has_permission(current_user, perm):
        return None
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


@compra_bp.get("/api/compras")
def list_compras():
    error = _require_perm("historial_compras")
    if error:
        error = _require_perm("compras")
        if error:
            return error

    tenant_id = _tenant_id()
    compras = (
        Compra.query
        .filter_by(tenant_id=tenant_id)
        .order_by(Compra.id_compra.desc())
        .all()
    )

    return jsonify({"compras": [c.to_dict() for c in compras]})


@compra_bp.get("/api/compras/<int:compra_id>")
def compra_detalle(compra_id):
    error = _require_perm("historial_compras")
    if error:
        error = _require_perm("compras")
        if error:
            return error

    tenant_id = _tenant_id()
    compra = Compra.query.filter_by(id_compra=compra_id, tenant_id=tenant_id).first()
    if not compra:
        return jsonify({"error": "Compra no encontrada"}), 404

    return jsonify({"compra": compra.to_dict()})


@compra_bp.post("/api/compras")
def create_compra():
    error = _require_perm("compras")
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    proveedor_id = _parse_int(payload.get("proveedor_id"))
    items = payload.get("items") or []

    if not proveedor_id:
        return jsonify({"error": "Proveedor requerido"}), 400

    tenant_id = _tenant_id()
    proveedor = Proveedor.query.filter_by(id_proveedor=proveedor_id, tenant_id=tenant_id).first()
    if not proveedor:
        return jsonify({"error": "Proveedor invalido"}), 400

    if not items:
        return jsonify({"error": "Debes agregar productos"}), 400

    compra = Compra(tenant_id=tenant_id, proveedor_id=proveedor_id, estado="registrada")

    total = 0.0
    detalles = []

    for item in items:
        producto_id = _parse_int(item.get("id_producto"))
        cantidad = _parse_int(item.get("cantidad"), 0) or 0
        precio_unitario = _parse_float(item.get("precio_unitario"))
        lote = (item.get("lote") or "").strip() or None

        if not producto_id:
            return jsonify({"error": "Producto invalido"}), 400
        if cantidad <= 0:
            return jsonify({"error": "Cantidad invalida"}), 400
        if precio_unitario is None:
            return jsonify({"error": "Precio invalido"}), 400

        producto = Producto.query.filter_by(id_producto=producto_id, tenant_id=tenant_id).first()
        if not producto:
            return jsonify({"error": "Producto no encontrado"}), 404

        subtotal = float(cantidad * precio_unitario)
        total += subtotal

        detalle = DetalleCompra(
            id_producto=producto_id,
            cantidad=cantidad,
            precio_unitario=precio_unitario,
            subtotal=subtotal,
            lote=lote,
        )
        detalles.append(detalle)

        # Actualizar producto
        producto.stock = (producto.stock or 0) + cantidad
        producto.precio_compra = precio_unitario
        producto.proveedor_id = proveedor_id

    compra.total = total
    compra.detalles = detalles

    db.session.add(compra)
    db.session.commit()

    return jsonify({"compra": compra.to_dict()}), 201

@compra_bp.get("/api/compras/<int:compra_id>/pdf")
def compra_pdf(compra_id):
    error = _require_perm("historial_compras")
    if error:
        error = _require_perm("compras")
        if error:
            return error

    tenant_id = _tenant_id()
    compra = Compra.query.filter_by(id_compra=compra_id, tenant_id=tenant_id).first()
    if not compra:
        return jsonify({"error": "Compra no encontrada"}), 404

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 40

    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, f"Comprobante de compra #{compra.id_compra}")
    y -= 18
    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Fecha: {_format_fecha_local(compra.fecha)}")
    y -= 14
    proveedor_nombre = compra.proveedor.nombre if compra.proveedor else "-"
    c.drawString(40, y, f"Proveedor: {proveedor_nombre}")
    y -= 20

    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, y, "Producto")
    c.drawString(260, y, "Cantidad")
    c.drawString(340, y, "Precio")
    c.drawString(420, y, "Subtotal")
    y -= 12
    c.setFont("Helvetica", 9)

    for det in compra.detalles:
        if y < 80:
            c.showPage()
            y = height - 40
        nombre = det.producto.nombre if det.producto else f"#{det.id_producto}"
        c.drawString(40, y, nombre[:32])
        c.drawString(260, y, str(det.cantidad))
        c.drawString(340, y, f"Bs {float(det.precio_unitario or 0):.2f}")
        c.drawString(420, y, f"Bs {float(det.subtotal or 0):.2f}")
        y -= 12

    y -= 8
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(520, y, f"Total: Bs {float(compra.total or 0):.2f}")

    c.showPage()
    c.save()
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name=f"compra_{compra.id_compra}.pdf", mimetype="application/pdf")

