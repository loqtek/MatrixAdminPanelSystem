"""Dashboard routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import DashboardStats
from app.auth import get_current_admin
from app.matrix_client import MatrixAdminClient
from app.matrix_token import plaintext_matrix_token
from app.security_errors import public_error_detail

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_admin)):
    """Get dashboard statistics"""
    matrix_client = None
    try:
        matrix_client = MatrixAdminClient(
            current_user.matrix_server_url, plaintext_matrix_token(current_user)
        )

        # Get users count and collect all users for statistics
        total_users = 0
        all_users = []
        try:
            # Fetch users with pagination to get accurate count
            from_user = 0
            limit = 100
            while True:
                users_response = await matrix_client.get_users(from_user=from_user, limit=limit)
                if not isinstance(users_response, dict):
                    break
                
                users_list = users_response.get("users", [])
                if not users_list:
                    break
                
                all_users.extend(users_list)
                
                # Get total from first response
                if total_users == 0:
                    total_users = users_response.get("total", len(users_list))
                
                # Check if we got all users
                if len(users_list) < limit or len(all_users) >= total_users:
                    break
                
                from_user += limit
        except Exception as e:
            print(f"Error getting users: {str(e)}")
            # Fallback: try to get at least the count
            try:
                users_response = await matrix_client.get_users(limit=1)
                if isinstance(users_response, dict):
                    total_users = users_response.get("total", 0)
            except:
                pass

        # Get rooms count and collect all rooms for statistics
        total_rooms = 0
        all_rooms = []
        try:
            # Fetch rooms with pagination to get accurate count
            from_room = 0
            limit = 100
            while True:
                rooms_response = await matrix_client.get_rooms(from_room=from_room, limit=limit)
                if not isinstance(rooms_response, dict):
                    break
                
                rooms_list = rooms_response.get("rooms", [])
                if not rooms_list:
                    break
                
                all_rooms.extend(rooms_list)
                
                # Get total from first response
                if total_rooms == 0:
                    total_rooms = rooms_response.get("total", len(rooms_list))
                
                # Check if we got all rooms
                if len(rooms_list) < limit or len(all_rooms) >= total_rooms:
                    break
                
                from_room += limit
        except Exception as e:
            print(f"Error getting rooms: {str(e)}")
            # Fallback: try to get at least the count
            try:
                rooms_response = await matrix_client.get_rooms(limit=1)
                if isinstance(rooms_response, dict):
                    total_rooms = rooms_response.get("total", 0)
            except:
                pass

        # Get server version
        server_version = "unknown"
        try:
            server_version = await matrix_client.get_server_version()
            if not server_version or server_version == "unknown":
                server_version = "unknown"
        except Exception as e:
            print(f"Error getting server version: {str(e)}")

        # Initialize statistics
        active_users_30d = None
        total_nonbridged_users = None
        total_1pid_users = None
        total_3pid_users = None
        total_deactivated_users = 0
        total_encrypted_rooms = None
        total_public_rooms = None
        total_private_rooms = None
        users_by_type = {}
        rooms_by_size = {}
        
        # Flags to track if we got values from API
        got_encrypted_from_api = False
        got_public_from_api = False
        got_private_from_api = False
        
        # Try to get detailed statistics from API (may not be available)
        try:
            stats = await matrix_client.get_statistics()
            if stats and isinstance(stats, dict):
                # User statistics
                if "users" in stats:
                    users_stats = stats["users"]
                    active_users_30d = users_stats.get("monthly_active_users")
                    total_nonbridged_users = users_stats.get("total")
                    total_1pid_users = users_stats.get("all_users")
                    total_3pid_users = users_stats.get("registered_users")
                
                # Room statistics
                if "rooms" in stats:
                    rooms_stats = stats["rooms"]
                    if rooms_stats.get("encrypted") is not None:
                        total_encrypted_rooms = rooms_stats.get("encrypted", 0)
                        got_encrypted_from_api = True
                    if rooms_stats.get("public") is not None:
                        total_public_rooms = rooms_stats.get("public", 0)
                        got_public_from_api = True
                    if rooms_stats.get("private") is not None:
                        total_private_rooms = rooms_stats.get("private", 0)
                        got_private_from_api = True
        except Exception as e:
            print(f"Error getting statistics from API: {str(e)}")

        # Calculate user statistics from actual user data
        try:
            if all_users:
                nonbridged_count = 0
                threepid_count = 0
                
                for user in all_users:
                    # User type breakdown
                    user_type = user.get("user_type")
                    if not user_type or user_type == "null":
                        user_type = "user"
                    users_by_type[user_type] = users_by_type.get(user_type, 0) + 1
                    
                    # Deactivated users
                    if user.get("deactivated"):
                        total_deactivated_users += 1
                    
                    # Count users with threepids (3pid users)
                    if user.get("threepids") and len(user.get("threepids", [])) > 0:
                        threepid_count += 1
                    
                    # Count non-bridged users (users without appservice_id)
                    if not user.get("appservice_id"):
                        nonbridged_count += 1
                
                # Use calculated values if API didn't provide them
                if total_nonbridged_users is None:
                    total_nonbridged_users = nonbridged_count
                if total_3pid_users is None:
                    total_3pid_users = threepid_count
                if total_1pid_users is None:
                    total_1pid_users = total_users
        except Exception as e:
            print(f"Error calculating user statistics: {str(e)}")

        # Calculate room statistics from actual room data
        try:
            if all_rooms:
                encrypted_count = 0
                public_count = 0
                private_count = 0
                
                for room in all_rooms:
                    # Room size breakdown
                    members = room.get("joined_members", 0) or 0
                    if members == 0:
                        size_key = "empty"
                    elif members < 10:
                        size_key = "small"
                    elif members < 100:
                        size_key = "medium"
                    else:
                        size_key = "large"
                    rooms_by_size[size_key] = rooms_by_size.get(size_key, 0) + 1
                    
                    # Encrypted rooms
                    encryption = room.get("encryption")
                    if encryption:
                        encrypted_count += 1
                    
                    # Public vs private rooms
                    is_public = room.get("public", False)
                    join_rules = room.get("join_rules", "")
                    if is_public or join_rules == "public":
                        public_count += 1
                    else:
                        private_count += 1
                
                # Use calculated values if API didn't provide them
                if not got_encrypted_from_api:
                    total_encrypted_rooms = encrypted_count
                if not got_public_from_api:
                    total_public_rooms = public_count
                if not got_private_from_api:
                    total_private_rooms = private_count
        except Exception as e:
            print(f"Error calculating room statistics: {str(e)}")

        # Return actual calculated values (including 0 when we know there are none)
        # Only use None for values we truly cannot determine (like monthly_active_users from API)
        return DashboardStats(
            total_users=total_users,
            total_rooms=total_rooms,
            active_users_30d=active_users_30d,  # Only available from statistics API
            server_version=server_version if server_version != "unknown" else None,
            total_nonbridged_users=total_nonbridged_users if total_nonbridged_users is not None else (len(all_users) if all_users else 0),
            total_1pid_users=total_1pid_users if total_1pid_users is not None else total_users,
            total_3pid_users=total_3pid_users if total_3pid_users is not None else 0,
            total_deactivated_users=total_deactivated_users if len(all_users) > 0 else None,
            total_encrypted_rooms=total_encrypted_rooms if len(all_rooms) > 0 else None,
            total_public_rooms=total_public_rooms if len(all_rooms) > 0 else None,
            total_private_rooms=total_private_rooms if len(all_rooms) > 0 else None,
            users_by_type=users_by_type if users_by_type else None,
            rooms_by_size=rooms_by_size if rooms_by_size else None,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Dashboard stats error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=public_error_detail("Failed to get stats", e),
        )
    finally:
        if matrix_client:
            try:
                await matrix_client.close()
            except:
                pass

