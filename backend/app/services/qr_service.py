"""
Servicio de generacion de QR para pagos
"""
import qrcode
import io
import base64
import os
from flask import current_app


def generar_qr_base64(datos: str) -> str:
    """Genera QR codificado en base64"""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(datos)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def generar_qr_pago(venta_id: int, monto: float) -> str:
    """Genera QR para pago de una venta"""
    url_base = current_app.config.get("QR_GENERICO_URL", "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=")
    datos = f"PAGO_VENTA_{venta_id}_MONTO_{monto}"
    url_qr = f"{url_base}{datos}"
    
    try:
        return generar_qr_base64(datos)
    except Exception:
        return url_qr


def guardar_qr_local(venta_id: int, qr_base64: str, upload_folder: str) -> str:
    """Guarda QR en disco local"""
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)
    
    qr_path = os.path.join(upload_folder, f"qr_venta_{venta_id}.png")
    
    if qr_base64.startswith("data:"):
        qr_base64 = qr_base64.split(",")[1]
    
    qr_bytes = base64.b64decode(qr_base64)
    
    with open(qr_path, "wb") as f:
        f.write(qr_bytes)
    
    return f"/uploads/qr/qr_venta_{venta_id}.png"
