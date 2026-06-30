'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Job, JsonValue } from '@/lib/types';
import { useToast } from './Toast';
import { useBalance } from './BalanceContext';
import { useJobSocket } from './JobSocketContext';
import { JobRow } from './jobs/JobRow';
import { JobLogsView } from './jobs/JobLogsView';

export interface JobsPanelRef {
  refresh: () => void;
  selectJob: (jobId: string) => void;
}

interface JobsPanelProps {
  onDuplicate: (job: Job) => void;
}

interface PollUpdate {
  timestamp: number;
  attempt: number;
  maxAttempts: number;
  status: string;
  data: JsonValue;
  source: 'ws' | 'poll';
}

interface ActiveJob {
  job: Job;
  isPolling: boolean;
  pollUpdates: PollUpdate[];
  finalResult: JsonValue | null;
  error: string | null;
}

interface DownloadState {
  isDownloading: boolean;
  downloaded: boolean;
  localPath?: string;
  error?: string;
}

type ViewMode = 'list' | 'logs';

const TERMINAL_STATUSES: Job['status'][] = ['completed', 'failed', 'cancelled'];

export const JobsPanel = forwardRef<JobsPanelRef, JobsPanelProps>(function JobsPanel({ onDuplicate }, ref) {
  const { showError, showSuccess } = useToast();
  const { refreshBalance } = useBalance();
  const { addListener, isConnected } = useJobSocket();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobs, setActiveJobs] = useState<Map<string, ActiveJob>>(new Map());
  const [expandedPollings, setExpandedPollings] = useState<Set<string>>(new Set());
  const [expandedRawRequests, setExpandedRawRequests] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Map<string, DownloadState>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [autoScroll, setAutoScroll] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Refs so the reconciliation interval and WS listener always see fresh values
  // without re-subscribing.
  const jobsRef = useRef<Job[]>([]);
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const stoppedRef = useRef<Set<string>>(new Set());
  const lastWsAtRef = useRef<Map<string, number>>(new Map());
  const fallbackIntervalRef = useRef<number>(10000);
  const maxAttemptsRef = useRef<number>(120);
  const reconcileRef = useRef<() => void>(() => {});
  const pollOnceRef = useRef<(job: Job, opts?: { silent?: boolean }) => void>(() => {});
  // Live mirror of the socket connection state for the reconciliation loop.
  const isConnectedRef = useRef(false);
  isConnectedRef.current = isConnected;

  // Timer for real-time elapsed time updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenResult = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDownload = async (job: Job, resultUrl: string) => {
    setDownloadStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(job.id, { isDownloading: true, downloaded: false });
      return newMap;
    });

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resultUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setDownloadStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(job.id, {
            isDownloading: false,
            downloaded: true,
            localPath: data.path,
          });
          return newMap;
        });
        showSuccess(`Downloaded: ${data.filename}`);
      } else {
        throw new Error(data.error || 'Download failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed';
      setDownloadStates((prev) => {
        const newMap = new Map(prev);
        newMap.set(job.id, {
          isDownloading: false,
          downloaded: false,
          error: errorMsg,
        });
        return newMap;
      });
      showError(`Download failed: ${errorMsg}`);
    }
  };

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      const jobList = Array.isArray(data) ? data : [];
      jobsRef.current = jobList;
      setJobs(jobList);
      // Kick an immediate reconcile so freshly-loaded active jobs show status
      // without waiting a full fallback interval.
      reconcileRef.current();
    } catch (err) {
      console.error('[deapi-tester] Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      refresh: loadJobs,
      selectJob: (jobId: string) => {
        setExpandedPollings((prev) => new Set(prev).add(jobId));
      },
    }),
    [loadJobs]
  );

  // Record a status update (from WS or a reconciliation poll) into the per-job
  // activeJobs entry and patch the job's top-level status. `deApiResponse` is the
  // deAPI { data: {...} } shape; WS payloads are normalized to it by the caller.
  const recordUpdate = useCallback(
    (job: Job, deApiResponse: Record<string, unknown>, rawStatus: string, source: 'ws' | 'poll') => {
      const jobStatus: Job['status'] =
        rawStatus === 'done' ? 'completed' : rawStatus === 'error' ? 'failed' : 'processing';
      const isTerminal = rawStatus === 'done' || rawStatus === 'error';

      const attempt = (attemptsRef.current.get(job.id) || 0) + 1;
      attemptsRef.current.set(job.id, attempt);

      const update: PollUpdate = {
        timestamp: Date.now(),
        attempt,
        maxAttempts: maxAttemptsRef.current,
        status: rawStatus || 'unknown',
        data: deApiResponse as JsonValue,
        source,
      };

      setActiveJobs((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(job.id) || {
          job,
          isPolling: true,
          pollUpdates: [],
          finalResult: null,
          error: null,
        };
        const updates = [...existing.pollUpdates, update].slice(-100);
        const inner = (deApiResponse.data as JsonValue) ?? (deApiResponse as JsonValue);
        newMap.set(job.id, {
          ...existing,
          job,
          isPolling: !isTerminal,
          pollUpdates: updates,
          finalResult: rawStatus === 'done' ? inner : existing.finalResult,
          error: null,
        });
        return newMap;
      });

      setJobs((prev) => {
        const next = prev.map((j) => (j.id === job.id ? { ...j, status: jobStatus } : j));
        jobsRef.current = next;
        return next;
      });
    },
    []
  );

  const setActiveError = useCallback((jobId: string, error: string) => {
    setActiveJobs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(jobId);
      if (existing) {
        newMap.set(jobId, { ...existing, isPolling: false, error });
      }
      return newMap;
    });
  }, []);

  // Fetch one job's status from the server (persists to history) and apply it.
  // No attempt cap here: this is also the WS-"done" persist path, which must
  // always succeed. Runaway-stuck jobs are bounded by the wall-clock guard in
  // reconcileActiveJobs instead.
  const pollOnce = useCallback(
    async (job: Job, opts?: { silent?: boolean }) => {
      if (!job.requestId) return;
      if (inFlightRef.current.has(job.id)) return;

      inFlightRef.current.add(job.id);
      try {
        const res = await fetch(`/api/jobs/${job.requestId}`);
        const data = await res.json();
        if (!res.ok) {
          // Leave the job active; the next tick retries.
          console.error('[deapi-tester] Job status fetch failed:', data?.error || res.status);
          return;
        }

        const status: string = data.data?.status || data.status || 'unknown';
        // Silent calls (the WS-"done" finalize) persist + refresh but don't add a
        // POLL entry to the updates list — the WS already recorded the event.
        if (!opts?.silent) recordUpdate(job, data, status, 'poll');

        if (status === 'done') {
          refreshBalance();
          loadJobs();
        } else if (status === 'error') {
          const errorMsg =
            data.data?.error_message ||
            data.data?.error ||
            data.error ||
            (data.data?.error_code ? `Error: ${data.data.error_code}` : null) ||
            'Job failed';
          setActiveError(job.id, errorMsg);
          loadJobs();
        }
      } catch (err) {
        // Network blip — keep the job active for the next reconciliation tick.
        console.error('[deapi-tester] Job status fetch error:', err);
      } finally {
        inFlightRef.current.delete(job.id);
      }
    },
    [recordUpdate, setActiveError, refreshBalance, loadJobs]
  );
  pollOnceRef.current = pollOnce;

  // Reconciliation: poll every still-active job once. Runs on a slow interval
  // (fallbackPollIntervalMs) regardless of WS state — it's how webhook-only
  // `error` statuses and missed updates get surfaced, and the full fallback when
  // the WebSocket is down. A wall-clock guard stops polling a job the server
  // never resolves (default ~maxPollingAttempts × interval, e.g. 20 min).
  const reconcileActiveJobs = useCallback(() => {
    const now = Date.now();
    const interval = fallbackIntervalRef.current;
    const limitMs = maxAttemptsRef.current * interval;
    jobsRef.current.forEach((job) => {
      if ((job.status !== 'pending' && job.status !== 'processing') || !job.requestId) return;
      if (stoppedRef.current.has(job.id)) return;

      const elapsed = now - Date.parse(job.createdAt);
      if (Number.isFinite(elapsed) && elapsed > limitMs) {
        stoppedRef.current.add(job.id);
        setActiveError(job.id, 'Stopped polling — job did not resolve in time');
        return;
      }

      // When the socket is live it's the primary source: skip the poll while it's
      // actively driving this job. "Active" = a WS update arrived within the last
      // interval, OR the job is younger than one interval (grace for the socket to
      // deliver its first event). The poll only re-engages once the socket goes
      // quiet — which is what surfaces webhook-only `error` and socket gaps.
      if (isConnectedRef.current) {
        const lastWsAt = lastWsAtRef.current.get(job.id);
        const ref = lastWsAt ?? Date.parse(job.createdAt);
        if (Number.isFinite(ref) && now - ref < interval) return;
      }
      pollOnceRef.current(job);
    });
  }, [setActiveError]);
  reconcileRef.current = reconcileActiveJobs;

  // Bootstrap: load config (interval/cap) + history, then start the slow poll.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        fallbackIntervalRef.current = data.fallbackPollIntervalMs || 10000;
        maxAttemptsRef.current = data.maxPollingAttempts || 120;
      } catch {
        // keep defaults
      }
      if (cancelled) return;
      await loadJobs();
      timer = setInterval(() => reconcileRef.current(), fallbackIntervalRef.current);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [loadJobs]);

  // WebSocket: primary, real-time status/preview/progress. `error` never arrives
  // here (webhook-only) — the reconciliation poll catches those.
  useEffect(() => {
    const unsubscribe = addListener((evt) => {
      const job = jobsRef.current.find((j) => j.requestId === evt.request_id);
      if (!job) return;
      if (TERMINAL_STATUSES.includes(job.status)) return;

      lastWsAtRef.current.set(job.id, Date.now());
      const normalized = {
        data: {
          status: evt.status,
          preview: evt.preview ?? undefined,
          result_url: evt.result_url ?? undefined,
          progress: evt.progress ?? undefined,
        },
      };
      recordUpdate(job, normalized, evt.status, 'ws');

      // On done, immediately fetch the authoritative result (result_url + cost)
      // and persist once (silently — the WS already showed "done"), rather than
      // waiting for the next slow reconciliation tick. After this the job is
      // terminal and is no longer polled.
      if (evt.status === 'done') {
        pollOnceRef.current(job, { silent: true });
      }
    });
    return unsubscribe;
  }, [addListener, recordUpdate]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      attemptsRef.current.delete(id);
      inFlightRef.current.delete(id);
      stoppedRef.current.delete(id);
      lastWsAtRef.current.delete(id);
      setJobs((prev) => {
        const next = prev.filter((j) => j.id !== id);
        jobsRef.current = next;
        return next;
      });
      setActiveJobs((prev) => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    } catch (err) {
      console.error('[deapi-tester] Failed to delete job:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all job history?')) return;

    try {
      await fetch('/api/history?all=true', { method: 'DELETE' });
      attemptsRef.current.clear();
      inFlightRef.current.clear();
      stoppedRef.current.clear();
      lastWsAtRef.current.clear();
      jobsRef.current = [];
      setJobs([]);
      setActiveJobs(new Map());
    } catch (err) {
      console.error('[deapi-tester] Failed to clear history:', err);
    }
  };

  const togglePolling = (jobId: string) => {
    setExpandedPollings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const toggleRawRequest = (jobId: string) => {
    setExpandedRawRequests((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const activeCount = jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length;

  // Get all logs from all jobs for logs view
  const allLogs = Array.from(activeJobs.values())
    .flatMap((aj) =>
      aj.pollUpdates.map((u) => ({
        ...u,
        jobId: aj.job.id,
        endpointId: aj.job.endpointId,
      }))
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="h-full flex flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Jobs</span>
          {jobs.length > 0 && <span className="text-[10px] font-mono text-[var(--text-faint)]">{jobs.length}</span>}
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 status-pulse" />
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-[var(--surface-2)] rounded p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === 'list' ? 'bg-[var(--border-strong)] text-[var(--text-emphasis)]' : 'text-[var(--muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === 'logs' ? 'bg-[var(--border-strong)] text-[var(--text-emphasis)]' : 'text-[var(--muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              Logs
            </button>
          </div>
          <button
            onClick={loadJobs}
            className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            className="p-1 text-[var(--muted)] hover:text-red-400 transition-colors"
            title="Clear all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto">
          {isLoading && jobs.length === 0 ? (
            <div className="p-8 text-sm text-[var(--muted)] text-center">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-sm text-[var(--text-faint)] text-center">
              No jobs yet. Select an endpoint and execute a request.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-dim)]">
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  activeJob={activeJobs.get(job.id)}
                  isPollingExpanded={expandedPollings.has(job.id)}
                  isRawExpanded={expandedRawRequests.has(job.id)}
                  downloadState={downloadStates.get(job.id)}
                  now={now}
                  onTogglePolling={togglePolling}
                  onToggleRaw={toggleRawRequest}
                  onOpenResult={handleOpenResult}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onDuplicate={onDuplicate}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <JobLogsView logs={allLogs} autoScroll={autoScroll} onAutoScrollChange={setAutoScroll} />
      )}
    </div>
  );
});
