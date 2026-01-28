from .base import db


class EmpleadoPermiso(db.Model):
    __tablename__ = "empleado_permiso"

    id_permiso = db.Column(db.BigInteger, primary_key=True)
    id_empleado = db.Column(db.BigInteger, db.ForeignKey("empleado.id_empleado"), nullable=False, index=True)
    permiso = db.Column(db.String(50), nullable=False)

    empleado = db.relationship("Empleado", back_populates="permisos")

    def to_dict(self):
        return {
            "id_permiso": self.id_permiso,
            "id_empleado": self.id_empleado,
            "permiso": self.permiso,
        }
