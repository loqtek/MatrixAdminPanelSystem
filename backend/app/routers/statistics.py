"""Statistics routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import User
from app.schemas import (
    UserMediaStatisticsResponse,
    DatabaseRoomStatisticsResponse,
)
from app.auth import get_current_admin
from app.matrix_client import MatrixAdminClient
from app.matrix_token import plaintext_matrix_token
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/statistics", tags=["statistics"])


@router.get("/users/media", response_model=UserMediaStatisticsResponse)
async def get_user_media_statistics(
    from_user: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    order_by: Optional[str] = Query(None),
    dir: str = Query("f"),
    from_ts: Optional[int] = Query(None),
    until_ts: Optional[int] = Query(None),
    search_term: Optional[str] = Query(None),
    current_user: User = Depends(get_current_admin),
):
    """Get users' media usage statistics"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_user_media_statistics(
            from_user=from_user,
            limit=limit,
            order_by=order_by,
            dir=dir,
            from_ts=from_ts,
            until_ts=until_ts,
            search_term=search_term,
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get user media statistics", e),
        )
    finally:
        if matrix_client:
            await matrix_client.close()


@router.get("/database/rooms", response_model=DatabaseRoomStatisticsResponse)
async def get_database_room_statistics(
    current_user: User = Depends(get_current_admin),
):
    """Get largest rooms by database size
    
    Note: This endpoint only works with PostgreSQL databases.
    Returns empty list if not available (e.g., SQLite).
    """
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_database_room_statistics()
        # Ensure response has the expected structure
        if "rooms" not in response:
            response = {"rooms": []}
        return response
    except HTTPException:
        raise
    except Exception as e:
        # Return empty response instead of error for unsupported databases
        # This endpoint only works with PostgreSQL
        return {"rooms": []}
    finally:
        if matrix_client:
            await matrix_client.close()

