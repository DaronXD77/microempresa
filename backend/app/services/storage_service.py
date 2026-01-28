import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

ALLOWED_EXTS = {".pdf", ".png", ".jpg", ".jpeg"}


def save_comprobante(file_storage, tenant_id: int) -> str:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("Archivo requerido")

    filename = secure_filename(file_storage.filename)
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext not in ALLOWED_EXTS:
        raise ValueError("Formato no permitido. Usa PDF, PNG, JPG o JPEG")

    base_name = f"{uuid.uuid4().hex}{ext}"
    folder = os.path.join(current_app.config["UPLOAD_FOLDER"], "suscripciones", str(tenant_id))
    os.makedirs(folder, exist_ok=True)

    path = os.path.join(folder, base_name)
    file_storage.save(path)
    return path
