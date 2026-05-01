"""Room management routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import User
from app.schemas import MatrixRoom, MatrixRoomCreate, MatrixRoomUpdate, MatrixRoomsResponse
from app.auth import get_current_admin
from app.matrix_client import MatrixAdminClient
from app.matrix_token import plaintext_matrix_token
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("", response_model=MatrixRoomsResponse)
async def get_rooms(
    from_room: int = 0,
    limit: int = 100,
    order_by: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    """Get list of Matrix rooms"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_rooms(from_room=from_room, limit=limit, order_by=order_by)
        
        # Ensure response has the expected structure
        if not isinstance(response, dict):
            response = {"rooms": [], "total": 0}
        
        # Normalize response format
        if "rooms" not in response:
            response["rooms"] = []
        if "total" not in response:
            response["total"] = len(response.get("rooms", []))
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Rooms error: {public_error_detail('Failed to get rooms', e)}")
        print(traceback.format_exc())
        # Return empty response instead of failing completely
        return {"rooms": [], "total": 0, "next_batch": None}
    finally:
        if matrix_client:
            try:
                await matrix_client.close()
            except:
                pass


@router.get("/{room_id}", response_model=MatrixRoom)
async def get_room(room_id: str, current_user: User = Depends(get_current_admin)):
    """Get Matrix room details"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_room(room_id)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get room", e))


@router.post("", response_model=MatrixRoom)
async def create_room(
    room_data: MatrixRoomCreate, current_user: User = Depends(get_current_admin)
):
    """Create a new Matrix room"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        
        # Convert Pydantic model to dict, excluding None values
        create_data = room_data.dict(exclude_none=True)
        
        # Create the room using Client-Server API
        response = await matrix_client.create_room(create_data)
        
        # Get the created room details using Admin API
        room_id = response.get("room_id")
        if not room_id:
            raise HTTPException(status_code=500, detail="Room created but room_id not returned")
        
        # Fetch the full room details
        room_details = await matrix_client.get_room(room_id)
        await matrix_client.close()
        return room_details
    except HTTPException:
        raise
    except Exception as e:
        if matrix_client:
            try:
                await matrix_client.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to create room", e))


@router.put("/{room_id}", response_model=MatrixRoom)
async def update_room(
    room_id: str, room_data: MatrixRoomUpdate, current_user: User = Depends(get_current_admin)
):
    """Update Matrix room properties (name, topic, join rules, etc.)"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        
        # Convert Pydantic model to dict, excluding None values
        update_data = room_data.dict(exclude_none=True)
        
        # Update room name if provided
        if "name" in update_data:
            await matrix_client.update_room_state(
                room_id, "m.room.name", "", {"name": update_data["name"]}
            )
        
        # Update room topic if provided
        if "topic" in update_data:
            await matrix_client.update_room_state(
                room_id, "m.room.topic", "", {"topic": update_data["topic"]}
            )
        
        # Update join rules if provided
        if "join_rules" in update_data:
            await matrix_client.update_room_state(
                room_id, "m.room.join_rules", "", {"join_rule": update_data["join_rules"]}
            )
        
        # Update guest access if provided
        if "guest_access" in update_data:
            await matrix_client.update_room_state(
                room_id, "m.room.guest_access", "", {"guest_access": update_data["guest_access"]}
            )
        
        # Update history visibility if provided
        if "history_visibility" in update_data:
            await matrix_client.update_room_state(
                room_id, "m.room.history_visibility", "", {"history_visibility": update_data["history_visibility"]}
            )
        
        # Fetch updated room details
        room_details = await matrix_client.get_room(room_id)
        await matrix_client.close()
        return room_details
    except HTTPException:
        raise
    except Exception as e:
        if matrix_client:
            try:
                await matrix_client.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to update room", e))


@router.delete("/{room_id}")
async def delete_room(
    room_id: str,
    new_room_user_id: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
):
    """Delete a Matrix room"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.delete_room(room_id, new_room_user_id)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to delete room", e))


@router.get("/{room_id}/members")
async def get_room_members(room_id: str, current_user: User = Depends(get_current_admin)):
    """Get room members"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_room_members(room_id)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get room members", e))


@router.get("/{room_id}/state")
async def get_room_state(room_id: str, current_user: User = Depends(get_current_admin)):
    """Get room state events"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_room_state(room_id)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get room state", e))


@router.get("/{room_id}/details")
async def get_room_details(room_id: str, current_user: User = Depends(get_current_admin)):
    """Get comprehensive room details including room info, state, and members"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        
        # Fetch room info, state, and members in parallel
        room_info = await matrix_client.get_room(room_id)
        room_state = await matrix_client.get_room_state(room_id)
        room_members = await matrix_client.get_room_members(room_id)
        
        await matrix_client.close()
        
        return {
            "room": room_info,
            "state": room_state.get("state", []),
            "members": room_members.get("members", []),
            "total_members": room_members.get("total", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        if matrix_client:
            try:
                await matrix_client.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get room details", e))


@router.get("/{room_id}/messages")
async def get_room_messages(
    room_id: str,
    from_token: Optional[str] = None,
    limit: Optional[int] = 50,
    dir: str = "b",
    current_user: User = Depends(get_current_admin),
):
    """Get room messages"""
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )
        response = await matrix_client.get_room_messages(room_id, from_token=from_token, limit=limit, dir=dir)
        await matrix_client.close()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=public_error_detail("Failed to get room messages", e))

