from .base import db


class SystemSetting(db.Model):
    __tablename__ = "system_setting"

    id_setting = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id_setting": self.id_setting,
            "key": self.key,
            "value": self.value,
        }
