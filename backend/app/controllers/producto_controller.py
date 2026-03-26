"""
Controlador de categorias y productos
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user
from ...models.base import db
from ...models import Categoria, Talla, Producto, ProductoTalla, ProductoImagen
from ...services import serialize_user, registrar_auditoria

producto_bp = Blueprint("producto", __name__)


def require_superadmin():
    """Verifica que sea superadmin"""
    if not current_user.is_authenticated:
        return False
    user_data, role = serialize_user(current_user)
    return role == "superadmin"


@producto_bp.get("/api/public/categorias")
def list_categorias():
    """Lista categorias publicas"""
    categorias = Categoria.query.filter_by(estado=True).all()
    return jsonify({"categorias": [c.to_dict() for c in categorias]}), 200


@producto_bp.get("/api/public/productos")
def list_productos_public():
    """Lista productos publicos"""
    stock = request.args.get("stock", "all")
    
    query = Producto.query.filter_by(estado=True)
    
    productos = query.all()
    
    result = []
    for p in productos:
        p_dict = p.to_dict(include_relations=False)
        
        if stock == "disponible":
            stock_total = sum(t.stock for t in p.tallas if t.estado)
            if stock_total <= 0:
                continue
            p_dict["stock_total"] = stock_total
        
        p_dict["imagenes"] = [i.to_dict() for i in p.imagenes]
        result.append(p_dict)
    
    return jsonify({"productos": result}), 200


@producto_bp.get("/api/public/productos/<int:producto_id>")
def get_producto_public(producto_id):
    """Obtiene producto publico"""
    producto = db.session.get(Producto, producto_id)
    if not producto or not producto.estado:
        return jsonify({"error": "Producto no encontrado"}), 404
    
    return jsonify({"producto": producto.to_dict()}), 200


@producto_bp.get("/api/categorias")
def list_categorias_admin():
    """Lista todas las categorias (admin)"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    categorias = Categoria.query.all()
    return jsonify({"categorias": [c.to_dict() for c in categorias]}), 200


@producto_bp.post("/api/categorias")
def create_categoria():
    """Crea categoria"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    descripcion = (payload.get("descripcion") or "").strip()
    
    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400
    
    if Categoria.query.filter_by(nombre=nombre).first():
        return jsonify({"error": "Categoria ya existe"}), 409
    
    categoria = Categoria(nombre=nombre, descripcion=descripcion)
    db.session.add(categoria)
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="crear_categoria",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="categoria",
        id_entidad=categoria.id_categoria,
        detalles={"nombre": nombre}
    )
    
    return jsonify({"categoria": categoria.to_dict()}), 201


@producto_bp.put("/api/categorias/<int:categoria_id>")
def update_categoria(categoria_id):
    """Actualiza categoria"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    categoria = db.session.get(Categoria, categoria_id)
    if not categoria:
        return jsonify({"error": "Categoria no encontrada"}), 404
    
    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip()
    descripcion = (payload.get("descripcion") or "").strip()
    estado = payload.get("estado")
    
    if nombre and nombre != categoria.nombre:
        if Categoria.query.filter_by(nombre=nombre).first():
            return jsonify({"error": "Nombre ya existe"}), 409
        categoria.nombre = nombre
    
    if descripcion is not None:
        categoria.descripcion = descripcion
    
    if estado is not None:
        categoria.estado = bool(estado)
    
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="actualizar_categoria",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="categoria",
        id_entidad=categoria.id_categoria,
    )
    
    return jsonify({"categoria": categoria.to_dict()}), 200


@producto_bp.delete("/api/categorias/<int:categoria_id>")
def delete_categoria(categoria_id):
    """Elimina categoria"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    categoria = db.session.get(Categoria, categoria_id)
    if not categoria:
        return jsonify({"error": "Categoria no encontrada"}), 404
    
    categoria.estado = False
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="eliminar_categoria",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="categoria",
        id_entidad=categoria_id,
    )
    
    return jsonify({"message": "Categoria eliminada"}), 200


@producto_bp.get("/api/tallas")
def list_tallas():
    """Lista tallas"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    tallas = Talla.query.all()
    return jsonify({"tallas": [t.to_dict() for t in tallas]}), 200


@producto_bp.post("/api/tallas")
def create_talla():
    """Crea talla"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    nombre = (payload.get("nombre") or "").strip().upper()
    tipo = (payload.get("tipo") or "").strip()
    
    if not nombre:
        return jsonify({"error": "Nombre requerido"}), 400
    
    if Talla.query.filter_by(nombre=nombre).first():
        return jsonify({"error": "Talla ya existe"}), 409
    
    talla = Talla(nombre=nombre, tipo=tipo)
    db.session.add(talla)
    db.session.commit()
    
    return jsonify({"talla": talla.to_dict()}), 201


@producto_bp.get("/api/productos")
def list_productos():
    """Lista productos (admin)"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    productos = Producto.query.all()
    return jsonify({"productos": [p.to_dict() for p in productos]}), 200


