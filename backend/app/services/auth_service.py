"""
Servicio de autenticacion con Argon2
"""
import re
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
from flask_login import current_user
from ..models.base import db
from ..models import SuperAdmin, Vendedor, Cliente

ph = PasswordHasher()


def hash_password(password: str) -> str:
    """Encripta password con Argon2"""
    return ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verifica password contra hash Argon2"""
    try:
        ph.verify(password_hash, password)
        return True
    except (VerifyMismatchError, InvalidHash):
        return False


def load_user(user_id: str):
    """Carga usuario por ID de Flask-Login"""
    if not user_id:
        return None
    
    if ":" in user_id:
        tipo, id_str = user_id.split(":", 1)
    else:
        tipo, id_str = "cliente", user_id
    
    try:
        user_id_int = int(id_str)
    except ValueError:
        return None
    
    if tipo == "superadmin":
        return db.session.get(SuperAdmin, user_id_int)
    elif tipo == "vendedor":
        return db.session.get(Vendedor, user_id_int)
    elif tipo == "cliente":
        return db.session.get(Cliente, user_id_int)
    
    return None


ROLE_MODELS = {
    "superadmin": SuperAdmin,
    "vendedor": Vendedor,
    "cliente": Cliente,
}


def get_user_by_email(email: str):
    """Busca usuario por email en todos los roles"""
    for model in ROLE_MODELS.values():
        user = model.query.filter_by(email=email.lower().strip()).first()
        if user:
            return user, model.__name__.lower().replace("superadmin", "superadmin")
    return None, None


def get_user_for_role(role: str, identifier: str):
    """Obtiene usuario por rol e identificador"""
    model = ROLE_MODELS.get(role)
    if not model:
        return None
    
    if role in ("superadmin", "vendedor", "cliente"):
        return model.query.filter_by(email=identifier.lower().strip()).first()
    return None


def get_users_by_email(email: str):
    """Obtiene todos los usuarios con ese email"""
    return {
        role: get_user_for_role(role, email)
        for role in ROLE_MODELS.keys()
    }


def serialize_user(user):
    """Serializa usuario segun tipo"""
    if isinstance(user, SuperAdmin):
        return user.to_dict(), "superadmin"
    elif isinstance(user, Vendedor):
        return user.to_dict(), "vendedor"
    elif isinstance(user, Cliente):
        return user.to_dict(), "cliente"
    return None, None


def is_active(user):
    """Verifica si usuario esta activo"""
    return getattr(user, "estado", "inactivo") == "activo"


def validate_email(email: str) -> bool:
    """Valida formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_ci(ci: str) -> bool:
    """Valida CI (solo numeros, 5-10 digitos para Bolivia)"""
    return bool(re.match(r'^\d{5,10}$', ci))


def validate_phone(telefono: str) -> bool:
    """Valida telefono"""
    return bool(re.match(r'^\d{7,12}$', telefono))


def sanitize_string(value: str) -> str:
    """Escapa caracteres especiales para prevenir SQL injection"""
    if not value:
        return ""
    return re.sub(r'[<>"\';]', '', value)
