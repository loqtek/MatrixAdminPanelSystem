"""User management routes"""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import User
from app.schemas import (
    DeactivateUserRequest,
    MatrixUser,
    MatrixUserCreate,
    MatrixUsersResponse,
)
from app.auth import get_current_admin
from app.matrix_client import MatrixAdminClient
from app.matrix_token import plaintext_matrix_token
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=MatrixUsersResponse)
async def get_users(
    from_user: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    """Get list of Matrix users"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_users(from_user=from_user, limit=limit, name=name)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get users", e))


@router.get("/{user_id}", response_model=MatrixUser)
async def get_user(user_id: str, current_user: User = Depends(get_current_admin)):
    """Get Matrix user details"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_user(user_id)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get user", e))


@router.post("", response_model=MatrixUser)
async def create_user(
    user_data: MatrixUserCreate, current_user: User = Depends(get_current_admin)
):
    """Create a new Matrix user"""
    try:
        if not user_data.username:
            raise HTTPException(status_code=400, detail="Username is required to create a user")
        
        # Extract server name from current user's matrix_user_id (e.g., @admin:example.com -> example.com)
        if not current_user.matrix_user_id:
            raise HTTPException(status_code=500, detail="Current user matrix_user_id not found")
        
        server_name = current_user.matrix_user_id.split(':')[-1] if ':' in current_user.matrix_user_id else None
        if not server_name:
            raise HTTPException(status_code=500, detail="Could not extract server name from current user")
        
        # Construct full user_id
        username = user_data.username.lstrip('@')  # Remove @ if present
        user_id = f"@{username}:{server_name}"
        
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        # Convert Pydantic models to dict, handling nested models properly
        create_data = user_data.dict(exclude_none=True, exclude={'username'})
        # Convert threepids and external_ids if present
        if 'threepids' in create_data and create_data['threepids']:
            create_data['threepids'] = [tpid.dict() if hasattr(tpid, 'dict') else tpid for tpid in create_data['threepids']]
        if 'external_ids' in create_data and create_data['external_ids']:
            create_data['external_ids'] = [eid.dict() if hasattr(eid, 'dict') else eid for eid in create_data['external_ids']]
        
        # Use PUT endpoint with full user_id for creating users
        response = await matrix_client.update_user(user_id, create_data)
        await matrix_client.close()
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to create user", e))


@router.put("/{user_id}", response_model=MatrixUser)
async def update_user(
    user_id: str, user_data: MatrixUserCreate, current_user: User = Depends(get_current_admin)
):
    """Update Matrix user"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        # Convert Pydantic models to dict, handling nested models properly
        update_data = user_data.dict(exclude_none=True, exclude={'username'})
        # Convert threepids and external_ids if present
        if 'threepids' in update_data and update_data['threepids']:
            update_data['threepids'] = [tpid.dict() if hasattr(tpid, 'dict') else tpid for tpid in update_data['threepids']]
        if 'external_ids' in update_data and update_data['external_ids']:
            update_data['external_ids'] = [eid.dict() if hasattr(eid, 'dict') else eid for eid in update_data['external_ids']]
        response = await matrix_client.update_user(user_id, update_data)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to update user", e))


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    body: DeactivateUserRequest = Body(default=DeactivateUserRequest()),
    current_user: User = Depends(get_current_admin),
):
    """Deactivate a Matrix user"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.deactivate_user(user_id, erase=body.erase)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to deactivate user", e))


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_admin)):
    """Delete a Matrix user (permanently remove)"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        # First deactivate and erase
        await matrix_client.deactivate_user(user_id, erase=True)
        # Note: Matrix doesn't have a direct delete endpoint, deactivation with erase is the closest
        await matrix_client.close()
        return {"message": f"User {user_id} has been deactivated and erased"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to delete user", e))

