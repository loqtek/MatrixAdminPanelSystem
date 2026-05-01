"""Avoid leaking internal exception details to API clients unless DEBUG is enabled."""
from __future__ import annotations

import os


def _debug() -> bool:
    return os.getenv("DEBUG", "").lower() in ("1", "true", "yes")


def public_error_detail(generic: str, exc: BaseException | None = None) -> str:
    if _debug() and exc is not None:
        return f"{generic}: {exc!s}"
    return generic
