import smtplib
import json
import os
import smtplib
import urllib.request
from urllib.error import HTTPError
from email.message import EmailMessage
from flask import current_app


def send_email(to_email: str, subject: str, text_body: str) -> None:
    resend_key = os.environ.get("RESEND_API_KEY")
    host = current_app.config.get("MAIL_HOST")
    port = int(current_app.config.get("MAIL_PORT", 587))
    use_tls = str(current_app.config.get("MAIL_USE_TLS", "1")).lower() in ("1", "true", "yes")
    user = current_app.config.get("MAIL_USER")
    password = current_app.config.get("MAIL_PASS")
    mail_from = current_app.config.get("MAIL_FROM") or user

    if resend_key:
        if not mail_from:
            raise RuntimeError("Falta MAIL_FROM para enviar con Resend")
        payload = {
            "from": mail_from,
            "to": [to_email],
            "subject": subject,
            "text": text_body,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=data,
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        timeout = float(os.environ.get("MAIL_TIMEOUT", "10"))
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if response.status >= 400:
                    raise RuntimeError("Resend devolvió un error al enviar correo")
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Resend error {exc.code}: {detail}") from exc
        return

    if not host or not user or not password:
        raise RuntimeError("Configuración de correo incompleta. Revisa MAIL_HOST/MAIL_USER/MAIL_PASS")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = to_email
    msg.set_content(text_body)

    timeout = float(os.environ.get("MAIL_TIMEOUT", "10"))
    with smtplib.SMTP(host, port, timeout=timeout) as server:
        server.ehlo()
        if use_tls:
            server.starttls()
            server.ehlo()
        server.login(user, password)
        server.send_message(msg)
