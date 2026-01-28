from flask_login import UserMixin
from .base import db


class Empleado(UserMixin, db.Model):
    __tablename__ = "empleado"

    id_empleado = db.Column(db.BigInteger, primary_key=True)
    tenant_id = db.Column(db.BigInteger, db.ForeignKey("microempresa.tenant_id"), nullable=False, index=True)

    nombre = db.Column(db.String(100), nullable=False)
    apellido_paterno = db.Column(db.String(100), nullable=False)
    apellido_materno = db.Column(db.String(100), nullable=False)
    ci = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(150), nullable=False, index=True)
    password = db.Column(db.Text, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default="activo")
    force_password_reset = db.Column(db.Boolean, nullable=False, default=False)

    permisos = db.relationship(
        "EmpleadoPermiso",
        back_populates="empleado",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def get_id(self):
        return f"empleado:{self.id_empleado}"

    def to_dict(self):
        return {
            "id_empleado": self.id_empleado,
            "tenant_id": self.tenant_id,
            "nombre": self.nombre,
            "apellido_paterno": self.apellido_paterno,
            "apellido_materno": self.apellido_materno,
            "ci": self.ci,
            "email": self.email,
            "estado": self.estado,
            "force_password_reset": self.force_password_reset,
            "permisos": [p.permiso for p in self.permisos],
        }
