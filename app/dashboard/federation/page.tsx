'use client';

import { useEffect, useState } from 'react';
import { apiClient, FederationDestination, FederationDestinationRoom } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { showToast, formatError } from '@/lib/toast';
import { ArrowDown, ArrowUp, RefreshCcw } from 'lucide-react';

type OrderBy = 'destination' | 'retry_last_ts' | 'retry_interval' | 'failure_ts' | 'last_successful_stream_ordering';

export default function FederationPage() {
  const [destinations, setDestinations] = useState<FederationDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);
  const [orderBy, setOrderBy] = useState<OrderBy>('destination');
  const [dir, setDir] = useState<'f' | 'b'>('f');
  const [selectedDestination, setSelectedDestination] = useState<FederationDestination | null>(null);
  const [destinationRooms, setDestinationRooms] = useState<FederationDestinationRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    loadDestinations();
  }, [currentPage, orderBy, dir]);

  const loadDestinations = async () => {
    try {
      setLoading(true);
      setError('');
      const from = currentPage * pageSize;
      const response = await apiClient.getFederationDestinations(from, pageSize, orderBy, dir);
      setDestinations(response.destinations || []);
      setTotal(response.total || 0);
      setNextToken(response.next_token || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load federation destinations');
      showToast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadDestinationRooms = async (destination: string) => {
    try {
      setRoomsLoading(true);
      const response = await apiClient.getFederationDestinationRooms(destination, 0, 100);
      setDestinationRooms(response.rooms || []);
      setSelectedDestination(destinations.find(d => d.destination === destination) || null);
    } catch (err: any) {
      showToast.error(formatError(err));
    } finally {
      setRoomsLoading(false);
    }
  };

  const handleResetConnection = async (destination: string) => {
    if (!confirm(`Are you sure you want to reset the connection timeout for ${destination}?`)) {
      return;
    }

    try {
      setResetting(destination);
      await apiClient.resetFederationConnection(destination);
      showToast.success(`Connection reset for ${destination}`);
      await loadDestinations();
    } catch (err: any) {
      showToast.error(formatError(err));
    } finally {
      setResetting(null);
    }
  };

  const formatTimestamp = (ts: number): string => {
    if (ts === 0) return 'Never';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  const formatDuration = (ms: number): string => {
    if (ms === 0) return 'No retry';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  const getStatusBadge = (dest: FederationDestination) => {
    if (dest.retry_last_ts === 0) {
      return <Badge variant="success">Online</Badge>;
    }
    if (dest.failure_ts) {
      return <Badge variant="danger">Failed</Badge>;
    }
    return <Badge variant="warning">Retrying</Badge>;
  };

  if (loading && destinations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Federation"
        actions={
          <Button variant="ghost" size="sm" onClick={loadDestinations} disabled={loading}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-foreground)] mb-2">
                Federation Destinations
              </h2>
              <p className="text-sm text-[var(--color-muted)]">
                Total: {total} destination{total !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={orderBy}
                onChange={(e) => {
                  setOrderBy(e.target.value as OrderBy);
                  setCurrentPage(0);
                }}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent text-[var(--color-foreground)]"
              >
                <option value="destination">Destination</option>
                <option value="retry_last_ts">Last Retry</option>
                <option value="retry_interval">Retry Interval</option>
                <option value="failure_ts">Failure Time</option>
                <option value="last_successful_stream_ordering">Stream Ordering</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDir(dir === 'f' ? 'b' : 'f');
                  setCurrentPage(0);
                }}
              >
                {dir === 'f' ? (
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {destinations.map((dest) => (
              <div
                key={dest.destination}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-[var(--color-foreground)] text-lg">
                        {dest.destination}
                      </h3>
                      {getStatusBadge(dest)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-[var(--color-muted)] mb-1">Last Retry</p>
                        <p className="text-sm font-medium text-[var(--color-foreground)]">
                          {formatTimestamp(dest.retry_last_ts)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-muted)] mb-1">Retry Interval</p>
                        <p className="text-sm font-medium text-[var(--color-foreground)]">
                          {formatDuration(dest.retry_interval)}
                        </p>
                      </div>
                      {dest.failure_ts && (
                        <div>
                          <p className="text-xs text-[var(--color-muted)] mb-1">Failure Time</p>
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {formatTimestamp(dest.failure_ts)}
                          </p>
                        </div>
                      )}
                      {dest.last_successful_stream_ordering !== null && dest.last_successful_stream_ordering !== undefined && (
                        <div>
                          <p className="text-xs text-[var(--color-muted)] mb-1">Stream Ordering</p>
                          <p className="text-sm font-medium text-[var(--color-foreground)] font-mono">
                            {dest.last_successful_stream_ordering.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadDestinationRooms(dest.destination)}
                    >
                      View Rooms
                    </Button>
                    {dest.retry_last_ts !== 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleResetConnection(dest.destination)}
                        disabled={resetting === dest.destination}
                      >
                        {resetting === dest.destination ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          'Reset Connection'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {destinations.length === 0 && !loading && (
            <div className="text-center py-8 text-[var(--color-muted)]">
              No federation destinations found
            </div>
          )}

          {total > pageSize && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--color-muted)]">
                Page {currentPage + 1} of {Math.ceil(total / pageSize)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!nextToken}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDestination && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedDestination(null);
            setDestinationRooms([]);
          }}
          title={`Rooms for ${selectedDestination.destination}`}
          footer={
            <Button variant="ghost" onClick={() => {
              setSelectedDestination(null);
              setDestinationRooms([]);
            }}>
              Close
            </Button>
          }
        >
          {roomsLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : destinationRooms.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {destinationRooms.map((room) => (
                <div
                  key={room.room_id}
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm text-[var(--color-foreground)]">
                        {room.room_id}
                      </p>
                      <p className="text-xs text-[var(--color-muted)] mt-1">
                        Stream Ordering: {room.stream_ordering.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-muted)]">
              No rooms found for this destination
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

