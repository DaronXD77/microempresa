"""
Modelo Auditoria - Registro de todas las operaciones importantes
"""
from datetime import datetime
from .base import db


class Auditoria(db.Model):
    """Registro de auditoria del sistema"""
    __tablename__ = "auditoria"

    id_auditoria = db.Column(db.BigInteger, primary_key=True)
    id_usuario = db.Column(db.BigInteger, nullable=True)
    tipo_usuario = db.Column(db.String(30), nullable=True)
    accion = db.Column(db.String(100), nullable=False)
    entidad_afectada = db.Column(db.String(50), nullable=True)
    id_entidad = db.Column(db.BigInteger, nullable=True)
    ip_equipo = db.Column(db.String(50), nullable=True)
    nombre_equipo = db.Column(db.String(100), nullable=True)
    navegador = db.Column(db.String(200), nullable=True)
    detalles = db.Column(db.Text, nullable=True)
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    zona_horaria = db.Column(db.String(50), nullable=False, default="America/La_Paz")

    def to_dict(self):
        return {
            "id_auditoria": self.id_auditoria,
            "id_usuario": self.id_usuario,
            "tipo_usuario": self.tipo_usuario,
            "accion": self.accion,
            "entidad_afectada": self.entidad_afectada,
            "id_entidad": self.id_entidad,
            "ip_equipo": self.ip_equipo,
            "nombre_equipo": self.nombre_equipo,
            "navegador": self.navegador,
            "detalles": self.detalles,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "zona_horaria": self.zona_horaria,
        }
