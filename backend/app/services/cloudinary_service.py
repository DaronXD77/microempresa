import os

import cloudinary
import cloudinary.uploader


def is_configured() -> bool:
    return all(
        os.environ.get(key)
        for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
    )


def _ensure_config():
    if not is_configured():
        return False
    cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    return True


def upload_file(file_storage, folder: str, public_id: str | None = None) -> str | None:
    if not file_storage or not getattr(file_storage, "filename", ""):
        raise ValueError("Archivo requerido")

    if not _ensure_config():
        return None

    options = {
        "folder": folder,
        "resource_type": "auto",
    }
    if public_id:
        options["public_id"] = public_id

    result = cloudinary.uploader.upload(file_storage, **options)
    return result.get("secure_url") or result.get("url")
