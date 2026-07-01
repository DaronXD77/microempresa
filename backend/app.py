import os

from app import create_app
from app.extensions import db
from app.models import AdminSu, Plan
from app.services.auth_service import hash_password


def seed_admin():
    admin_email = "daron.augusto@gmail.com"
    admin_user = AdminSu.query.filter_by(email=admin_email).first()
    if not admin_user:
        admin_user = AdminSu(
            nombre="Admin",
            apellido_paterno="Sistema",
            apellido_materno="Base",
            email=admin_email,
            password=hash_password("admin"),
            estado="activo",
        )
        db.session.add(admin_user)
        db.session.commit()


def seed_planes():
    # Solo crea planes si no hay ninguno
    if Plan.query.count() == 0:
        planes = [
            {"nombre": "Básico", "precio": 50, "estado": "activo"},
            {"nombre": "Pro", "precio": 100, "estado": "activo"},
            {"nombre": "Premium", "precio": 200, "estado": "activo"},
        ]
        for p in planes:
            db.session.add(Plan(**p))
        db.session.commit()


if __name__ == "__main__":
    app = create_app()

    # ✅ Todo lo que use db / query debe ir dentro del app_context
    with app.app_context():
        db.create_all()
        seed_admin()
        seed_planes()

    port = int(os.environ.get("PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "1").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=port, debug=debug)
