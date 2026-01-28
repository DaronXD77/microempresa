from datetime import datetime
from .base import db


class EntregaOpcion(db.Model):
    __tablename__ = "entrega_opcion"

    id_opcion = db.Column(db.BigInteger, primary_key=True)
    id_entrega = db.Column(db.BigInteger, db.ForeignKey("entrega.id_entrega"), nullable=False, index=True)

    fecha = db.Column(db.String(10), nullable=False)
    hora_inicio = db.Column(db.String(5), nullable=False)
    hora_fin = db.Column(db.String(5), nullable=False)
    lugar_texto = db.Column(db.String(200), nullable=False)
    maps_url = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    entrega = db.relationship("Entrega", back_populates="opciones", foreign_keys=[id_entrega])

    def to_dict(self):
        return {
            "id_opcion": self.id_opcion,
            "id_entrega": self.id_entrega,
            "fecha": self.fecha,
            "hora_inicio": self.hora_inicio,
            "hora_fin": self.hora_fin,
            "lugar_texto": self.lugar_texto,
            "maps_url": self.maps_url,
        }
