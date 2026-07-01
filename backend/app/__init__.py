import os
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from sqlalchemy import text
from flask_cors import CORS

from .extensions import db, login_manager
from .services.auth_service import load_user

# Módulo 1
from .controllers.auth.auth_controller import auth_bp
from .controllers.auth.password_reset_controller import password_reset_bp
from .controllers.dashboard_controller import dashboard_bp
from .controllers.admin_controller import admin_bp
from .controllers.microempresa_controller import microempresa_bp
from .controllers.cliente_controller import cliente_bp
from .controllers.proveedor_controller import proveedor_bp

# Público (registro cliente + listado microempresas)
from .controllers.public_controller import public_bp
from .controllers.categoria_controller import categoria_bp
from .controllers.producto_controller import producto_bp
from .controllers.venta_controller import venta_bp

# Módulo 2
from .controllers.plan_controller import plan_bp
from .controllers.onboarding_controller import onboarding_bp
from .controllers.subscription_review_controller import subscription_review_bp
from .controllers.audit_controller import audit_bp
from .controllers.compra_controller import compra_bp
from .controllers.economia_controller import economia_bp
from .controllers.empleado_controller import empleado_bp

from .models import AdminSu, Plan
from .services.auth_service import hash_password


def seed_admin():
    admin_email = "daron.augusto@gmail.com"
    admin = AdminSu.query.filter_by(email=admin_email).first()
    if not admin:
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


def seed_planes():
    if Plan.query.count() == 0:
        planes = [
            {"nombre": "Basico", "precio": 50, "estado": "activo"},
            {"nombre": "Pro", "precio": 100, "estado": "activo"},
            {"nombre": "Premium", "precio": 200, "estado": "activo"},
        ]
        for p in planes:
            db.session.add(Plan(**p))
        db.session.commit()


