import re
from flask_login import UserMixin
from .base import db

_TIME_RANGE_RE = re.compile(r"^\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\s*$")


class Microempresa(UserMixin, db.Model):
    __tablename__ = "microempresa"

    tenant_id = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)

    logo_url = db.Column(db.Text)
    direccion = db.Column(db.Text, nullable=False)
    horario_atencion = db.Column(db.String(100), nullable=False)
    qr_url = db.Column(db.Text)

    nombre_propietario = db.Column(db.String(100), nullable=False)
    apellido_paterno_propietario = db.Column(db.String(100), nullable=False)
    apellido_materno_propietario = db.Column(db.String(100), nullable=False)

    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.Text, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default="activo")

    # Relación (1 a muchos)
    clientes = db.relationship(
        "Cliente",
        back_populates="microempresa",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    seguidores = db.relationship(
        "Cliente",
        secondary="cliente_microempresa",
        back_populates="microempresas",
        lazy="selectin",
    )

    def get_id(self):
        return f"microempresa:{self.tenant_id}"

    @property
    def tipo_tienda(self) -> str:
        h = (self.horario_atencion or "").strip()
        return "fisica" if _TIME_RANGE_RE.match(h) else "virtual"

    def to_dict(self):
        return {
            "tenant_id": self.tenant_id,
            "nombre": self.nombre,
            "logo_url": self.logo_url,
            "direccion": self.direccion,
            "horario_atencion": self.horario_atencion,
            "qr_url": self.qr_url,
            "nombre_propietario": self.nombre_propietario,
            "apellido_paterno_propietario": self.apellido_paterno_propietario,
            "apellido_materno_propietario": self.apellido_materno_propietario,
            "email": self.email,
            "estado": self.estado,
            "tipo_tienda": self.tipo_tienda,
        }
