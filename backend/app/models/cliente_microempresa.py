from datetime import datetime

from .base import db


class ClienteMicroempresa(db.Model):
    __tablename__ = "cliente_microempresa"

    id_cliente = db.Column(
        db.BigInteger,
        db.ForeignKey("cliente.id_cliente", ondelete="CASCADE"),
        primary_key=True,
    )
    tenant_id = db.Column(
        db.BigInteger,
        db.ForeignKey("microempresa.tenant_id", ondelete="CASCADE"),
        primary_key=True,
    )
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
