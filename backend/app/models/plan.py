from .base import db
from .plan_caracteristica import PlanCaracteristica


class Plan(db.Model):
    __tablename__ = "plan"

    id_plan = db.Column(db.BigInteger, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    precio = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    estado = db.Column(db.String(20), nullable=False, default="activo")

    # ✅ NUEVO: características (1 plan -> muchas características)
    caracteristicas = db.relationship(
        "PlanCaracteristica",
        backref="plan",
        cascade="all, delete-orphan",
        order_by="PlanCaracteristica.orden.asc()",
        lazy="selectin",
    )

    def to_dict(self):
        return {
            "id_plan": self.id_plan,
            "nombre": self.nombre,
            "precio": float(self.precio or 0),
            "estado": self.estado,
            # ✅ NUEVO
            "caracteristicas": [c.texto for c in (self.caracteristicas or [])],
        }
