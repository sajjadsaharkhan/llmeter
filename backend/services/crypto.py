import base64
import os
from cryptography.fernet import Fernet
from config import settings


def _get_fernet() -> Fernet:
    key = settings.encryption_key
    # Ensure key is valid Fernet key (32 url-safe base64 bytes)
    try:
        raw = base64.urlsafe_b64decode(key + "==")
        if len(raw) == 32:
            return Fernet(base64.urlsafe_b64encode(raw))
    except Exception:
        pass
    # Pad or hash to 32 bytes
    raw = key.encode()[:32].ljust(32, b"0")
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt(plaintext: str) -> str:
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    f = _get_fernet()
    return f.decrypt(token.encode()).decode()


def mask_key(key: str) -> str:
    if len(key) <= 8:
        return "sk-...****"
    return key[:4] + "..." + key[-4:]
