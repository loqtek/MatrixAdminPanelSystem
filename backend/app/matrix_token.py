"""Encrypt Matrix access tokens at rest in the application database."""
from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken

from app.models import User
from app.settings import SECRET_KEY

_PREFIX = "enc1:"


def _fernet() -> Fernet:
    env_key = os.getenv("MATRIX_TOKEN_ENCRYPTION_KEY", "").strip()
    if env_key:
        return Fernet(env_key.encode() if isinstance(env_key, str) else env_key)
    digest = hashlib.sha256(SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_matrix_token(plaintext: str) -> str:
    if not plaintext:
        return plaintext
    if plaintext.startswith(_PREFIX):
        return plaintext
    token = _fernet().encrypt(plaintext.encode()).decode()
    return f"{_PREFIX}{token}"


def decrypt_matrix_token(stored: str) -> str:
    if not stored:
        return stored
    if not stored.startswith(_PREFIX):
        return stored
    raw = stored[len(_PREFIX) :]
    try:
        return _fernet().decrypt(raw.encode()).decode()
    except InvalidToken:
        return stored


def plaintext_matrix_token(user: User) -> str:
    raw = user.matrix_access_token
    if not raw:
        return ""
    return decrypt_matrix_token(raw)
