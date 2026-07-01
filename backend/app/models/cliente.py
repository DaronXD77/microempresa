from flask_login import UserMixin
from .base import db


class Cliente(UserMixin, db.Model):
    __tablename__ = "cliente"

    id_cliente = db.Column(db.BigInteger, primary_key=True)

    nombre = db.Column(db.String(100), nullable=False)
    apellido_paterno = db.Column(db.String(100), nullable=False)
    apellido_materno = db.Column(db.String(100), nullable=True)
    ci = db.Column(db.String(40), nullable=True, index=True)
    razon_social = db.Column(db.String(150))
    es_generico = db.Column(db.Boolean, nullable=False, default=False)

    # OJO: si el cliente inicia sesión en tu sistema, ok mantener email/password
    # Si NO inicia sesión (solo es “cliente de la tienda”), quita password.
    email = db.Column(db.String(150), nullable=False, unique=True)
    password = db.Column(db.Text, nullable=False)
    force_password_reset = db.Column(db.Boolean, nullable=False, default=False)

    # origen de creacion: independiente | invitado | microempresa
    creation_source = db.Column(db.String(40), nullable=True, default="independiente")
    # password temporal visible para reporte (solo en ciertos flujos)
    temp_password = db.Column(db.String(150), nullable=True)
    temp_password_set_at = db.Column(db.DateTime, nullable=True)

    estado = db.Column(db.String(20), nullable=False, default="activo")

    microempresas = db.relationship(
        "Microempresa",
        secondary="cliente_microempresa",
        back_populates="seguidores",
        lazy="selectin",
    )

    def get_id(self):
        return f"cliente:{self.id_cliente}"

    def to_dict(self):
        return {
            "id_cliente": self.id_cliente,
            "nombre": self.nombre,
            "apellido_paterno": self.apellido_paterno,
            "apellido_materno": self.apellido_materno,
            "ci": self.ci,
            "razon_social": self.razon_social,
            "es_generico": self.es_generico,
            "email": self.email,
            "estado": self.estado,
            "force_password_reset": self.force_password_reset,
            "creation_source": self.creation_source,
            "temp_password": self.temp_password,
            "temp_password_set_at": self.temp_password_set_at.isoformat() if self.temp_password_set_at else None,
        }
