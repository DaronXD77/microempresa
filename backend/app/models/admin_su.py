from flask_login import UserMixin

from .base import db


class AdminSu(UserMixin, db.Model):
    __tablename__ = "admin_su"

    id_su = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    apellido_paterno = db.Column(db.String(100), nullable=False)
    apellido_materno = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.Text, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default="activo")

    def get_id(self):
        return f"super_usuario:{self.id_su}"

    def to_dict(self):
        return {
            "id_su": self.id_su,
            "nombre": self.nombre,
            "apellido_paterno": self.apellido_paterno,
            "apellido_materno": self.apellido_materno,
            "email": self.email,
            "estado": self.estado,
        }
