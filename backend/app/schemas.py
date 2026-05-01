from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# Auth schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    """Session is established via HttpOnly cookie; no token in response body."""

    token_type: str = "bearer"
    message: str = "Logged in"


class DeactivateUserRequest(BaseModel):
    erase: bool = False


class TokenData(BaseModel):
    username: Optional[str] = None


# User schemas
class UserBase(BaseModel):
    username: str
    matrix_user_id: Optional[str] = None


class UserCreate(UserBase):
    password: str
    matrix_server_url: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


# Config schemas
class ConfigBase(BaseModel):
    name: str
    file_path: str
    description: Optional[str] = None
    file_format: Optional[str] = "text"
    cache_ttl: Optional[int] = 300


class ConfigCreate(ConfigBase):
    pass


class ConfigUpdate(BaseModel):
    name: Optional[str] = None
    file_path: Optional[str] = None
    description: Optional[str] = None
    file_format: Optional[str] = None
    cache_ttl: Optional[int] = None


class ConfigContentUpdate(BaseModel):
    content: str


class ConfigResponse(ConfigBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Log schemas
class LogBase(BaseModel):
    name: str
    file_path: str
    description: Optional[str] = None
    auto_reload: Optional[bool] = False
    reload_interval: Optional[int] = 5
    default_lines: Optional[int] = 100


class LogCreate(LogBase):
    pass


class LogUpdate(BaseModel):
    name: Optional[str] = None
    file_path: Optional[str] = None
    description: Optional[str] = None
    auto_reload: Optional[bool] = None
    reload_interval: Optional[int] = None
    default_lines: Optional[int] = None


class LogResponse(LogBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Matrix API schemas
class MatrixUser(BaseModel):
    name: str
    displayname: Optional[str] = None
    avatar_url: Optional[str] = None
    admin: Optional[bool] = False
    deactivated: Optional[bool] = False
    erased: Optional[bool] = False
    creation_ts: Optional[int] = None
    user_type: Optional[str] = None
    is_guest: Optional[int] = 0
    threepids: Optional[List[Dict[str, Any]]] = None
    locked: Optional[bool] = False
    shadow_banned: Optional[int] = 0
    appservice_id: Optional[str] = None
    consent_server_notice_sent: Optional[str] = None
    consent_version: Optional[str] = None
    consent_ts: Optional[int] = None
    external_ids: Optional[List[Dict[str, Any]]] = None


class ThreePID(BaseModel):
    medium: str  # "email" or "msisdn"
    address: str


class ExternalID(BaseModel):
    auth_provider: str
    external_id: str


class MatrixUserCreate(BaseModel):
    username: Optional[str] = None  # Only for creating new users
    password: Optional[str] = None
    logout_devices: Optional[bool] = True
    displayname: Optional[str] = None
    avatar_url: Optional[str] = None
    threepids: Optional[List[ThreePID]] = None
    external_ids: Optional[List[ExternalID]] = None
    admin: Optional[bool] = False
    deactivated: Optional[bool] = None  # None means don't change
    user_type: Optional[str] = None  # null, "bot", "support"
    locked: Optional[bool] = None  # None means don't change


class MatrixUsersResponse(BaseModel):
    users: List[MatrixUser]
    next_token: Optional[str] = None
    total: Optional[int] = None


class MatrixRoom(BaseModel):
    room_id: str
    name: Optional[str] = None
    canonical_alias: Optional[str] = None
    joined_members: Optional[int] = 0
    joined_local_members: Optional[int] = 0
    version: Optional[str] = None
    creator: Optional[str] = None
    encryption: Optional[str] = None
    federatable: Optional[bool] = True
    public: Optional[bool] = False
    join_rules: Optional[str] = None
    guest_access: Optional[str] = None
    history_visibility: Optional[str] = None
    state_events: Optional[int] = 0


class MatrixRoomCreate(BaseModel):
    name: Optional[str] = None
    topic: Optional[str] = None
    preset: Optional[str] = None  # "private_chat", "public_chat", or "trusted_private_chat"
    room_alias_name: Optional[str] = None
    visibility: Optional[str] = None  # "public" or "private"
    invite: Optional[List[str]] = None  # List of user IDs to invite
    room_version: Optional[str] = None
    is_direct: Optional[bool] = False
    power_level_content_override: Optional[Dict[str, Any]] = None


class MatrixRoomUpdate(BaseModel):
    name: Optional[str] = None
    topic: Optional[str] = None
    join_rules: Optional[str] = None  # "public", "invite", "knock", or "private"
    guest_access: Optional[str] = None  # "can_join" or "forbidden"
    history_visibility: Optional[str] = None  # "invited", "joined", "shared", or "world_readable"


class MatrixRoomsResponse(BaseModel):
    rooms: List[MatrixRoom]
    next_batch: Optional[str] = None
    total: Optional[int] = None


class DashboardStats(BaseModel):
    total_users: int
    total_rooms: int
    active_users_30d: Optional[int] = None
    server_version: Optional[str] = None
    # Additional statistics
    total_nonbridged_users: Optional[int] = None
    total_1pid_users: Optional[int] = None
    total_3pid_users: Optional[int] = None
    total_deactivated_users: Optional[int] = None
    total_encrypted_rooms: Optional[int] = None
    total_public_rooms: Optional[int] = None
    total_private_rooms: Optional[int] = None
    database_size: Optional[str] = None
    # Statistics breakdown
    users_by_type: Optional[Dict[str, int]] = None
    rooms_by_size: Optional[Dict[str, int]] = None
    # Time-based stats (for charts)
    daily_active_users: Optional[List[Dict[str, Any]]] = None


# Statistics schemas
class UserMediaStats(BaseModel):
    user_id: str
    displayname: Optional[str] = None
    media_length: int
    media_count: int


class UserMediaStatisticsResponse(BaseModel):
    users: List[UserMediaStats]
    next_token: Optional[str] = None
    total: int


class DatabaseRoomStats(BaseModel):
    room_id: str
    estimated_size: int


class DatabaseRoomStatisticsResponse(BaseModel):
    rooms: List[DatabaseRoomStats]


# Background Updates schemas
class BackgroundUpdateInfo(BaseModel):
    name: str
    total_item_count: int
    total_duration_ms: float
    average_items_per_ms: Optional[float] = None


class BackgroundUpdatesStatus(BaseModel):
    enabled: bool
    current_updates: Optional[Dict[str, BackgroundUpdateInfo]] = None


class BackgroundUpdatesEnabled(BaseModel):
    enabled: bool


class StartBackgroundJobRequest(BaseModel):
    job_name: str  # "populate_stats_process_rooms" or "regenerate_directory"


# Federation schemas
class FederationDestination(BaseModel):
    destination: str
    retry_last_ts: int
    retry_interval: int
    failure_ts: Optional[int] = None
    last_successful_stream_ordering: Optional[int] = None


class FederationDestinationsResponse(BaseModel):
    destinations: List[FederationDestination]
    next_token: Optional[str] = None
    total: int


class FederationDestinationRoom(BaseModel):
    room_id: str
    stream_ordering: int


class FederationDestinationRoomsResponse(BaseModel):
    rooms: List[FederationDestinationRoom]
    next_token: Optional[str] = None
    total: int