@producto_bp.post("/api/productos")
def create_producto():
    """Crea producto"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    payload = request.get_json(silent=True) or {}
    
    nombre = (payload.get("nombre") or "").strip()
    id_categoria = payload.get("id_categoria")
    descripcion = (payload.get("descripcion") or "").strip()
    precio_compra = payload.get("precio_compra")
    precio_venta = payload.get("precio_venta")
    es_textil = payload.get("es_textil", False)
    
    if not all([nombre, id_categoria, precio_compra, precio_venta]):
        return jsonify({"error": "Nombre, categoria, precio compra y venta son requeridos"}), 400
    
    try:
        precio_compra = float(precio_compra)
        precio_venta = float(precio_venta)
        id_categoria = int(id_categoria)
    except (ValueError, TypeError):
        return jsonify({"error": "Valores invalidos"}), 400
    
    if precio_compra <= 0 or precio_venta <= 0:
        return jsonify({"error": "Precios deben ser positivos"}), 400
    
    if precio_venta < precio_compra:
        return jsonify({"error": "Precio de venta debe ser mayor al de compra"}), 400
    
    categoria = db.session.get(Categoria, id_categoria)
    if not categoria or not categoria.estado:
        return jsonify({"error": "Categoria invalida"}), 400
    
    producto = Producto(
        id_categoria=id_categoria,
        nombre=nombre,
        descripcion=descripcion,
        precio_compra=precio_compra,
        precio_venta=precio_venta,
        es_textil=bool(es_textil),
    )
    db.session.add(producto)
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="crear_producto",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="producto",
        id_entidad=producto.id_producto,
        detalles={"nombre": nombre}
    )
    
    return jsonify({"producto": producto.to_dict()}), 201


@producto_bp.put("/api/productos/<int:producto_id>")
def update_producto(producto_id):
    """Actualiza producto"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    producto = db.session.get(Producto, producto_id)
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404
    
    payload = request.get_json(silent=True) or {}
    
    if "nombre" in payload:
        producto.nombre = (payload["nombre"] or "").strip()
    if "id_categoria" in payload:
        producto.id_categoria = int(payload["id_categoria"])
    if "descripcion" in payload:
        producto.descripcion = payload["descripcion"]
    if "precio_compra" in payload:
        producto.precio_compra = float(payload["precio_compra"])
    if "precio_venta" in payload:
        producto.precio_venta = float(payload["precio_venta"])
    if "es_textil" in payload:
        producto.es_textil = bool(payload["es_textil"])
    if "estado" in payload:
        producto.estado = bool(payload["estado"])
    
    db.session.commit()
    
    user_data, role = serialize_user(current_user)
    registrar_auditoria(
        accion="actualizar_producto",
        id_usuario=user_data.get("id_superadmin"),
        tipo_usuario="superadmin",
        entidad_afectada="producto",
        id_entidad=producto_id,
    )
    
    return jsonify({"producto": producto.to_dict()}), 200


@producto_bp.post("/api/productos/<int:producto_id>/tallas")
def add_talla_producto(producto_id):
    """Agrega talla a producto"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    producto = db.session.get(Producto, producto_id)
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404
    
    payload = request.get_json(silent=True) or {}
    id_talla = payload.get("id_talla")
    stock = payload.get("stock", 0)
    stock_minimo = payload.get("stock_minimo", 0)
    
    if not id_talla:
        return jsonify({"error": "Talla requerida"}), 400
    
    existente = ProductoTalla.query.filter_by(
        id_producto=producto_id,
        id_talla=id_talla
    ).first()
    
    if existente:
        return jsonify({"error": "Talla ya existe en producto"}), 409
    
    pt = ProductoTalla(
        id_producto=producto_id,
        id_talla=id_talla,
        stock=int(stock),
        stock_minimo=int(stock_minimo),
    )
    db.session.add(pt)
    db.session.commit()
    
    return jsonify({"producto_talla": pt.to_dict()}), 201


@producto_bp.put("/api/productos/<int:producto_id>/tallas/<int:pt_id>")
def update_talla_producto(producto_id, pt_id):
    """Actualiza stock de talla en producto"""
    if not require_superadmin():
        return jsonify({"error": "No autorizado"}), 401
    
    pt = db.session.get(ProductoTalla, pt_id)
    if not pt or pt.id_producto != producto_id:
        return jsonify({"error": "Talla no encontrada"}), 404
    
    payload = request.get_json(silent=True) or {}
    
    if "stock" in payload:
        pt.stock = int(payload["stock"])
    if "stock_minimo" in payload:
        pt.stock_minimo = int(payload["stock_minimo"])
    if "estado" in payload:
        pt.estado = bool(payload["estado"])
    
    db.session.commit()
    
    return jsonify({"producto_talla": pt.to_dict()}), 200
