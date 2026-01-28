import smtplib
from email.message import EmailMessage
from flask import current_app


def send_email(to_email: str, subject: str, text_body: str) -> None:
    host = current_app.config.get("MAIL_HOST")
    port = int(current_app.config.get("MAIL_PORT", 587))
    use_tls = str(current_app.config.get("MAIL_USE_TLS", "1")).lower() in ("1", "true", "yes")
    user = current_app.config.get("MAIL_USER")
    password = current_app.config.get("MAIL_PASS")
    mail_from = current_app.config.get("MAIL_FROM") or user

    if not host or not user or not password:
        raise RuntimeError("Configuración de correo incompleta. Revisa MAIL_HOST/MAIL_USER/MAIL_PASS")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = to_email
    msg.set_content(text_body)

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        if use_tls:
            server.starttls()
            server.ehlo()
        server.login(user, password)
        server.send_message(msg)
