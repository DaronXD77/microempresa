from .base import db


class PlanCaracteristica(db.Model):
    __tablename__ = "plan_caracteristica"

    id_plan_caracteristica = db.Column(db.BigInteger, primary_key=True)
    id_plan = db.Column(
        db.BigInteger,
        db.ForeignKey("plan.id_plan", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    texto = db.Column(db.String(200), nullable=False)
    orden = db.Column(db.Integer, nullable=False, default=0)
