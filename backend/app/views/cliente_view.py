from datetime import datetime, timedelta
from ..extensions import db

TEMP_PASS_TTL = timedelta(minutes=10)


def _maybe_clear_temp_password(cliente):
    if not cliente.temp_password:
        return
    if not cliente.temp_password_set_at:
        cliente.temp_password = None
        db.session.commit()
        return
    if datetime.utcnow() - cliente.temp_password_set_at > TEMP_PASS_TTL:
        cliente.temp_password = None
        cliente.temp_password_set_at = None
        db.session.commit()


def cliente_item(cliente):
    _maybe_clear_temp_password(cliente)
    return {
        "id": cliente.id_cliente,
        "nombre": cliente.nombre,
        "apellido_paterno": cliente.apellido_paterno,
        "apellido_materno": cliente.apellido_materno,
        "razon_social": cliente.razon_social,
        "es_generico": cliente.es_generico,
        "ci": cliente.ci,
        "email": cliente.email,
        "estado": cliente.estado,
        "creation_source": cliente.creation_source,
        "temp_password": cliente.temp_password,
    }


def cliente_detail(cliente):
    _maybe_clear_temp_password(cliente)
    return cliente.to_dict()
