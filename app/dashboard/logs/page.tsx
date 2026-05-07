'use client';

import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import { apiClient, Log } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { showToast, formatError } from '@/lib/toast';
import { useVirtualizer, measureElement } from '@tanstack/react-virtual';

type ParsePreset = 'none' | 'matrix-synapse';
type LogLevelFilter = 'all' | 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'UNKNOWN';
type LogViewMode = 'parsed' | 'raw';
type SearchScope = 'all' | 'message' | 'logger' | 'timestamp' | 'level';

interface ParsedLogEntry {
  id: string;
  raw: string;
  timestamp?: string;
  logger?: string;
  level: LogLevelFilter;
  message: string;
}

const KNOWN_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as const;

const MATRIX_SYN_LOG_REGEX =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*-\s*([a-zA-Z0-9_.:-]+)\s*-\s*([A-Z]+)\s*-\s*(.*)$/;
const MATRIX_SYN_FALLBACK_REGEX =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*-\s*([a-zA-Z0-9_.:-]+)\s*-\s*(.*)$/;

function inferLevel(raw: string): LogLevelFilter {
  const upper = raw.toUpperCase();
  if (upper.includes('CRITICAL')) return 'CRITICAL';
  if (upper.includes('ERROR')) return 'ERROR';
  if (upper.includes('WARNING') || upper.includes('WARN')) return 'WARNING';
  if (upper.includes('INFO')) return 'INFO';
  if (upper.includes('DEBUG')) return 'DEBUG';
  return 'UNKNOWN';
}

function parseLogLine(line: string, preset: ParsePreset, index: number): ParsedLogEntry {
  if (!line.trim()) {
    return {
      id: `line-${index}`,
      raw: line,
      level: 'UNKNOWN',
      message: line,
    };
  }

  if (preset === 'matrix-synapse') {
    const fullMatch = line.match(MATRIX_SYN_LOG_REGEX);
    if (fullMatch) {
      const [, timestamp, logger, level, message] = fullMatch;
      return {
        id: `line-${index}`,
        raw: line,
        timestamp,
        logger,
        level: (KNOWN_LEVELS as readonly string[]).includes(level)
          ? (level as LogLevelFilter)
          : 'UNKNOWN',
        message,
      };
    }

    const fallbackMatch = line.match(MATRIX_SYN_FALLBACK_REGEX);
    if (fallbackMatch) {
      const [, timestamp, logger, message] = fallbackMatch;
      return {
        id: `line-${index}`,
        raw: line,
        timestamp,
        logger,
        level: inferLevel(line),
        message,
      };
    }
  }

  return {
    id: `line-${index}`,
    raw: line,
    level: inferLevel(line),
    message: line,
  };
}

/** Compact level pill (parsed view) */
function levelPillClass(level: LogLevelFilter): string {
  if (level === 'ERROR' || level === 'CRITICAL') {
    return 'bg-red-500/12 text-red-700 dark:text-red-300 border border-red-500/20';
  }
  if (level === 'WARNING') {
    return 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/20';
  }
  if (level === 'INFO') {
    return 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/15';
  }
  if (level === 'DEBUG') {
    return 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/15';
  }
  return 'bg-[color-mix(in_srgb,var(--color-muted)_12%,transparent)] text-[var(--color-muted)] border border-[var(--color-border)]/60';
}

function formatLevelLabel(level: LogLevelFilter): string {
  switch (level) {
    case 'DEBUG':
      return 'DBG';
    case 'INFO':
      return 'INF';
    case 'WARNING':
      return 'WRN';
    case 'ERROR':
      return 'ERR';
    case 'CRITICAL':
      return 'CRIT';
    default:
      return '·';
  }
}

