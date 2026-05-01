import httpx
from typing import Optional, Dict, Any, List
from fastapi import HTTPException

from app.security_errors import public_error_detail


class MatrixAdminClient:
    def __init__(self, server_url: str, access_token: str):
        self.server_url = server_url.rstrip("/")
        self.access_token = access_token
        self.base_url = f"{self.server_url}/_synapse/admin/v2"
        self.client = httpx.AsyncClient(timeout=30.0)

    async def _request(
        self, method: str, endpoint: str, params: Optional[Dict] = None, json_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make a request to the Matrix Admin API"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            response = await self.client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_data,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            elif e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Resource not found")
            else:
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=public_error_detail("Matrix API error", e),
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def login(self, username: str, password: str) -> Dict[str, Any]:
        """Login to Matrix and get access token"""
        login_url = f"{self.server_url}/_matrix/client/v3/login"
        login_data = {
            "type": "m.login.password",
            "identifier": {"type": "m.id.user", "user": username},
            "password": password,
        }

        try:
            response = await self.client.post(login_url, json=login_data)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix credentials")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=public_error_detail("Matrix login error", e),
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def get_server_version(self) -> str:
        """Get Synapse server version"""
        try:
            # Try v2 endpoint first
            response = await self._request("GET", "/server_version")
            version = response.get("server_version", "unknown")
            if version and version != "unknown":
                return version
        except:
            pass
        
        # Try v1 endpoint
        try:
            v1_url = f"{self.server_url}/_synapse/admin/v1/server_version"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
            )
            response.raise_for_status()
            result = response.json() if response.content else {}
            version = result.get("server_version", "unknown")
            if version and version != "unknown":
                return version
        except:
            pass
        
        return "unknown"

    # User management
    async def get_users(
        self, from_user: Optional[int] = 0, limit: Optional[int] = 100, name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get list of users"""
        params = {"from": from_user, "limit": limit}
        if name:
            params["name"] = name
        return await self._request("GET", "/users", params=params)

    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get user details"""
        return await self._request("GET", f"/users/{user_id}")

    async def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new user"""
        # Matrix Admin API uses PUT for creating users with specific user_id
        # If username is provided, construct the full user_id
        if "username" in user_data:
            username = user_data.pop("username")
            # Extract server name from current user's server URL
            from urllib.parse import urlparse
            parsed = urlparse(self.server_url)
            server_name = parsed.netloc or parsed.path.split('/')[0]
            user_id = f"@{username}:{server_name}"
            return await self._request("PUT", f"/users/{user_id}", json_data=user_data)
        return await self._request("POST", "/users", json_data=user_data)

    async def update_user(self, user_id: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user details"""
        return await self._request("PUT", f"/users/{user_id}", json_data=user_data)

    async def deactivate_user(self, user_id: str, erase: bool = False) -> Dict[str, Any]:
        """Deactivate a user"""
        return await self._request("POST", f"/users/{user_id}/deactivate", json_data={"erase": erase})

    # Room management
    async def get_rooms(
        self, from_room: Optional[int] = 0, limit: Optional[int] = 100, order_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get list of rooms"""
        # Matrix Synapse Admin API uses v1 for rooms, not v2
        params = {"from": from_room, "limit": limit}
        if order_by:
            params["order_by"] = order_by
        
        try:
            # Try v1 endpoint first (most common)
            v1_url = f"{self.server_url}/_synapse/admin/v1/rooms"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
                params=params,
            )
            response.raise_for_status()
            result = response.json() if response.content else {}
            # Normalize response format
            if "rooms" not in result:
                result["rooms"] = []
            if "total" not in result:
                result["total"] = len(result.get("rooms", []))
            return result
        except httpx.HTTPStatusError as e:
            # If v1 fails, try v2 endpoint
            if e.response.status_code == 404:
                try:
                    return await self._request("GET", "/rooms", params=params)
                except:
                    # If both fail, return empty result
                    return {"rooms": [], "total": 0}
            elif e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            else:
                # For other errors, return empty result rather than failing
                return {"rooms": [], "total": 0}
        except Exception:
            # On any other error, return empty result
            return {"rooms": [], "total": 0}

    async def get_room(self, room_id: str) -> Dict[str, Any]:
        """Get room details"""
        # Matrix room IDs are URL-safe (format: !abc123:example.com)
        # we need to encode them for use in URL paths
        # Use httpx URL building to handle encoding properly
        from urllib.parse import quote
        
        # Encode the room_id, but preserve ! and : which are valid in Matrix room IDs
        # Some servers may require encoding, so we'll encode but preserve the Matrix-specific chars
        encoded_room_id = quote(room_id, safe='!:$')
        
        # Try v1 endpoint first (most common for rooms)
        try:
            v1_url = f"{self.server_url}/_synapse/admin/v1/rooms/{encoded_room_id}"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            # If v1 fails, try v2 endpoint
            if e.response.status_code == 404:
                try:
                    return await self._request("GET", f"/rooms/{encoded_room_id}")
                except:
                    raise HTTPException(status_code=404, detail="Room not found")
            elif e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            else:
                error_text = e.response.text
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get("error", error_text)
                except:
                    error_detail = error_text
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Matrix API error: {error_detail}",
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def delete_room(self, room_id: str, new_room_user_id: Optional[str] = None) -> Dict[str, Any]:
        """Delete a room"""
        from urllib.parse import quote
        encoded_room_id = quote(room_id, safe='!:')
        json_data = {}
        if new_room_user_id:
            json_data["new_room_user_id"] = new_room_user_id
        return await self._request("DELETE", f"/rooms/{encoded_room_id}", json_data=json_data)

    async def get_room_members(self, room_id: str) -> Dict[str, Any]:
        """Get room members"""
        from urllib.parse import quote
        encoded_room_id = quote(room_id, safe='!:')
        # Room members API uses v1, not v2
        try:
            v1_url = f"{self.server_url}/_synapse/admin/v1/rooms/{encoded_room_id}/members"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            elif e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Room not found")
            else:
                error_text = e.response.text
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get("error", error_text)
                except:
                    error_detail = error_text
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Matrix API error: {error_detail}",
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def get_room_state(self, room_id: str) -> Dict[str, Any]:
        """Get room state events"""
        from urllib.parse import quote
        encoded_room_id = quote(room_id, safe='!:')
        # Room state API uses v1, not v2
        try:
            v1_url = f"{self.server_url}/_synapse/admin/v1/rooms/{encoded_room_id}/state"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            elif e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Room not found")
            else:
                error_text = e.response.text
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get("error", error_text)
                except:
                    error_detail = error_text
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Matrix API error: {error_detail}",
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def get_room_messages(
        self, room_id: str, from_token: Optional[str] = None, limit: Optional[int] = None, dir: str = "b"
    ) -> Dict[str, Any]:
        """Get room messages"""
        from urllib.parse import quote
        encoded_room_id = quote(room_id, safe='!:')
        # Room messages API uses v1, not v2
        try:
            v1_url = f"{self.server_url}/_synapse/admin/v1/rooms/{encoded_room_id}/messages"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            params = {}
            if from_token:
                params["from"] = from_token
            if limit:
                params["limit"] = limit
            if dir:
                params["dir"] = dir
            
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
                params=params if params else None,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            elif e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Room not found")
            else:
                error_text = e.response.text
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get("error", error_text)
                except:
                    error_detail = error_text
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Failed to get room messages: {error_detail}",
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def create_room(self, room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new room using the Client-Server API"""
        # Use Client-Server API for room creation
        create_room_url = f"{self.server_url}/_matrix/client/v3/createRoom"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = await self.client.request(
                method="POST",
                url=create_room_url,
                headers=headers,
                json=room_data,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            else:
                error_text = e.response.text
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get("error", error_text)
                except:
                    error_detail = error_text
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Failed to create room: {error_detail}",
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    async def update_room_state(
        self, room_id: str, event_type: str, state_key: str, content: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update room state by sending a state event"""
        # Use Client-Server API for state events
        state_url = f"{self.server_url}/_matrix/client/v3/rooms/{room_id}/state/{event_type}"
        if state_key:
            state_url += f"/{state_key}"
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = await self.client.request(
                method="PUT",
                url=state_url,
                headers=headers,
                json=content,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid Matrix access token")
            elif e.response.status_code == 403:
                raise HTTPException(status_code=403, detail="Insufficient permissions or insufficient power level")
            elif e.response.status_code == 404:
                raise HTTPException(status_code=404, detail="Room not found")
            else:
                error_text = e.response.text
                try:
                    error_json = e.response.json()
                    error_detail = error_json.get("error", error_text)
                except:
                    error_detail = error_text
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Failed to update room state: {error_detail}",
                )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=public_error_detail("Failed to connect to Matrix server", e),
            )

    # Statistics
    async def get_statistics(self) -> Dict[str, Any]:
        """Get server statistics"""
        # Try v1 endpoint first (most common)
        try:
            v1_url = f"{self.server_url}/_synapse/admin/v1/statistics"
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = await self.client.request(
                method="GET",
                url=v1_url,
                headers=headers,
            )
            response.raise_for_status()
            return response.json() if response.content else {}
        except:
            pass
        
        # Try v2 endpoint
        try:
            return await self._request("GET", "/statistics")
        except:
            return {}

    async def get_user_media_statistics(
        self,
        from_user: Optional[int] = 0,
        limit: Optional[int] = 100,
        order_by: Optional[str] = None,
        dir: Optional[str] = "f",
        from_ts: Optional[int] = None,
        until_ts: Optional[int] = None,
        search_term: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get users' media usage statistics"""
        url = f"{self.server_url}/_synapse/admin/v1/statistics/users/media"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        params = {"from": from_user, "limit": limit}
        if order_by:
            params["order_by"] = order_by
        if dir:
            params["dir"] = dir
        if from_ts:
            params["from_ts"] = from_ts
        if until_ts:
            params["until_ts"] = until_ts
        if search_term:
            params["search_term"] = search_term
        response = await self.client.request(method="GET", url=url, headers=headers, params=params)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def get_database_room_statistics(self) -> Dict[str, Any]:
        """Get largest rooms by database size
        
        Note: This endpoint only works with PostgreSQL databases.
        Returns empty dict if not available (e.g., SQLite or endpoint not supported).
        """
        url = f"{self.server_url}/_synapse/admin/v1/statistics/database/rooms"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        try:
            response = await self.client.request(method="GET", url=url, headers=headers)
            response.raise_for_status()
            return response.json() if response.content else {}
        except Exception as e:
            # This endpoint only works with PostgreSQL, not SQLite
            # Return empty response instead of raising error
            if "400" in str(e) or "Bad Request" in str(e):
                return {"rooms": []}
            raise

    # Background Updates
    async def get_background_updates_status(self) -> Dict[str, Any]:
        """Get background updates status"""
        url = f"{self.server_url}/_synapse/admin/v1/background_updates/status"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        response = await self.client.request(method="GET", url=url, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def get_background_updates_enabled(self) -> Dict[str, Any]:
        """Get whether background updates are enabled"""
        url = f"{self.server_url}/_synapse/admin/v1/background_updates/enabled"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        response = await self.client.request(method="GET", url=url, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def set_background_updates_enabled(self, enabled: bool) -> Dict[str, Any]:
        """Enable or disable background updates"""
        url = f"{self.server_url}/_synapse/admin/v1/background_updates/enabled"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        json_data = {"enabled": enabled}
        response = await self.client.request(method="POST", url=url, headers=headers, json=json_data)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def start_background_job(self, job_name: str) -> Dict[str, Any]:
        """Start a specific background update job"""
        url = f"{self.server_url}/_synapse/admin/v1/background_updates/start_job"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        json_data = {"job_name": job_name}
        response = await self.client.request(method="POST", url=url, headers=headers, json=json_data)
        response.raise_for_status()
        return response.json() if response.content else {}

    # Federation
    async def get_federation_destinations(
        self, from_dest: Optional[int] = 0, limit: Optional[int] = 100, 
        order_by: Optional[str] = None, dir: Optional[str] = "f"
    ) -> Dict[str, Any]:
        """Get list of federation destinations"""
        url = f"{self.server_url}/_synapse/admin/v1/federation/destinations"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        params = {"from": from_dest, "limit": limit}
        if order_by:
            params["order_by"] = order_by
        if dir:
            params["dir"] = dir
        response = await self.client.request(method="GET", url=url, headers=headers, params=params)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def get_federation_destination(self, destination: str) -> Dict[str, Any]:
        """Get federation destination details"""
        url = f"{self.server_url}/_synapse/admin/v1/federation/destinations/{destination}"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        response = await self.client.request(method="GET", url=url, headers=headers)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def get_federation_destination_rooms(
        self, destination: str, from_room: Optional[int] = 0, 
        limit: Optional[int] = 100, dir: Optional[str] = "f"
    ) -> Dict[str, Any]:
        """Get rooms for a federation destination"""
        url = f"{self.server_url}/_synapse/admin/v1/federation/destinations/{destination}/rooms"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        params = {"from": from_room, "limit": limit}
        if dir:
            params["dir"] = dir
        response = await self.client.request(method="GET", url=url, headers=headers, params=params)
        response.raise_for_status()
        return response.json() if response.content else {}

    async def reset_federation_connection(self, destination: str) -> Dict[str, Any]:
        """Reset connection timeout for a federation destination"""
        url = f"{self.server_url}/_synapse/admin/v1/federation/destinations/{destination}/reset_connection"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        response = await self.client.request(method="POST", url=url, headers=headers, json={})
        response.raise_for_status()
        return response.json() if response.content else {}

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


