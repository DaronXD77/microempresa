from flask import Blueprint, jsonify, request, current_app

from ...services.mail_service import send_email
from ...services.password_reset_service import (
    roles_for_email,
    create_reset_token,
    reset_password,
)

password_reset_bp = Blueprint("password_reset", __name__)


@password_reset_bp.post("/api/password-reset/request")   # ✅ ruta que usa tu frontend
@password_reset_bp.post("/api/password/forgot")          # ✅ compatibilidad (ruta vieja)
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip()
    role = payload.get("role")  # opcional

    if not email:
        return jsonify({"error": "Email requerido"}), 400

    roles = roles_for_email(email)
    if not roles:
        return jsonify({"error": "No existe ninguna cuenta con ese correo"}), 404

    # Si ese correo existe en varios roles, el frontend debe elegir uno
    if not role:
        if len(roles) > 1:
            return jsonify({"select_role": True, "roles": roles}), 200
        role = roles[0]
    else:
        if role not in roles:
            return jsonify({"error": "No existe una cuenta con ese rol para ese correo"}), 400

    raw_token, _record = create_reset_token(email, role)

    minutes = int(current_app.config.get("RESET_TOKEN_EXPIRE_MINUTES", 15))
    subject = "Recuperación de contraseña - Microempresa SaaS"
    body = (
        "Hola,\n\n"
        "Recibimos una solicitud para restablecer tu contraseña.\n\n"
        f"Tu token es:\n{raw_token}\n\n"
        f"Este token vence en {minutes} minutos.\n\n"
        "Si tú no pediste esto, ignora este correo.\n"
    )

    try:
        send_email(email, subject, body)
    except Exception:
        current_app.logger.exception("Error enviando correo de recuperación")
        return jsonify({"error": "No se pudo enviar el correo. Revisa MAIL_USER/MAIL_PASS."}), 500

    return jsonify({"message": "Token enviado", "role": role}), 200


@password_reset_bp.post("/api/password-reset/confirm")   # ✅ ruta que usa tu frontend
@password_reset_bp.post("/api/password/reset")           # ✅ compatibilidad (ruta vieja)
def reset_password_with_token():
    payload = request.get_json(silent=True) or {}

    email = (payload.get("email") or "").strip()
    role = payload.get("role")
    token = (payload.get("token") or "").strip()

    # ✅ Acepta new_password (frontend) o password (backend viejo)
    new_password = payload.get("new_password") or payload.get("password") or ""
    confirm_password = payload.get("confirm_password")

    if not all([email, role, token, new_password]):
        return jsonify({"error": "Email, rol, token y nueva contraseña son requeridos"}), 400

    # si mandan confirm, validamos
    if confirm_password is not None and new_password != confirm_password:
        return jsonify({"error": "Las contraseñas no coinciden"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

    ok, msg, status = reset_password(email, role, token, new_password)
    if not ok:
        return jsonify({"error": msg}), status

    return jsonify({"message": msg}), status
