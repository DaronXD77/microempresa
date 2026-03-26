"""
Servicio de inventario - Manejo de stock
"""
from ..models.base import db
from ..models import ProductoTalla, Producto


def actualizar_stock(id_producto_talla: int, cantidad: int, operacion: str = "sumar"):
    """
    Actualiza el stock de un producto-talla
    operacion: 'sumar' para compras, 'restar' para ventas
    """
    pt = db.session.get(ProductoTalla, id_producto_talla)
    if not pt:
        return False, "Producto-talla no encontrado"
    
    if operacion == "sumar":
        pt.stock += cantidad
    elif operacion == "restar":
        if pt.stock < cantidad:
            return False, "Stock insuficiente"
        pt.stock -= cantidad
    
    db.session.commit()
    return True, "Stock actualizado"


def verificar_stock_suficiente(id_producto_talla: int, cantidad: int) -> bool:
    """Verifica si hay stock suficiente"""
    pt = db.session.get(ProductoTalla, id_producto_talla)
    if not pt:
        return False
    return pt.stock >= cantidad


def get_stock_total_producto(id_producto: int) -> dict:
    """Obtiene el stock total de un producto (suma de todas las tallas)"""
    producto = db.session.get(Producto, id_producto)
    if not producto:
        return None
    
    tallas = ProductoTalla.query.filter_by(id_producto=id_producto, estado=True).all()
    
    stock_total = sum(t.stock for t in tallas)
    stock_minimo_total = sum(t.stock_minimo for t in tallas)
    
    return {
        "id_producto": id_producto,
        "stock_total": stock_total,
        "stock_minimo_total": stock_minimo_total,
        "alerta": stock_total <= stock_minimo_total if stock_minimo_total > 0 else False,
        "tallas": [t.to_dict() for t in tallas]
    }


def productos_con_stock_bajo() -> list:
    """Obtiene productos con stock bajo el minimo"""
    tallas_bajas = ProductoTalla.query.filter(
        ProductoTalla.stock <= ProductoTalla.stock_minimo,
        ProductoTalla.estado == True
    ).all()
    
    productos_ids = list(set([t.id_producto for t in tallas_bajas]))
    
    return [
        get_stock_total_producto(pid)
        for pid in productos_ids
        if get_stock_total_producto(pid)
    ]