function messageWithHighlights(text: string) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s<>"':]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      let safe = part;
      try {
        const u = new URL(part);
        if (u.protocol === 'git:' || u.protocol === 'javascript:' || u.protocol === 'data:' || u.protocol === 'vbscript:')
          safe = '';
        else safe = u.toString();
      } catch {
        safe = '';
      }
      if (!safe) return <span key={i}>{part}</span>;
      return (
        <a
          key={i}
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 dark:text-sky-400 underline decoration-sky-500/35 underline-offset-1"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Parsed rows: virtualized; owns scroll container so virtualizer always gets a real scroll rect. */
function ParsedLogVirtualList({
  entries,
  scrollResetKey,
  ariaLabel,
}: {
  entries: ParsedLogEntry[];
  scrollResetKey: string;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 18,
    measureElement,
  });

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [scrollResetKey]);

  return (
    <div
      ref={scrollRef}
      className="log-scrollbar min-h-0 min-h-[min(50dvh,28rem)] flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const entry = entries[virtualRow.index];
          return (
            <div
              key={entry.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 top-0 flex w-full items-start gap-3 border-b border-[color-mix(in_srgb,var(--color-border)_45%,transparent)] px-3 py-px font-mono text-[11px] leading-[1.35] hover:bg-[color-mix(in_srgb,var(--color-foreground)_3%,transparent)]"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              title={entry.raw}
            >
              <span
                className={`w-[8.75rem] flex-shrink-0 truncate tabular-nums ${
                  entry.timestamp
                    ? 'text-emerald-700/90 dark:text-emerald-400/90'
                    : 'text-[var(--color-muted)]'
                }`}
                title={entry.timestamp ?? entry.raw}
              >
                {entry.timestamp ?? '—'}
              </span>
              <span
                className={`w-[8.25rem] flex-shrink-0 truncate ${
                  entry.logger ? 'text-violet-600 dark:text-violet-400/95' : 'text-[var(--color-muted)]'
                }`}
                title={entry.logger ?? undefined}
              >
                {entry.logger ?? '—'}
              </span>
              <span className="flex w-[2.75rem] flex-shrink-0 justify-center pt-px" title={entry.level}>
                <span
                  className={`inline-flex min-w-[2rem] justify-center rounded px-1 py-0 text-[9px] font-semibold uppercase tracking-tight tabular-nums ${levelPillClass(entry.level)}`}
                >
                  {formatLevelLabel(entry.level)}
                </span>
              </span>
              <span className="min-w-0 flex-1 text-[var(--color-foreground)]/95 [overflow-wrap:anywhere] whitespace-pre-wrap">
                {messageWithHighlights(entry.message)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Raw lines: virtualized; owns scroll container. */
function RawLogVirtualList({
  lines,
  scrollResetKey,
  ariaLabel,
}: {
  lines: string[];
  scrollResetKey: string;
  ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 20,
    overscan: 28,
    measureElement,
  });

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [scrollResetKey]);

  return (
    <div
      ref={scrollRef}
      className="log-scrollbar min-h-0 min-h-[min(50dvh,28rem)] flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div
        className="relative w-full font-mono text-[0.875rem] leading-normal text-[var(--color-foreground)]"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 w-full border-b border-[color-mix(in_srgb,var(--color-border)_40%,transparent)] px-3 py-px [overflow-wrap:anywhere] whitespace-pre-wrap"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {lines[virtualRow.index]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [logContent, setLogContent] = useState('');
  const [lines, setLines] = useState(100);
  const [autoReload, setAutoReload] = useState(false);
  const [cached, setCached] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [parsePreset, setParsePreset] = useState<ParsePreset>('none');
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>('all');
  const [viewMode, setViewMode] = useState<LogViewMode>('parsed');
  const autoReloadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoLoadedRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [logFetchVersion, setLogFetchVersion] = useState(0);

  const parsedEntries = useMemo(() => {
    if (!logContent || logContent === 'Loading...' || logContent.startsWith('Error:')) return [];
    return logContent
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => parseLogLine(line, parsePreset, idx));
  }, [logContent, parsePreset]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = matchCase ? searchQuery.trim() : searchQuery.trim().toLowerCase();
    return parsedEntries.filter((entry) => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      if (!normalizedSearch) return true;
      const fieldsByScope: Record<SearchScope, string> = {
        all: `${entry.timestamp ?? ''} ${entry.logger ?? ''} ${entry.level} ${entry.message} ${entry.raw}`,
        message: entry.message,
        logger: entry.logger ?? '',
        timestamp: entry.timestamp ?? '',
        level: entry.level,
      };
      const haystackRaw = fieldsByScope[searchScope];
      const haystack = matchCase ? haystackRaw : haystackRaw.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [parsedEntries, levelFilter, searchQuery, searchScope, matchCase]);

  const rawLogLines = useMemo(() => filteredEntries.map((e) => e.raw), [filteredEntries]);

  const levelCounts = useMemo(() => {
    return parsedEntries.reduce<Record<LogLevelFilter, number>>(
      (acc, entry) => {
        acc[entry.level] += 1;
        return acc;
      },
      { all: parsedEntries.length, DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0, UNKNOWN: 0 }
    );
  }, [parsedEntries]);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getLogs();
      setLogs(data);
    } catch (err: unknown) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogContent = useCallback(
    async (log: Log, forceRefresh = false) => {
      try {
        const shouldUpdateState = !selectedLog || selectedLog.id !== log.id;
        if (shouldUpdateState) {
          setSelectedLog(log);
          setLines(log.default_lines || 100);
          setAutoReload(log.auto_reload || false);
        }
        const linesToLoad = shouldUpdateState ? (log.default_lines || 100) : lines;
        setLogContent('Loading...');
        const data = await apiClient.getLogContent(log.id, linesToLoad, forceRefresh);
        const content = data.content || '';
        const reversedContent = content.split('\n').reverse().join('\n');
        setLogContent(reversedContent);
        setCached(data.cached || false);
        setLogFetchVersion((v) => v + 1);
      } catch (err: unknown) {
        showToast.error(formatError(err));
        setLogContent(`Error: ${formatError(err)}`);
        setCached(false);
      }
    },
    [lines, selectedLog],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Auto-load first log when logs are loaded
  useEffect(() => {
    if (logs.length > 0 && !selectedLog && !loading && !hasAutoLoadedRef.current) {
      hasAutoLoadedRef.current = true;
      void loadLogContent(logs[0]);
    }
  }, [logs, logs.length, loadLogContent, loading, selectedLog]);

  useEffect(() => {
    return () => {
      if (autoReloadIntervalRef.current) {
        clearInterval(autoReloadIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoReload && selectedLog) {
      const interval = selectedLog.reload_interval || 5;
      autoReloadIntervalRef.current = setInterval(() => {
        void loadLogContent(selectedLog, true);
      }, interval * 1000);
    } else {
      if (autoReloadIntervalRef.current) {
        clearInterval(autoReloadIntervalRef.current);
        autoReloadIntervalRef.current = null;
      }
    }

    return () => {
      if (autoReloadIntervalRef.current) {
        clearInterval(autoReloadIntervalRef.current);
      }
    };
  }, [autoReload, loadLogContent, selectedLog]);

  useEffect(() => {
    if (!selectedLog) return;
    const searchable = `${selectedLog.name} ${selectedLog.file_path}`.toLowerCase();
    if (searchable.includes('synapse') || searchable.includes('matrix')) {
      setParsePreset('matrix-synapse');
      return;
    }
    setParsePreset('none');
  }, [selectedLog]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const copyVisibleLogs = async () => {
    try {
      const payload =
        viewMode === 'raw'
          ? filteredEntries.map((entry) => entry.raw).join('\n')
          : filteredEntries
              .map((entry) =>
                [entry.timestamp, entry.logger, entry.level !== 'UNKNOWN' ? entry.level : undefined, entry.message]
                  .filter(Boolean)
                  .join(' | ')
              )
              .join('\n');
      await navigator.clipboard.writeText(payload);
      showToast.success('Copied visible logs');
    } catch {
      showToast.error('Failed to copy logs');
    }
  };

  const handleAddLog = async (logData: { name: string; file_path: string; description?: string; auto_reload?: boolean; reload_interval?: number; default_lines?: number }) => {
    try {
      await apiClient.createLog(logData);
      showToast.success('Log created successfully');
      setShowAddModal(false);
      hasAutoLoadedRef.current = false;
      await loadLogs();
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleUpdateLog = async (logId: number, logData: Partial<Log>) => {
    try {
      await apiClient.updateLog(logId, logData);
      showToast.success('Log updated successfully');
      loadLogs();
      if (selectedLog?.id === logId) {
        const updatedLog = logs.find(l => l.id === logId);
        if (updatedLog) {
          await loadLogContent(updatedLog, true);
        }
      }
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  const handleDelete = async (logId: number) => {
    if (!confirm('Are you sure you want to delete this log?')) return;
    try {
      await apiClient.deleteLog(logId);
      const wasSelected = selectedLog?.id === logId;
      if (wasSelected) {
        setSelectedLog(null);
        setLogContent('');
        setAutoReload(false);
      }
      await loadLogs();
      if (wasSelected && logs.length > 1) {
        const remainingLogs = logs.filter(l => l.id !== logId);
        if (remainingLogs.length > 0) {
          loadLogContent(remainingLogs[0]);
        }
      }
      showToast.success('Log deleted successfully');
    } catch (err: unknown) {
      showToast.error(formatError(err));
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header
        title="Log Files"
        actions={
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + Add Log
          </Button>
        }
      />

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Log Files Selector - Top Section */}
      <Card className="mb-3 flex-shrink-0">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => loadLogContent(log)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                  ${
                    selectedLog?.id === log.id
                      ? 'bg-[var(--color-primary)] text-white shadow-lg'
                      : 'bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-surface)] hover:opacity-80 border border-[var(--color-border)]'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span>{log.name}</span>
                  {log.auto_reload && (
                    <Badge variant="success" className="text-xs">
                      Auto
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log Content Viewer - Bottom Section */}
      {selectedLog ? (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 id={`log-viewer-title-${selectedLog.id}`} className="text-lg font-bold text-[var(--color-foreground)]">
                  {selectedLog.name}
                </h2>
                <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">{selectedLog.file_path}</p>
              </div>
              <div className="flex items-center gap-2">
                {cached && <Badge variant="warning">Cached</Badge>}
                {autoReload && (
                  <Badge variant="success" className="animate-pulse">
                    Auto-reloading...
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-[var(--color-foreground)]">Lines:</label>
                <input
                  type="number"
                  value={lines}
                  onChange={(e) => {
                    const newLines = parseInt(e.target.value) || 100;
                    setLines(newLines);
                    loadLogContent(selectedLog, true);
                  }}
                  min={1}
                  max={10000}
                  className="w-20 px-2 py-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent text-[var(--color-foreground)]"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoReload"
                  checked={autoReload}
                  onChange={(e) => {
                    setAutoReload(e.target.checked);
                    handleUpdateLog(selectedLog.id, { auto_reload: e.target.checked });
                  }}
                  className="rounded"
                />
                <label htmlFor="autoReload" className="text-sm text-[var(--color-foreground)] cursor-pointer">
                  Auto-reload
                </label>
              </div>

              <Button variant="primary" size="sm" onClick={() => loadLogContent(selectedLog, true)}>
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={copyVisibleLogs}>
                Copy visible
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(selectedLog.id)}
              >
                Delete
              </Button>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-[260px] flex-1">
                <input
                  ref={searchInputRef}
                  placeholder="Search visible logs (press / to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all duration-200"
                />
              </div>
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value as SearchScope)}
                className="px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">Search in: All fields</option>
                <option value="message">Search in: Message</option>
                <option value="logger">Search in: Logger</option>
                <option value="timestamp">Search in: Timestamp</option>
                <option value="level">Search in: Level</option>
              </select>
              <select
                value={parsePreset}
                onChange={(e) => setParsePreset(e.target.value as ParsePreset)}
                className="px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="none">Preset: Raw / generic</option>
                <option value="matrix-synapse">Preset: Matrix Synapse (`YYYY-MM-DD HH:mm:ss,ms - synapse.*`)</option>
              </select>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as LogLevelFilter)}
                className="px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">Level: All ({levelCounts.all})</option>
                <option value="DEBUG">DEBUG ({levelCounts.DEBUG})</option>
                <option value="INFO">INFO ({levelCounts.INFO})</option>
                <option value="WARNING">WARNING ({levelCounts.WARNING})</option>
                <option value="ERROR">ERROR ({levelCounts.ERROR})</option>
                <option value="CRITICAL">CRITICAL ({levelCounts.CRITICAL})</option>
                <option value="UNKNOWN">UNKNOWN ({levelCounts.UNKNOWN})</option>
              </select>
              <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('parsed')}
                  className={`px-3 py-2 text-sm ${viewMode === 'parsed' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-foreground)]'}`}
                >
                  Parsed
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('raw')}
                  className={`px-3 py-2 text-sm ${viewMode === 'raw' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-foreground)]'}`}
                >
                  Raw
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="matchCase"
                  checked={matchCase}
                  onChange={(e) => setMatchCase(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="matchCase" className="text-sm text-[var(--color-foreground)] cursor-pointer">
                  Match case
                </label>
              </div>
              <div className="flex items-center gap-2">
                {(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'] as LogLevelFilter[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLevelFilter(levelFilter === level ? 'all' : level)}
                    className={`px-2 py-1 text-xs rounded border ${
                      levelFilter === level
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] text-[var(--color-foreground)] border-[var(--color-border)]'
                    }`}
                  >
                    {level} ({levelCounts[level]})
                  </button>
                ))}
              </div>
              {(searchQuery || levelFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setLevelFilter('all');
                    setSearchScope('all');
                    setMatchCase(false);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          <section
            className="flex min-h-[min(72dvh,52rem)] flex-1 flex-col bg-[var(--color-background)]"
            aria-labelledby={`log-viewer-title-${selectedLog.id}`}
          >
            {logContent === 'Loading...' ? (
              <div className="flex flex-1 items-center justify-center py-16 text-[var(--color-muted)]">
                <LoadingSpinner size="lg" />
              </div>
            ) : logContent && !logContent.startsWith('Error:') ? (
              viewMode === 'raw' ? (
                <div className="flex min-h-0 flex-1 flex-col p-3 pt-2">
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                    {rawLogLines.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[var(--color-muted)]">
                        No matching logs for current filters.
                      </div>
                    ) : (
                      <RawLogVirtualList
                        lines={rawLogLines}
                        scrollResetKey={`${selectedLog.id}-${logFetchVersion}`}
                        ariaLabel={`Raw log lines for ${selectedLog.name}`}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col p-3 pt-2">
                  <div className="mb-1.5 flex flex-shrink-0 items-center justify-between px-1 text-[11px] text-[var(--color-muted)]">
                    <span>
                      Showing {filteredEntries.length} of {parsedEntries.length} lines
                    </span>
                    <span>Preset: {parsePreset === 'matrix-synapse' ? 'Matrix Synapse' : 'Raw / generic'}</span>
                  </div>
                  {filteredEntries.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border text-sm text-[var(--color-muted)]">
                      No matching logs for current filters.
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                      <div className="flex flex-shrink-0 items-baseline gap-3 border-b border-border bg-[color-mix(in_srgb,var(--color-surface)_94%,var(--color-border)_6%)] px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                        <span className="w-[8.75rem] shrink-0">Time</span>
                        <span className="w-[8.25rem] shrink-0">Logger</span>
                        <span className="w-[2.75rem] shrink-0 text-center">Lvl</span>
                        <span className="min-w-0 flex-1">Message</span>
                      </div>
                      <ParsedLogVirtualList
                        entries={filteredEntries}
                        scrollResetKey={`${selectedLog.id}-${logFetchVersion}`}
                        ariaLabel={`Parsed log lines for ${selectedLog.name}`}
                      />
                    </div>
                  )}
                </div>
              )
            ) : logContent?.startsWith('Error:') ? (
              <div className="text-red-600 dark:text-red-400 m-4 rounded-lg border border-red-300/50 bg-red-50/80 p-4 text-sm dark:bg-red-950/30 dark:border-red-800/50">
                {logContent}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-[var(--color-muted)]">No log content loaded</div>
            )}
          </section>
        </Card>
      ) : (
        <Card className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--color-muted)]">
            <p className="text-lg mb-2">No log selected</p>
            <p className="text-sm">Select a log file from above to view its contents</p>
          </div>
        </Card>
      )}

      {showAddModal && (
        <AddLogModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddLog}
        />
      )}
    </div>
  );
}

function AddLogModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { name: string; file_path: string; description?: string; auto_reload?: boolean; reload_interval?: number; default_lines?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [description, setDescription] = useState('');
  const [autoReload, setAutoReload] = useState(false);
  const [reloadInterval, setReloadInterval] = useState(5);
  const [defaultLines, setDefaultLines] = useState(100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      name, 
      file_path: filePath, 
      description: description || undefined,
      auto_reload: autoReload,
      reload_interval: autoReload ? reloadInterval : undefined,
      default_lines: defaultLines
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Log File"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Add
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="File Path"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          required
          placeholder="/var/log/matrix-synapse/homeserver.log"
        />
        <Input
          label="Default Lines"
          type="number"
          value={defaultLines}
          onChange={(e) => setDefaultLines(parseInt(e.target.value) || 100)}
          min={1}
          max={10000}
        />
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={autoReload}
            onChange={(e) => setAutoReload(e.target.checked)}
            className="mr-2 rounded"
            id="autoReload"
          />
          <label htmlFor="autoReload" className="text-sm font-medium text-[var(--color-foreground)]">
            Enable Auto-reload
          </label>
        </div>
        {autoReload && (
          <Input
            label="Reload Interval (seconds)"
            type="number"
            value={reloadInterval}
            onChange={(e) => setReloadInterval(parseInt(e.target.value) || 5)}
            min={1}
            max={60}
          />
        )}
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </form>
    </Modal>
  );
}
