'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiClient, DashboardStats, UserMediaStats, DatabaseRoomStats } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { showToast, formatError } from '@/lib/toast';

type TimeFilter = 'all' | '7d' | '30d' | '90d';

const COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-accent)',
  'color-mix(in srgb, var(--color-primary) 65%, var(--color-background))',
  'color-mix(in srgb, var(--color-accent) 65%, var(--color-background))',
  'color-mix(in srgb, var(--color-secondary) 65%, var(--color-background))',
];

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mediaStats, setMediaStats] = useState<UserMediaStats[]>([]);
  const [roomSizeStats, setRoomSizeStats] = useState<DatabaseRoomStats[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingRoomSizes, setLoadingRoomSizes] = useState(false);

  useEffect(() => {
    loadStats();
    loadMediaStats();
    loadRoomSizeStats();
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadStats();
        loadMediaStats();
        loadRoomSizeStats();
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, timeFilter]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getDashboardStats();
      setStats(data);
      setLastUpdated(new Date());
      setError('');
    } catch (err: any) {
      const errorMsg = formatError(err);
      setError(errorMsg);
      showToast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadMediaStats = async () => {
    try {
      setLoadingMedia(true);
      const now = Date.now();
      let fromTs: number | undefined;
      
      if (timeFilter === '7d') {
        fromTs = now - (7 * 24 * 60 * 60 * 1000);
      } else if (timeFilter === '30d') {
        fromTs = now - (30 * 24 * 60 * 60 * 1000);
      } else if (timeFilter === '90d') {
        fromTs = now - (90 * 24 * 60 * 60 * 1000);
      }

      const response = await apiClient.getUserMediaStatistics(
        0,
        50,
        'media_length',
        'b',
        fromTs,
        undefined,
        undefined
      );
      setMediaStats(response.users || []);
    } catch (err: any) {
      // Silently fail for media stats - not all servers support it
      console.error('Failed to load media stats:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const loadRoomSizeStats = async () => {
    try {
      setLoadingRoomSizes(true);
      const response = await apiClient.getDatabaseRoomStatistics();
      setRoomSizeStats(response.rooms || []);
    } catch (err: any) {
      // Silently fail for room size stats - not all servers support it
      console.error('Failed to load room size stats:', err);
    } finally {
      setLoadingRoomSizes(false);
    }
  };

  const userTypeData = useMemo(() => {
    if (!stats?.users_by_type) return [];
    return Object.entries(stats.users_by_type).map(([name, value]) => ({
      name: name === 'null' ? 'user' : name,
      value,
    }));
  }, [stats?.users_by_type]);

  const roomSizeData = useMemo(() => {
    if (!stats?.rooms_by_size) return [];
    return Object.entries(stats.rooms_by_size).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [stats?.rooms_by_size]);

  const roomTypeData = useMemo(() => {
    if (!stats) return [];
    const data = [];
    if (stats.total_public_rooms) {
      data.push({ name: 'Public', value: stats.total_public_rooms });
    }
    if (stats.total_private_rooms) {
      data.push({ name: 'Private', value: stats.total_private_rooms });
    }
    if (stats.total_encrypted_rooms) {
      data.push({ name: 'Encrypted', value: stats.total_encrypted_rooms });
    }
    return data;
  }, [stats]);

  const topMediaUsers = useMemo(() => {
    return mediaStats.slice(0, 10).map(user => ({
      name: user.displayname || user.user_id.split(':')[0].replace('@', ''),
      media_length: user.media_length,
      media_count: user.media_count,
      formatted_size: formatBytes(user.media_length),
    }));
  }, [mediaStats]);

  const topRoomSizes = useMemo(() => {
    return roomSizeStats.slice(0, 10).map(room => ({
      name: room.room_id.split(':')[0].replace('!', '').substring(0, 20) + '...',
      estimated_size: room.estimated_size,
      formatted_size: formatBytes(room.estimated_size),
    }));
  }, [roomSizeStats]);

  const totalMediaUsage = useMemo(() => {
    return mediaStats.reduce((sum, user) => sum + user.media_length, 0);
  }, [mediaStats]);

  const totalDatabaseSize = useMemo(() => {
    return roomSizeStats.reduce((sum, room) => sum + room.estimated_size, 0);
  }, [roomSizeStats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Dashboard"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--color-muted)]">Timeframe:</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
                id="autoRefresh"
              />
              <label htmlFor="autoRefresh" className="text-sm text-[var(--color-muted)]">
                Auto-refresh
              </label>
            </div>
            {lastUpdated && (
              <span className="text-sm text-[var(--color-muted)]">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="ghost" onClick={() => {
              loadStats();
              loadMediaStats();
              loadRoomSizeStats();
            }} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : 'Refresh'}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
                  Total Users
                </p>
                <p className="text-3xl font-bold text-[var(--color-foreground)]">
                  {stats?.total_users?.toLocaleString() || 0}
                </p>
                {stats?.total_deactivated_users && stats.total_deactivated_users > 0 && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {stats.total_deactivated_users} deactivated
                  </p>
                )}
              </div>
              <div className="p-3 bg-[var(--color-primary)]/10 rounded-full">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
                  Total Rooms
                </p>
                <p className="text-3xl font-bold text-[var(--color-foreground)]">
                  {stats?.total_rooms?.toLocaleString() || 0}
                </p>
                {stats?.total_encrypted_rooms && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {stats.total_encrypted_rooms} encrypted
                  </p>
                )}
              </div>
              <div className="p-3 bg-[var(--color-secondary)]/10 rounded-full">
                <svg className="w-6 h-6 text-[var(--color-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
                  Active Users (30d)
                </p>
                <p className="text-3xl font-bold text-[var(--color-foreground)]">
                  {stats?.active_users_30d !== undefined && stats.active_users_30d !== null
                    ? stats.active_users_30d.toLocaleString()
                    : 'N/A'}
                </p>
                {stats?.active_users_30d && stats?.total_users && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {Math.round((stats.active_users_30d / stats.total_users) * 100)}% of total
                  </p>
                )}
              </div>
              <div className="p-3 bg-[var(--color-accent)]/10 rounded-full">
                <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card hover>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wide mb-2">
                  Media Storage
                </p>
                <p className="text-3xl font-bold text-[var(--color-foreground)]">
                  {totalMediaUsage > 0 ? formatBytes(totalMediaUsage) : 'N/A'}
                </p>
                {mediaStats.length > 0 && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    {mediaStats.length} users
                  </p>
                )}
              </div>
              <div className="p-3 bg-[var(--color-primary)]/10 rounded-full">
                <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {stats?.total_public_rooms !== undefined && stats.total_public_rooms !== null && (
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-[var(--color-muted)] mb-1">Public Rooms</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)]">
                {stats.total_public_rooms.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
        {stats?.total_private_rooms !== undefined && stats.total_private_rooms !== null && (
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-[var(--color-muted)] mb-1">Private Rooms</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)]">
                {stats.total_private_rooms.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
        {stats?.total_3pid_users !== undefined && stats.total_3pid_users !== null && (
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-[var(--color-muted)] mb-1">Users with 3PID</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)]">
                {stats.total_3pid_users.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
        {stats?.total_nonbridged_users !== undefined && stats.total_nonbridged_users !== null && (
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-[var(--color-muted)] mb-1">Non-bridged Users</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)]">
                {stats.total_nonbridged_users.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
        {totalDatabaseSize > 0 && (
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-[var(--color-muted)] mb-1">Database Size</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)]">
                {formatBytes(totalDatabaseSize)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Type Chart */}
        {userTypeData.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
                Users by Type
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={userTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''}: ${percent !== undefined ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={80}
                    fill="var(--color-primary)"
                    dataKey="value"
                  >
                    {userTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Rooms by Size Chart */}
        {roomSizeData.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
                Rooms by Size
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roomSizeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-foreground)" />
                  <YAxis stroke="var(--color-foreground)" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-accent)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Room Types Chart */}
        {roomTypeData.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
                Room Types
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={roomTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''}: ${percent !== undefined ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={80}
                    fill="var(--color-primary)"
                    dataKey="value"
                  >
                    {roomTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Media Users */}
        {topMediaUsers.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
                Top Media Users ({timeFilter === 'all' ? 'All Time' : timeFilter.toUpperCase()})
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topMediaUsers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" stroke="var(--color-foreground)" />
                  <YAxis dataKey="name" type="category" width={100} stroke="var(--color-foreground)" />
                  <Tooltip 
                    formatter={(value: any) => typeof value === 'number' ? formatBytes(value) : String(value || '')}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="media_length" fill="var(--color-primary)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top Room Sizes */}
        {topRoomSizes.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
                Largest Rooms (Database Size)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topRoomSizes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" stroke="var(--color-foreground)" />
                  <YAxis dataKey="name" type="category" width={100} stroke="var(--color-foreground)" />
                  <Tooltip 
                    formatter={(value: any) => typeof value === 'number' ? formatBytes(value) : String(value || '')}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="estimated_size" fill="var(--color-secondary)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Server Information */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
              Server Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-muted)]">Server Version</span>
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  {stats?.server_version || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-muted)]">Total Users</span>
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  {stats?.total_users?.toLocaleString() || 0}
                </span>
              </div>
              {stats?.total_deactivated_users !== undefined && stats.total_deactivated_users !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-muted)]">Deactivated Users</span>
                  <span className="text-sm font-medium text-[var(--color-foreground)]">
                    {stats.total_deactivated_users.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-muted)]">Total Rooms</span>
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  {stats?.total_rooms?.toLocaleString() || 0}
                </span>
              </div>
              {stats?.active_users_30d !== undefined && stats.active_users_30d !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-muted)]">Active (30d)</span>
                  <span className="text-sm font-medium text-[var(--color-foreground)]">
                    {stats.active_users_30d.toLocaleString()}
                  </span>
                </div>
              )}
              {totalMediaUsage > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-muted)]">Total Media Storage</span>
                  <span className="text-sm font-medium text-[var(--color-foreground)]">
                    {formatBytes(totalMediaUsage)}
                  </span>
                </div>
              )}
              {totalDatabaseSize > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-muted)]">Database Size</span>
                  <span className="text-sm font-medium text-[var(--color-foreground)]">
                    {formatBytes(totalDatabaseSize)}
                  </span>
                </div>
              )}
              {lastUpdated && (
                <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                  <span className="text-sm text-[var(--color-muted)]">Last Updated</span>
                  <span className="text-sm font-medium text-[var(--color-foreground)]">
                    {lastUpdated.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
