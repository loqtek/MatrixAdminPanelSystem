"""Federation management routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import User
from app.schemas import (
    FederationDestinationsResponse,
    FederationDestination,
    FederationDestinationRoomsResponse,
)
from app.auth import get_current_admin
from app.matrix_client import MatrixAdminClient
from app.matrix_token import plaintext_matrix_token
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/federation", tags=["federation"])


@router.get("/destinations", response_model=FederationDestinationsResponse)
async def get_federation_destinations(
    from_dest: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    order_by: Optional[str] = Query(None),
    dir: str = Query("f"),
    current_user: User = Depends(get_current_admin),
):
    """Get list of federation destinations"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_federation_destinations(
            from_dest=from_dest, limit=limit, order_by=order_by, dir=dir
        )
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get federation destinations", e),
        )


@router.get("/destinations/{destination}", response_model=FederationDestination)
async def get_federation_destination(
    destination: str,
    current_user: User = Depends(get_current_admin),
):
    """Get federation destination details"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_federation_destination(destination)
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get federation destination", e),
        )


@router.get("/destinations/{destination}/rooms", response_model=FederationDestinationRoomsResponse)
async def get_federation_destination_rooms(
    destination: str,
    from_room: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    dir: str = Query("f"),
    current_user: User = Depends(get_current_admin),
):
    """Get rooms for a federation destination"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_federation_destination_rooms(
            destination, from_room=from_room, limit=limit, dir=dir
        )
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get federation destination rooms", e),
        )


@router.post("/destinations/{destination}/reset-connection")
async def reset_federation_connection(
    destination: str,
    current_user: User = Depends(get_current_admin),
):
    """Reset connection timeout for a federation destination"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.reset_federation_connection(destination)
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to reset federation connection", e),
        )

