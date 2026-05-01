"""Restrict config/log file paths to allowed directory roots."""
from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from app.settings import ALLOWED_PATH_ROOTS


def resolve_and_check_path(file_path: str) -> Path:
    if not file_path or not file_path.strip():
        raise HTTPException(status_code=400, detail="File path is required")

    resolved = Path(file_path).expanduser().resolve(strict=False)

    if ALLOWED_PATH_ROOTS is None:
        return resolved

    for root in ALLOWED_PATH_ROOTS:
        try:
            resolved.relative_to(root)
            return resolved
        except ValueError:
            continue

    allowed = ", ".join(str(r) for r in ALLOWED_PATH_ROOTS)
    raise HTTPException(
        status_code=400,
        detail=f"Path must be under an allowed root directory. Allowed roots: {allowed}. "
        "Set ALLOWED_FILE_ROOTS=* to disable this check (not recommended).",
    )
