"""
Aplicacion Flask - Tienda Virtual UMSA Somos Todos
"""
import os
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager

from .models.base import db
from .models import SuperAdmin
from .services.auth_service import load_user, hash_password
from .controllers import (
    auth_bp,
    producto_bp,
    venta_bp,
    compra_bp,
    dashboard_bp,
    vendedor_bp,
)


def seed_superadmin_base():
    """Crea el superadmin base si no existe"""
    email_base = "daron.augusto@gmail.com"
    password_base = "umsasomostodosadmin*$312"
    
    existente = SuperAdmin.query.filter_by(email=email_base).first()
    if existente:
        return
    
    admin = SuperAdmin(
        nombre="Admin",
        email=email_base,
        password_hash=hash_password(password_base),
        estado="activo",
    )
    db.session.add(admin)
    db.session.commit()
    print(f"Superadmin base creado: {email_base}")


def create_app():
    """Factory de la aplicacion Flask"""
    load_dotenv(encoding="utf-8-sig")
    
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-312")
    
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgresql") and "sslmode=" not in db_url:
        db_url = f"{db_url}?sslmode=require"
    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": int(os.environ.get("DB_POOL_RECYCLE", "300")),
    }
    
    frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    origins = [o.strip() for o in frontend_origin.split(",") if o.strip()]
    extra_origins = [
        "http://localhost:3001",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "ionic://localhost",
    ]
    for origin in extra_origins:
        if origin not in origins:
            origins.append(origin)
    CORS(app, supports_credentials=True, origins=origins)
    
    upload_folder = os.environ.get("UPLOAD_FOLDER")
    if not upload_folder:
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        upload_folder = os.path.join(backend_root, "uploads")
    app.config["UPLOAD_FOLDER"] = os.path.abspath(upload_folder)
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_CONTENT_LENGTH", str(10 * 1024 * 1024)))
    
    app.config["QR_GENERICO_URL"] = os.environ.get(
        "QR_GENERICO_URL",
        "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="
    )
    
    db.init_app(app)
    
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.user_loader(load_user)
    
    with app.app_context():
        db.create_all()
        seed_superadmin_base()
    
    app.register_blueprint(auth_bp)
    app.register_blueprint(producto_bp)
    app.register_blueprint(venta_bp)
    app.register_blueprint(compra_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(vendedor_bp)
    
    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": "Tienda Virtual UMSA"}
    
    @app.get("/uploads/<path:filename>")
    def serve_uploads(filename):
        upload_root = app.config.get("UPLOAD_FOLDER") or "uploads"
        return send_from_directory(upload_root, filename)
    
    return app
