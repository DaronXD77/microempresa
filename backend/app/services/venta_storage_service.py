import os
import uuid

from werkzeug.utils import secure_filename
from flask import current_app

from .cloudinary_service import is_configured as cloudinary_configured, upload_file

QR_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
COMPROBANTE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}


def _resolve_upload_root():
    upload_root = current_app.config.get("UPLOAD_FOLDER") or "uploads"
    if not os.path.isabs(upload_root):
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        upload_root = os.path.join(backend_root, upload_root)
    return upload_root


def save_qr_image(file_storage, tenant_id: int) -> str:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("Archivo requerido")

    if cloudinary_configured():
        url = upload_file(file_storage, f"qr/{tenant_id}")
        if url:
            return url

    filename = secure_filename(file_storage.filename)
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext not in QR_EXTS:
        raise ValueError("Formato no permitido. Usa PNG, JPG, JPEG o WEBP")

    base_name = f"{uuid.uuid4().hex}{ext}"
    upload_root = _resolve_upload_root()
    folder = os.path.join(upload_root, "qr", str(tenant_id))
    os.makedirs(folder, exist_ok=True)

    path = os.path.join(folder, base_name)
    file_storage.save(path)
    return path


def save_system_qr(file_storage) -> str:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("Archivo requerido")

    if cloudinary_configured():
        url = upload_file(file_storage, "system/qr")
        if url:
            return url

    filename = secure_filename(file_storage.filename)
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext not in QR_EXTS:
        raise ValueError("Formato no permitido. Usa PNG, JPG, JPEG o WEBP")

    base_name = f"{uuid.uuid4().hex}{ext}"
    upload_root = _resolve_upload_root()
    folder = os.path.join(upload_root, "system", "qr")
    os.makedirs(folder, exist_ok=True)

    path = os.path.join(folder, base_name)
    file_storage.save(path)
    return path


def save_comprobante(file_storage, venta_id: int) -> str:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("Archivo requerido")

    if cloudinary_configured():
        url = upload_file(file_storage, f"comprobantes/{venta_id}")
        if url:
            return url

    filename = secure_filename(file_storage.filename)
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext not in COMPROBANTE_EXTS:
        raise ValueError("Formato no permitido. Usa PNG, JPG, JPEG, WEBP o PDF")

    base_name = f"{uuid.uuid4().hex}{ext}"
    upload_root = _resolve_upload_root()
    folder = os.path.join(upload_root, "comprobantes", str(venta_id))
    os.makedirs(folder, exist_ok=True)

    path = os.path.join(folder, base_name)
    file_storage.save(path)
    return path


def build_upload_url(path: str) -> str:
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("/uploads/"):
        return path
    base = current_app.config.get("UPLOAD_FOLDER") or "uploads"
    base = os.path.abspath(base)
    if os.path.isabs(path):
        if path.startswith(base):
            rel = os.path.relpath(path, base)
            return f"/uploads/{rel.replace(os.sep, '/')}"
    else:
        normalized = path.replace("\\", "/").lstrip("/")
        if normalized.startswith("uploads/"):
            normalized = normalized[len("uploads/"):]
            return f"/uploads/{normalized}"
    normalized = path.replace("\\", "/")
    idx = normalized.lower().find("/uploads/")
    if idx != -1:
        return normalized[idx:]
    return normalized