def create_app():
    load_dotenv(encoding="utf-8-sig")

    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")
    db_url = os.environ.get("DATABASE_URL")
    if db_url and db_url.startswith("postgresql") and "sslmode=" not in db_url:
        db_url = f"{db_url}?sslmode=require"
    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": int(os.environ.get("DB_POOL_RECYCLE", "300")),
    }
    session_samesite = os.environ.get("SESSION_COOKIE_SAMESITE", "None")
    app.config["SESSION_COOKIE_SAMESITE"] = session_samesite
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SESSION_COOKIE_SECURE", "1") in (
        "1",
        "true",
        "True",
    )

    # CORS (para cookies de sesión)
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

    # Uploads
    upload_folder = os.environ.get("UPLOAD_FOLDER")
    if not upload_folder:
        backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        upload_folder = os.path.join(backend_root, "uploads")
    app.config["UPLOAD_FOLDER"] = os.path.abspath(upload_folder)
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_CONTENT_LENGTH", str(10 * 1024 * 1024)))

    app.config["ONBOARDING_TOKEN_EXPIRE_MINUTES"] = int(os.environ.get("ONBOARDING_TOKEN_EXPIRE_MINUTES", "120"))
    app.config["SUBSCRIPTION_DEFAULT_DAYS"] = int(os.environ.get("SUBSCRIPTION_DEFAULT_DAYS", "30"))

    # Mail (módulo 1)
    app.config["MAIL_HOST"] = os.environ.get("MAIL_HOST")
    app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", "587"))
    app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "1")
    app.config["MAIL_USER"] = os.environ.get("MAIL_USER")
    app.config["MAIL_PASS"] = os.environ.get("MAIL_PASS")
    app.config["MAIL_FROM"] = os.environ.get("MAIL_FROM")
    app.config["RESET_TOKEN_EXPIRE_MINUTES"] = int(os.environ.get("RESET_TOKEN_EXPIRE_MINUTES", "15"))

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.user_loader(load_user)

    def _run_startup_migrations():
        with app.app_context():
            db.create_all()
            try:
                dialect = db.engine.dialect.name
                if dialect == "postgresql":
                    db.session.execute(text("ALTER TABLE microempresa ADD COLUMN IF NOT EXISTS qr_url TEXT"))
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS apellido_paterno TEXT DEFAULT '-' ")
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS apellido_materno TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS razon_social TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS es_generico BOOLEAN DEFAULT FALSE")
                    )
                    db.session.execute(
                        text(
                            "ALTER TABLE cliente ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT FALSE"
                        )
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS creation_source TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS ci TEXT")
                    )
                    # Persiste primero las columnas criticas de cliente para que no se
                    # pierdan si una migracion posterior falla en una base antigua.
                    db.session.commit()
                    db.session.execute(text("ALTER TABLE cliente ALTER COLUMN tenant_id DROP NOT NULL"))
                    db.session.execute(
                        text("ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS tenant_id BIGINT")
                    )
                    db.session.execute(
                        text("ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS direccion TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS email TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS password TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE proveedor ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo'")
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS temp_password TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE cliente ADD COLUMN IF NOT EXISTS temp_password_set_at TIMESTAMP")
                    )
                    db.session.execute(
                        text("UPDATE cliente SET apellido_paterno = '-' WHERE apellido_paterno IS NULL")
                    )
                    db.session.execute(
                        text("UPDATE cliente SET es_generico = FALSE WHERE es_generico IS NULL")
                    )
                    db.session.execute(
                        text(
                            "ALTER TABLE producto ADD COLUMN IF NOT EXISTS stock_inicial INTEGER"
                        )
                    )
                    db.session.execute(
                        text("ALTER TABLE producto ADD COLUMN IF NOT EXISTS proveedor_id BIGINT")
                    )
                    db.session.execute(
                        text("ALTER TABLE producto ADD COLUMN IF NOT EXISTS precio_compra NUMERIC(10,2)")
                    )
                    db.session.execute(
                        text("ALTER TABLE entrega ADD COLUMN IF NOT EXISTS seleccion_opcion_id BIGINT")
                    )
                    db.session.execute(
                        text("ALTER TABLE entrega ADD COLUMN IF NOT EXISTS seleccion_at TIMESTAMP")
                    )
                    db.session.execute(
                        text("ALTER TABLE entrega_opcion ADD COLUMN IF NOT EXISTS hora_inicio TEXT")
                    )
                    db.session.execute(
                        text("ALTER TABLE entrega_opcion ADD COLUMN IF NOT EXISTS hora_fin TEXT")
                    )
                    db.session.execute(text("UPDATE producto SET stock_inicial = stock WHERE stock_inicial IS NULL"))
                elif dialect == "sqlite":
                    info = db.session.execute(text("PRAGMA table_info(microempresa)")).fetchall()
                    columns = {row[1] for row in info}
                    if "qr_url" not in columns:
                        db.session.execute(text("ALTER TABLE microempresa ADD COLUMN qr_url TEXT"))
                    info_cliente = db.session.execute(text("PRAGMA table_info(cliente)")).fetchall()
                    columns_cliente = {row[1] for row in info_cliente}
                    if "apellido_paterno" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN apellido_paterno TEXT DEFAULT '-' ")
                        )
                    if "apellido_materno" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN apellido_materno TEXT")
                        )
                    if "razon_social" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN razon_social TEXT")
                        )
                    if "es_generico" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN es_generico BOOLEAN DEFAULT 0")
                        )
                    if "force_password_reset" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN force_password_reset BOOLEAN DEFAULT 0")
                        )
                    if "creation_source" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN creation_source TEXT")
                        )
                    if "ci" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN ci TEXT")
                        )
                    info_proveedor = db.session.execute(text("PRAGMA table_info(proveedor)")).fetchall()
                    columns_proveedor = {row[1] for row in info_proveedor}
                    if "tenant_id" not in columns_proveedor:
                        db.session.execute(text("ALTER TABLE proveedor ADD COLUMN tenant_id INTEGER"))
                    if "direccion" not in columns_proveedor:
                        db.session.execute(text("ALTER TABLE proveedor ADD COLUMN direccion TEXT"))
                    if "email" not in columns_proveedor:
                        db.session.execute(text("ALTER TABLE proveedor ADD COLUMN email TEXT"))
                    if "password" not in columns_proveedor:
                        db.session.execute(text("ALTER TABLE proveedor ADD COLUMN password TEXT"))
                    if "estado" not in columns_proveedor:
                        db.session.execute(text("ALTER TABLE proveedor ADD COLUMN estado TEXT DEFAULT 'activo'"))
                    if "temp_password" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN temp_password TEXT")
                        )
                    if "temp_password_set_at" not in columns_cliente:
                        db.session.execute(
                            text("ALTER TABLE cliente ADD COLUMN temp_password_set_at DATETIME")
                        )
                    db.session.execute(text("UPDATE cliente SET apellido_paterno = '-' WHERE apellido_paterno IS NULL"))
                    db.session.execute(text("UPDATE cliente SET es_generico = 0 WHERE es_generico IS NULL"))
                    info_producto = db.session.execute(text("PRAGMA table_info(producto)")).fetchall()
                    columns_producto = {row[1] for row in info_producto}
                    if "stock_inicial" not in columns_producto:
                        db.session.execute(text("ALTER TABLE producto ADD COLUMN stock_inicial INTEGER"))
                    if "proveedor_id" not in columns_producto:
                        db.session.execute(text("ALTER TABLE producto ADD COLUMN proveedor_id INTEGER"))
                    if "precio_compra" not in columns_producto:
                        db.session.execute(text("ALTER TABLE producto ADD COLUMN precio_compra REAL"))
                    info_entrega = db.session.execute(text("PRAGMA table_info(entrega)")).fetchall()
                    columns_entrega = {row[1] for row in info_entrega}
                    if "seleccion_opcion_id" not in columns_entrega:
                        db.session.execute(text("ALTER TABLE entrega ADD COLUMN seleccion_opcion_id INTEGER"))
                    if "seleccion_at" not in columns_entrega:
                        db.session.execute(text("ALTER TABLE entrega ADD COLUMN seleccion_at DATETIME"))
                    info_entrega_opcion = db.session.execute(text("PRAGMA table_info(entrega_opcion)")).fetchall()
                    columns_entrega_opcion = {row[1] for row in info_entrega_opcion}
                    if "hora_inicio" not in columns_entrega_opcion:
                        db.session.execute(text("ALTER TABLE entrega_opcion ADD COLUMN hora_inicio TEXT"))
                    if "hora_fin" not in columns_entrega_opcion:
                        db.session.execute(text("ALTER TABLE entrega_opcion ADD COLUMN hora_fin TEXT"))
                    db.session.execute(text("UPDATE producto SET stock_inicial = stock WHERE stock_inicial IS NULL"))
                db.session.commit()
            except Exception:
                db.session.rollback()

            seed_admin()
            seed_planes()

    _run_startup_migrations()

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(password_reset_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(microempresa_bp)
    app.register_blueprint(cliente_bp)
    app.register_blueprint(proveedor_bp)

    # Público
    app.register_blueprint(public_bp)
    app.register_blueprint(categoria_bp)
    app.register_blueprint(producto_bp)
    app.register_blueprint(venta_bp)

    # Módulo 2
    app.register_blueprint(plan_bp)
    app.register_blueprint(onboarding_bp)
    app.register_blueprint(subscription_review_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(compra_bp)
    app.register_blueprint(economia_bp)
    app.register_blueprint(empleado_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/uploads/<path:filename>")
    def serve_uploads(filename):
        upload_root = app.config.get("UPLOAD_FOLDER") or "uploads"
        return send_from_directory(upload_root, filename)

    return app
