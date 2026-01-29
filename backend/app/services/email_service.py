import os
import os
import smtplib
from email.message import EmailMessage
from typing import Optional


def send_email(to_email: str, subject: str, body: str, *, is_html: bool = False):
    host = os.environ.get("MAIL_HOST")
    port = int(os.environ.get("MAIL_PORT", "587"))
    user = os.environ.get("MAIL_USER")
    password = os.environ.get("MAIL_PASS")
    mail_from = os.environ.get("MAIL_FROM", user)

    if not host or not user or not password:
        raise RuntimeError("Faltan variables MAIL_HOST/MAIL_USER/MAIL_PASS en el .env")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = to_email

    # Si es HTML, se manda como alternativa html (y se agrega texto simple como fallback)
    if is_html:
        msg.set_content("Este correo requiere un visor compatible con HTML.")
        msg.add_alternative(body, subtype="html")
    else:
        msg.set_content(body)

    timeout = float(os.environ.get("MAIL_TIMEOUT", "10"))
    with smtplib.SMTP(host, port, timeout=timeout) as server:
        server.ehlo()
        use_tls = os.environ.get("MAIL_USE_TLS", "1") == "1"
        if use_tls:
            server.starttls()
            server.ehlo()
        server.login(user, password)
        server.send_message(msg)


def send_password_reset_email(to_email: str, token: str):
    subject = "Recuperación de contraseña - Microempresa SaaS"
    body = (
        "Hola,\n\n"
        "Recibimos una solicitud para recuperar tu contraseña.\n"
        f"Tu token es: {token}\n\n"
        "Este token expira en 15 minutos.\n"
        "Si tú no solicitaste este cambio, ignora este correo.\n\n"
        "Saludos,\n"
        "Equipo Microempresa SaaS"
    )
    send_email(to_email, subject, body, is_html=False)


def build_new_product_html(
    micro_nombre: str,
    producto_nombre: str,
    precio: float,
    cliente_nombre: Optional[str] = None,
    producto_url: Optional[str] = None,
):
    nombre = (cliente_nombre or "").strip()
    saludo = f"Hola {nombre}," if nombre else "Hola,"

    link_html = (
        f'<p style="margin: 10px 0;"><a href="{producto_url}" target="_blank" rel="noopener noreferrer">Ver producto</a></p>'
        if producto_url
        else "<p style='margin: 10px 0;'>Ingresa a la aplicación para ver más detalles.</p>"
    )

    return f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.4">
      <h2>Nuevo producto disponible</h2>
      <p>{saludo}</p>
      <p><strong>{micro_nombre}</strong> agregó un nuevo producto:</p>
      <p style="font-size: 16px; margin: 8px 0">
        <strong>{producto_nombre}</strong> — Bs {precio:.2f}
      </p>
      {link_html}
      <hr />
      <p style="color:#666; font-size: 12px">Mensaje automático.</p>
    </div>
    """


def build_new_product_text(
    micro_nombre: str,
    producto_nombre: str,
    precio: float,
    cliente_nombre: Optional[str] = None,
    producto_url: Optional[str] = None,
):
    nombre = (cliente_nombre or "").strip()
    saludo = f"Hola {nombre}," if nombre else "Hola,"
    link = f"\nVer producto: {producto_url}\n" if producto_url else ""
    return (
        f"{saludo}\n\n"
        f"{micro_nombre} agregó un nuevo producto:\n"
        f"{producto_nombre} — Bs {precio:.2f}\n"
        f"{link}\n"
        "Ingresa a la aplicación para ver más detalles.\n\n"
        "Mensaje automático."
    )


def send_new_product_email(
    to_email: str,
    micro_nombre: str,
    producto_nombre: str,
    precio: float,
    cliente_nombre: Optional[str] = None,
    producto_url: Optional[str] = None,
):
    subject = f"Nuevo producto: {producto_nombre}"
    html = build_new_product_html(micro_nombre, producto_nombre, precio, cliente_nombre, producto_url)

    # Enviar como HTML real
    send_email(to_email, subject, html, is_html=True)
from typing import Optional

def build_estado_pedido_html(cliente_nombre: Optional[str], micro_nombre: str, venta_id: int, estado: str):
    nombre = (cliente_nombre or "").strip()
    saludo = f"Hola {nombre}," if nombre else "Hola,"
    estado_label = "EMPAQUETADO" if estado == "empaquetado" else "ENTREGADO" if estado == "entregado" else estado.upper()

    return f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.4">
      <h2>Actualización de tu pedido</h2>
      <p>{saludo}</p>
      <p>Tu pedido <strong>#{venta_id}</strong> en <strong>{micro_nombre}</strong> cambió de estado a:</p>
      <p style="font-size: 16px; margin: 8px 0"><strong>{estado_label}</strong></p>
      <p>Ingresa a la aplicación para ver el detalle.</p>
      <hr />
      <p style="color:#666; font-size: 12px">Mensaje automático.</p>
    </div>
    """

def send_pedido_estado_email(to_email: str, cliente_nombre: Optional[str], micro_nombre: str, venta_id: int, estado: str):
    subject = f"Tu pedido #{venta_id} está {estado}"
    html = build_estado_pedido_html(cliente_nombre, micro_nombre, venta_id, estado)
    # Si tu send_email soporta HTML:
    send_email(to_email, subject, html, is_html=True)

