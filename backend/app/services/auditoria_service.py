"""
Servicio de auditoria - Registra todas las operaciones importantes
"""
import json
from datetime import datetime
from flask import request
from ..models.base import db
from ..models import Auditoria


def registrar_auditoria(
    accion: str,
    id_usuario=None,
    tipo_usuario=None,
    entidad_afectada=None,
    id_entidad=None,
    detalles=None
):
    """Registra una accion en la tabla de auditoria"""
    audit = Auditoria(
        id_usuario=id_usuario,
        tipo_usuario=tipo_usuario,
        accion=accion,
        entidad_afectada=entidad_afectada,
        id_entidad=id_entidad,
        ip_equipo=request.remote_addr,
        nombre_equipo=request.headers.get("Host", ""),
        navegador=request.headers.get("User-Agent", ""),
        detalles=json.dumps(detalles) if detalles else None,
        fecha=datetime.utcnow(),
        zona_horaria="America/La_Paz"
    )
    db.session.add(audit)
    db.session.commit()
    return audit


def get_auditoria(filtros=None, page=1, per_page=50):
    """Obtiene registros de auditoria con filtros"""
    query = Auditoria.query
    
    if filtros:
        if filtros.get("tipo_usuario"):
            query = query.filter_by(tipo_usuario=filtros["tipo_usuario"])
        if filtros.get("accion"):
            query = query.filter_by(accion=filtros["accion"])
        if filtros.get("fecha_inicio"):
            query = query.filter(Auditoria.fecha >= filtros["fecha_inicio"])
        if filtros.get("fecha_fin"):
            query = query.filter(Auditoria.fecha <= filtros["fecha_fin"])
    
    query = query.order_by(Auditoria.fecha.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return {
        "items": [a.to_dict() for a in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "current_page": page
    }
