def microempresa_item(microempresa):
    return {
        "tenant_id": microempresa.tenant_id,
        "nombre": microempresa.nombre,
        "email": microempresa.email,
        "estado": microempresa.estado,
        # ✅ NUEVO
        "tipo_tienda": microempresa.to_dict().get("tipo_tienda"),
        # opcional (si quieres mostrarlo en listas):
        "direccion": microempresa.direccion,
        "horario_atencion": microempresa.horario_atencion,
    }


def microempresa_detail(microempresa):
    data = microempresa.to_dict()
    return data
