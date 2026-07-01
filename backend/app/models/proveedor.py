from .base import db


class Proveedor(db.Model):
    __tablename__ = "proveedor"

    id_proveedor = db.Column(db.BigInteger, primary_key=True)
    tenant_id = db.Column(
        db.BigInteger, db.ForeignKey("microempresa.tenant_id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre = db.Column(db.String(150), nullable=False)
    direccion = db.Column(db.String(200))
    email = db.Column(db.String(150))
    password = db.Column(db.Text)
    estado = db.Column(db.String(20), nullable=False, default="activo")

    def to_dict(self):
        return {
            "id_proveedor": self.id_proveedor,
            "tenant_id": self.tenant_id,
            "nombre": self.nombre,
            "direccion": self.direccion,
            "email": self.email,
            "estado": self.estado,
        }
