import json

from cryptography.fernet import Fernet

from ..config import settings


def encrypt(data: dict) -> bytes:
    fernet = Fernet(settings.secrets_encryption_key)
    return fernet.encrypt(json.dumps(data).encode())


def decrypt(blob: bytes) -> dict:
    fernet = Fernet(settings.secrets_encryption_key)
    return json.loads(fernet.decrypt(blob).decode())
