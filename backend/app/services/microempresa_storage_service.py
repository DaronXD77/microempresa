import os
import uuid

from werkzeug.utils import secure_filename
from flask import current_app

from .cloudinary_service import is_configured as cloudinary_configured, upload_file
from .venta_storage_service import build_upload_url


ALLOWED_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def save_microempresa_logo(file_storage, tenant_id: int | None = None) -> str:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("Archivo requerido")

    if cloudinary_configured():
        folder = f"microempresas/{tenant_id or 'pendientes'}"
        url = upload_file(file_storage, folder)
        if url:
            return url

    filename = secure_filename(file_storage.filename)
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    if ext not in ALLOWED_EXTS:
        raise ValueError("Formato no permitido. Usa PNG, JPG, JPEG o WEBP")

    base_name = f"{uuid.uuid4().hex}{ext}"
    upload_root = current_app.config.get("UPLOAD_FOLDER") or "uploads"
    if not os.path.isabs(upload_root):
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        upload_root = os.path.join(backend_root, upload_root)

    folder = os.path.join(upload_root, "microempresas", str(tenant_id or "pendientes"))
    os.makedirs(folder, exist_ok=True)

    path = os.path.join(folder, base_name)
    file_storage.save(path)
    return build_upload_url(path)
