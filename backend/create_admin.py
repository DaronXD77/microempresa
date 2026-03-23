from app import create_app
from app.extensions import db
from app.models import AdminSu
from app.services.auth_service import hash_password

app = create_app()

with app.app_context():
    admin_email = "daron.augusto@gmail.com"
    admin = AdminSu.query.filter_by(email=admin_email).first()
    if admin:
        print(f"Admin {admin_email} ya existe")
    else:
        admin = AdminSu(
            nombre="Admin",
            apellido_paterno="Sistema",
            apellido_materno="Base",
            email=admin_email,
            password=hash_password("admin"),
            estado="activo",
        )
        db.session.add(admin)
        db.session.commit()
        print(f"Admin {admin_email} creado exitosamente!")
        print(f"Password: admin")
