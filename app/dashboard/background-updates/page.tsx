'use client';

import { useEffect, useState } from 'react';
import { apiClient, BackgroundUpdatesStatus, BackgroundUpdateInfo } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { showToast, formatError } from '@/lib/toast';

export default function BackgroundUpdatesPage() {
  const [status, setStatus] = useState<BackgroundUpdatesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [startingJob, setStartingJob] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.getBackgroundUpdatesStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load background updates status');
      showToast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!status) return;
    
    try {
      setUpdating(true);
      const newEnabled = !status.enabled;
      await apiClient.setBackgroundUpdatesEnabled(newEnabled);
      await loadStatus();
      showToast.success(`Background updates ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      showToast.error(formatError(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleStartJob = async (jobName: 'populate_stats_process_rooms' | 'regenerate_directory') => {
    try {
      setStartingJob(jobName);
      await apiClient.startBackgroundJob(jobName);
      await loadStatus();
      showToast.success(`Background job "${jobName}" started successfully`);
    } catch (err: any) {
      showToast.error(formatError(err));
    } finally {
      setStartingJob(null);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(0);
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Background Updates"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={loadStatus} disabled={loading}>
              Refresh
            </Button>
            {status && (
              <Button
                variant={status.enabled ? 'danger' : 'primary'}
                size="sm"
                onClick={handleToggleEnabled}
                disabled={updating}
              >
                {updating ? (
                  <LoadingSpinner size="sm" />
                ) : status.enabled ? (
                  'Disable Updates'
                ) : (
                  'Enable Updates'
                )}
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {status && (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-foreground)] mb-2">
                    Status
                  </h2>
                  <p className="text-sm text-[var(--color-muted)]">
                    Background updates are currently{' '}
                    <span className="font-semibold">
                      {status.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </p>
                </div>
                <Badge variant={status.enabled ? 'success' : 'warning'}>
                  {status.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {!status.enabled && (
                <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg mb-4">
                  <strong>Warning:</strong> Background updates should not be paused for significant periods of time, as this can affect the performance of Synapse.
                </div>
              )}

              {status.current_updates && Object.keys(status.current_updates).length > 0 ? (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-[var(--color-foreground)] mb-4">
                    Current Updates
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(status.current_updates).map(([dbName, update]) => (
                      <div
                        key={dbName}
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-[var(--color-foreground)]">
                              {update.name}
                            </h4>
                            <p className="text-sm text-[var(--color-muted)] mt-1">
                              Database: <span className="font-mono">{dbName}</span>
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-[var(--color-muted)] mb-1">Items Processed</p>
                            <p className="text-lg font-semibold text-[var(--color-foreground)]">
                              {formatNumber(update.total_item_count)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-muted)] mb-1">Duration</p>
                            <p className="text-lg font-semibold text-[var(--color-foreground)]">
                              {formatDuration(update.total_duration_ms)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-muted)] mb-1">Rate</p>
                            <p className="text-lg font-semibold text-[var(--color-foreground)]">
                              {update.average_items_per_ms !== null && update.average_items_per_ms !== undefined
                                ? `${update.average_items_per_ms.toFixed(2)} items/ms`
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 text-center py-8 text-[var(--color-muted)]">
                  No background updates currently running
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-[var(--color-foreground)] mb-4">
                Manual Jobs
              </h2>
              <p className="text-sm text-[var(--color-muted)] mb-6">
                Start specific background update jobs manually. These jobs start immediately after calling the API.
              </p>
              <div className="space-y-4">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--color-foreground)] mb-2">
                        Recalculate Room Statistics
                      </h3>
                      <p className="text-sm text-[var(--color-muted)] mb-1">
                        Job: <span className="font-mono">populate_stats_process_rooms</span>
                      </p>
                      <p className="text-sm text-[var(--color-muted)]">
                        Recalculate the statistics for all rooms.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartJob('populate_stats_process_rooms')}
                      disabled={startingJob === 'populate_stats_process_rooms' || !status.enabled}
                    >
                      {startingJob === 'populate_stats_process_rooms' ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        'Start Job'
                      )}
                    </Button>
                  </div>
                </div>

                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--color-foreground)] mb-2">
                        Regenerate User Directory
                      </h3>
                      <p className="text-sm text-[var(--color-muted)] mb-1">
                        Job: <span className="font-mono">regenerate_directory</span>
                      </p>
                      <p className="text-sm text-[var(--color-muted)]">
                        Recalculate the user directory if it is stale or out of sync.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStartJob('regenerate_directory')}
                      disabled={startingJob === 'regenerate_directory' || !status.enabled}
                    >
                      {startingJob === 'regenerate_directory' ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        'Start Job'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {!status.enabled && (
                <div className="mt-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg">
                  Background updates must be enabled to start manual jobs.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

