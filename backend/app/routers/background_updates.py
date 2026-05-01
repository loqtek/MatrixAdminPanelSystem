"""Background updates management routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    BackgroundUpdatesStatus,
    BackgroundUpdatesEnabled,
    StartBackgroundJobRequest,
)
from app.auth import get_current_admin
from app.matrix_client import MatrixAdminClient
from app.matrix_token import plaintext_matrix_token
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/background-updates", tags=["background-updates"])


@router.get("/status", response_model=BackgroundUpdatesStatus)
async def get_background_updates_status(current_user: User = Depends(get_current_admin)):
    """Get background updates status"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_background_updates_status()
        await matrix_client.close()
        # Ensure response matches schema - handle None values
        if response and "current_updates" in response and response["current_updates"]:
            for db_name, update_info in response["current_updates"].items():
                if update_info and "average_items_per_ms" in update_info and update_info["average_items_per_ms"] is None:
                    # Keep None as is since schema now allows it
                    pass
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get background updates status", e),
        )


@router.get("/enabled", response_model=BackgroundUpdatesEnabled)
async def get_background_updates_enabled(current_user: User = Depends(get_current_admin)):
    """Get whether background updates are enabled"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_background_updates_enabled()
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get background updates enabled status", e),
        )


@router.post("/enabled", response_model=BackgroundUpdatesEnabled)
async def set_background_updates_enabled(
    enabled_data: BackgroundUpdatesEnabled,
    current_user: User = Depends(get_current_admin),
):
    """Enable or disable background updates"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.set_background_updates_enabled(enabled_data.enabled)
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to set background updates enabled", e),
        )


@router.post("/start-job")
async def start_background_job(
    job_request: StartBackgroundJobRequest,
    current_user: User = Depends(get_current_admin),
):
    """Start a specific background update job"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.start_background_job(job_request.job_name)
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to start background job", e),
        )

