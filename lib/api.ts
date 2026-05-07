import { removeAccessToken } from './cookies';

/**
 * Empty / same-origin: requests go to this Next.js origin (e.g. http://10.0.50.66:3000/api/...),
 * and next.config rewrites proxy to BACKEND_INTERNAL_URL. That avoids cross-origin Set-Cookie
 * blocking for SameSite=Lax session cookies.
 * Set NEXT_PUBLIC_API_URL to an absolute URL only if you intentionally use direct cross-origin API
 * (cookies will need SameSite=None; Secure over HTTPS, or same hostname as the page).
 */
function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw === undefined || raw === '' || raw === 'same-origin') {
    return '';
  }
  return raw.replace(/\/$/, '');
}

const API_BASE_URL = resolveApiBaseUrl();

// Debug: Log API URL in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log(
    'API base:',
    API_BASE_URL || '(same-origin /api proxy → BACKEND_INTERNAL_URL)',
  );
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Login establishes an HttpOnly session cookie; no token in the response body. */
export interface LoginResponse {
  token_type: string;
  message: string;
}

export interface User {
  id: number;
  username: string;
  matrix_user_id?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface DashboardStats {
  total_users: number;
  total_rooms: number;
  active_users_30d?: number;
  server_version?: string;
  total_nonbridged_users?: number;
  total_1pid_users?: number;
  total_3pid_users?: number;
  total_deactivated_users?: number;
  total_encrypted_rooms?: number;
  total_public_rooms?: number;
  total_private_rooms?: number;
  database_size?: string;
  users_by_type?: Record<string, number>;
  rooms_by_size?: Record<string, number>;
  daily_active_users?: Array<{ date: string; count: number }>;
}

export interface BackgroundUpdateInfo {
  name: string;
  total_item_count: number;
  total_duration_ms: number;
  average_items_per_ms?: number | null;
}

export interface BackgroundUpdatesStatus {
  enabled: boolean;
  current_updates?: Record<string, BackgroundUpdateInfo>;
}

export interface BackgroundUpdatesEnabled {
  enabled: boolean;
}

export interface StartBackgroundJobRequest {
  job_name: 'populate_stats_process_rooms' | 'regenerate_directory';
}

export interface FederationDestination {
  destination: string;
  retry_last_ts: number;
  retry_interval: number;
  failure_ts?: number | null;
  last_successful_stream_ordering?: number | null;
}

export interface FederationDestinationsResponse {
  destinations: FederationDestination[];
  next_token?: string | null;
  total: number;
}

export interface FederationDestinationRoom {
  room_id: string;
  stream_ordering: number;
}

export interface FederationDestinationRoomsResponse {
  rooms: FederationDestinationRoom[];
  next_token?: string | null;
  total: number;
}

export interface UserMediaStats {
  user_id: string;
  displayname?: string | null;
  media_length: number;
  media_count: number;
}

export interface UserMediaStatisticsResponse {
  users: UserMediaStats[];
  next_token?: string | null;
  total: number;
}

export interface DatabaseRoomStats {
  room_id: string;
  estimated_size: number;
}

export interface DatabaseRoomStatisticsResponse {
  rooms: DatabaseRoomStats[];
}

export interface FederationDestination {
  destination: string;
  retry_last_ts: number;
  retry_interval: number;
  failure_ts?: number | null;
  last_successful_stream_ordering?: number | null;
}

export interface FederationDestinationsResponse {
  destinations: FederationDestination[];
  next_token?: string | null;
  total: number;
}

export interface FederationDestinationRoom {
  room_id: string;
  stream_ordering: number;
}

export interface FederationDestinationRoomsResponse {
  rooms: FederationDestinationRoom[];
  next_token?: string | null;
  total: number;
}

export interface ThreePID {
  medium: string;
  address: string;
  added_at?: number;
  validated_at?: number;
}

export interface ExternalID {
  auth_provider: string;
  external_id: string;
}

export interface MatrixUser {
  name: string;
  displayname?: string | null;
  avatar_url?: string | null;
  admin?: boolean | number;
  deactivated?: boolean | number;
  erased?: boolean;
  creation_ts?: number;
  user_type?: string | null;
  is_guest?: number;
  threepids?: ThreePID[];
  locked?: boolean;
  shadow_banned?: number;
  appservice_id?: string | null;
  consent_server_notice_sent?: string | null;
  consent_version?: string | null;
  consent_ts?: number | null;
  external_ids?: ExternalID[];
}

export interface MatrixUsersResponse {
  users: MatrixUser[];
  next_token?: string;
  total?: number;
}

export interface MatrixRoom {
  room_id: string;
  name?: string;
  canonical_alias?: string;
  joined_members?: number;
  joined_local_members?: number;
  version?: string;
  creator?: string;
  encryption?: string;
  federatable?: boolean;
  public?: boolean;
  join_rules?: string;
  guest_access?: string;
  history_visibility?: string;
  state_events?: number;
}

export interface MatrixRoomsResponse {
  rooms: MatrixRoom[];
  next_batch?: string;
  total?: number;
}

/** Synapse-style /messages chunk entry (subset of fields the UI uses). */
export interface MatrixRoomEvent {
  type?: string;
  content?: Record<string, unknown>;
  event_id?: string;
  sender?: string;
  origin_server_ts?: number;
  state_key?: string;
  redacts?: string;
  unsigned?: Record<string, unknown>;
}

export interface MatrixRoomMessagesResponse {
  chunk?: MatrixRoomEvent[];
  start?: string;
  end?: string;
  state?: unknown;
}

/** Room detail payload from MAPS room admin API (subset used by the UI). */
export interface RoomAdminDetails {
  room?: Partial<MatrixRoom>;
  /** Total member count when returned at payload root (admin API). */
  total_members?: number;
  members?: string[];
  state?: MatrixRoomEvent[];
}

export interface Config {
  id: number;
  name: string;
  file_path: string;
  description?: string;
  file_format?: string;
  cache_ttl?: number;
  created_at: string;
  updated_at?: string;
}

export interface Log {
  id: number;
  name: string;
  file_path: string;
  description?: string;
  auto_reload?: boolean;
  reload_interval?: number;
  default_lines?: number;
  created_at: string;
  updated_at?: string;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies in requests
      });

    if (response.status === 401) {
      removeAccessToken();
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        // Avoid reload loop: login/home already run session checks without needing a hard redirect
        if (path !== '/login' && path !== '/') {
          window.location.href = '/login';
        }
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(errorText) as Record<string, unknown>;
      } catch {
        parsed = { detail: errorText || `HTTP error! status: ${response.status}` };
      }
      const detail = typeof parsed.detail === 'string' ? parsed.detail : undefined;
      const matrixError = typeof parsed.error === 'string' ? parsed.error : undefined;
      const errcode = typeof parsed.errcode === 'string' ? parsed.errcode : undefined;
      let errorMessage = detail || matrixError || `HTTP error! status: ${response.status}`;
      if (errcode && matrixError) {
        errorMessage = `${errcode}: ${matrixError}`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
          throw new Error(
            `Failed to connect to API at ${API_BASE_URL}. Make sure the backend server is running.`,
          );
        }
        throw error;
      }
      throw error;
    }
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/dashboard/stats');
  }

  async getUsers(from?: number, limit?: number, name?: string): Promise<MatrixUsersResponse> {
    const params = new URLSearchParams();
    if (from !== undefined) params.append('from_user', from.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (name) params.append('name', name);
    return this.request<MatrixUsersResponse>(`/api/users?${params.toString()}`);
  }

  async getUser(userId: string): Promise<MatrixUser> {
    return this.request<MatrixUser>(`/api/users/${encodeURIComponent(userId)}`);
  }

  async createUser(userData: Partial<MatrixUser>): Promise<MatrixUser> {
    return this.request<MatrixUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: Partial<MatrixUser>): Promise<MatrixUser> {
    return this.request<MatrixUser>(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deactivateUser(userId: string, erase?: boolean): Promise<void> {
    return this.request<void>(`/api/users/${encodeURIComponent(userId)}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ erase }),
    });
  }

  async deleteUser(userId: string): Promise<void> {
    return this.request<void>(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  async getRooms(from?: number, limit?: number, order_by?: string): Promise<MatrixRoomsResponse> {
    const params = new URLSearchParams();
    if (from !== undefined) params.append('from_room', from.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (order_by) params.append('order_by', order_by);
    return this.request<MatrixRoomsResponse>(`/api/rooms?${params.toString()}`);
  }

  async getRoom(roomId: string): Promise<MatrixRoom> {
    return this.request<MatrixRoom>(`/api/rooms/${encodeURIComponent(roomId)}`);
  }

  async getRoomDetails(roomId: string): Promise<RoomAdminDetails> {
    return this.request<RoomAdminDetails>(`/api/rooms/${encodeURIComponent(roomId)}/details`);
  }

  async getRoomMessages(
    roomId: string,
    fromToken?: string,
    limit?: number,
    dir: string = 'b',
  ): Promise<MatrixRoomMessagesResponse> {
    const params = new URLSearchParams();
    if (fromToken) params.append('from_token', fromToken);
    if (limit !== undefined) params.append('limit', limit.toString());
    if (dir) params.append('dir', dir);
    return this.request<MatrixRoomMessagesResponse>(
      `/api/rooms/${encodeURIComponent(roomId)}/messages?${params.toString()}`,
    );
  }

  async deleteRoom(roomId: string, newRoomUserId?: string): Promise<void> {
    return this.request<void>(`/api/rooms/${encodeURIComponent(roomId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ new_room_user_id: newRoomUserId }),
    });
  }

  async getConfigs(): Promise<Config[]> {
    return this.request<Config[]>('/api/configs');
  }

  async createConfig(config: { name: string; file_path: string; description?: string }): Promise<Config> {
    return this.request<Config>('/api/configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getConfigContent(configId: number, forceRefresh?: boolean): Promise<{ content: string; name: string; path: string; cached?: boolean }> {
    const params = new URLSearchParams();
    if (forceRefresh) params.append('force_refresh', 'true');
    const query = params.toString();
    return this.request<{ content: string; name: string; path: string; cached?: boolean }>(
      `/api/configs/${configId}/content${query ? `?${query}` : ''}`
    );
  }

  async updateConfigContent(configId: number, content: string): Promise<{ message: string; name: string; path: string }> {
    return this.request<{ message: string; name: string; path: string }>(`/api/configs/${configId}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async updateConfig(configId: number, config: Partial<Config>): Promise<Config> {
    return this.request<Config>(`/api/configs/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async deleteConfig(configId: number): Promise<void> {
    return this.request<void>(`/api/configs/${configId}`, {
      method: 'DELETE',
    });
  }

  async getLogs(): Promise<Log[]> {
    return this.request<Log[]>('/api/logs');
  }

  async createLog(log: { name: string; file_path: string; description?: string }): Promise<Log> {
    return this.request<Log>('/api/logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }

  async getLogContent(logId: number, lines?: number, forceRefresh?: boolean): Promise<{ content: string; name: string; path: string; total_lines: number; cached?: boolean }> {
    const params = new URLSearchParams();
    if (lines) params.append('lines', lines.toString());
    if (forceRefresh) params.append('force_refresh', 'true');
    return this.request<{ content: string; name: string; path: string; total_lines: number; cached?: boolean }>(
      `/api/logs/${logId}/content?${params.toString()}`
    );
  }

  async updateLog(logId: number, log: Partial<Log>): Promise<Log> {
    return this.request<Log>(`/api/logs/${logId}`, {
      method: 'PUT',
      body: JSON.stringify(log),
    });
  }

  async deleteLog(logId: number): Promise<void> {
    return this.request<void>(`/api/logs/${logId}`, {
      method: 'DELETE',
    });
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      removeAccessToken();
    }
  }

  // Background Updates
  async getBackgroundUpdatesStatus(): Promise<BackgroundUpdatesStatus> {
    return this.request<BackgroundUpdatesStatus>('/api/background-updates/status');
  }

  async getBackgroundUpdatesEnabled(): Promise<BackgroundUpdatesEnabled> {
    return this.request<BackgroundUpdatesEnabled>('/api/background-updates/enabled');
  }

  async setBackgroundUpdatesEnabled(enabled: boolean): Promise<BackgroundUpdatesEnabled> {
    return this.request<BackgroundUpdatesEnabled>('/api/background-updates/enabled', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async startBackgroundJob(
    jobName: StartBackgroundJobRequest['job_name'],
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/background-updates/start-job', {
      method: 'POST',
      body: JSON.stringify({ job_name: jobName }),
    });
  }

  // Federation
  async getFederationDestinations(
    from?: number,
    limit?: number,
    orderBy?: string,
    dir?: 'f' | 'b'
  ): Promise<FederationDestinationsResponse> {
    const params = new URLSearchParams();
    if (from !== undefined) params.append('from', from.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (orderBy) params.append('order_by', orderBy);
    if (dir) params.append('dir', dir);
    const query = params.toString();
    return this.request<FederationDestinationsResponse>(
      `/api/federation/destinations${query ? `?${query}` : ''}`
    );
  }

  async getFederationDestination(destination: string): Promise<FederationDestination> {
    return this.request<FederationDestination>(`/api/federation/destinations/${encodeURIComponent(destination)}`);
  }

  async getFederationDestinationRooms(
    destination: string,
    from?: number,
    limit?: number,
    dir?: 'f' | 'b'
  ): Promise<FederationDestinationRoomsResponse> {
    const params = new URLSearchParams();
    if (from !== undefined) params.append('from', from.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (dir) params.append('dir', dir);
    const query = params.toString();
    return this.request<FederationDestinationRoomsResponse>(
      `/api/federation/destinations/${encodeURIComponent(destination)}/rooms${query ? `?${query}` : ''}`
    );
  }

  async resetFederationConnection(destination: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/federation/destinations/${encodeURIComponent(destination)}/reset-connection`,
      {
        method: 'POST',
      },
    );
  }

  // Statistics
  async getUserMediaStatistics(
    from?: number,
    limit?: number,
    orderBy?: string,
    dir?: 'f' | 'b',
    fromTs?: number,
    untilTs?: number,
    searchTerm?: string
  ): Promise<UserMediaStatisticsResponse> {
    const params = new URLSearchParams();
    if (from !== undefined) params.append('from', from.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (orderBy) params.append('order_by', orderBy);
    if (dir) params.append('dir', dir);
    if (fromTs !== undefined) params.append('from_ts', fromTs.toString());
    if (untilTs !== undefined) params.append('until_ts', untilTs.toString());
    if (searchTerm) params.append('search_term', searchTerm);
    const query = params.toString();
    return this.request<UserMediaStatisticsResponse>(
      `/api/statistics/users/media${query ? `?${query}` : ''}`
    );
  }

  async getDatabaseRoomStatistics(): Promise<DatabaseRoomStatisticsResponse> {
    return this.request<DatabaseRoomStatisticsResponse>('/api/statistics/database/rooms');
  }
}

export const apiClient = new ApiClient();

