"""Central environment configuration (single load_dotenv entry point)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_ROOT / ".env")

PLACEHOLDER_SECRETS = frozenset(
    {
        "your-secret-key-change-in-production",
        "your-secret-key-change-this",
    }
)

ALLOW_INSECURE_DEFAULT_SECRET = os.getenv("ALLOW_INSECURE_DEFAULT_SECRET", "").lower() in (
    "1",
    "true",
    "yes",
)

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./maps.db")

DEBUG = os.getenv("DEBUG", "").lower() in ("1", "true", "yes")

_DEFAULT_FILE_ROOTS = "/etc/matrix-synapse,/var/log/matrix-synapse"
_env_roots = os.getenv("ALLOWED_FILE_ROOTS")
ALLOWED_FILE_ROOTS_RAW = (
    _env_roots.strip() if _env_roots is not None else _DEFAULT_FILE_ROOTS
)


def _parse_allowed_path_roots() -> list[Path] | None:
    raw = ALLOWED_FILE_ROOTS_RAW
    if not raw or raw == "*":
        return None
    roots: list[Path] = []
    for part in raw.split(","):
        p = part.strip()
        if not p:
            continue
        roots.append(Path(p).expanduser().resolve(strict=False))
    return roots or None


ALLOWED_PATH_ROOTS: list[Path] | None = _parse_allowed_path_roots()


def _resolve_secret_key() -> str:
    sk = os.getenv("SECRET_KEY", "").strip()
    if ALLOW_INSECURE_DEFAULT_SECRET:
        return sk or "your-secret-key-change-in-production"
    if not sk or sk in PLACEHOLDER_SECRETS:
        raise RuntimeError(
            "SECRET_KEY must be set to a strong random value (e.g. openssl rand -hex 32). "
            "For local development only, set ALLOW_INSECURE_DEFAULT_SECRET=true in the environment."
        )
    return sk


SECRET_KEY = _resolve_secret_key()


def cookie_secure() -> bool:
    v = os.getenv("COOKIE_SECURE", "").lower()
    if v in ("1", "true", "yes"):
        return True
    if v in ("0", "false", "no"):
        return False
    return os.getenv("ENV", "development").lower() == "production"
