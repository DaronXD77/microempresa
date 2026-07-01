from .base import db


class Suscripcion(db.Model):
    __tablename__ = "suscripcion"

    id_suscripcion = db.Column(db.BigInteger, primary_key=True)

    tenant_id = db.Column(
        db.BigInteger, db.ForeignKey("microempresa.tenant_id"), nullable=False
    )
    id_plan = db.Column(db.BigInteger, db.ForeignKey("plan.id_plan"), nullable=False)

    fecha_inicio = db.Column(db.DateTime)
    fecha_fin = db.Column(db.DateTime)

    # pendiente_pago -> en_revision -> activa / rechazada
    estado = db.Column(db.String(30), nullable=False, default="pendiente_pago")

    # comprobante (archivo)
    comprobante_path = db.Column(db.Text)
    comprobante_nombre = db.Column(db.String(255))
    comprobante_mime = db.Column(db.String(100))

    def to_dict(self):
        return {
            "id_suscripcion": self.id_suscripcion,
            "tenant_id": self.tenant_id,
            "id_plan": self.id_plan,
            "fecha_inicio": self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            "fecha_fin": self.fecha_fin.isoformat() if self.fecha_fin else None,
            "estado": self.estado,
            "comprobante_nombre": self.comprobante_nombre,
        }
