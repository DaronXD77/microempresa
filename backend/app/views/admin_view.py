def admin_item(admin):
    return {
        "id_su": admin.id_su,
        "nombre": admin.nombre,
        "apellido_paterno": admin.apellido_paterno,
        "apellido_materno": admin.apellido_materno,
        "email": admin.email,
        "estado": admin.estado,
    }
