'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Job, JsonValue } from '@/lib/types';
import { useToast } from './Toast';
import { useBalance } from './BalanceContext';
import { JobRow } from './jobs/JobRow';
import { JobLogsView } from './jobs/JobLogsView';

export interface JobsPanelRef {
  refresh: () => void;
  selectJob: (jobId: string) => void;
}

interface PollUpdate {
  timestamp: number;
  attempt: number;
  maxAttempts: number;
  status: string;
  data: JsonValue;
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

export const JobsPanel = forwardRef<JobsPanelRef, object>(function JobsPanel(_props, ref) {
  const { showError, showSuccess } = useToast();
  const { refreshBalance } = useBalance();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobs, setActiveJobs] = useState<Map<string, ActiveJob>>(new Map());
  const [expandedPollings, setExpandedPollings] = useState<Set<string>>(new Set());
  const [expandedRawRequests, setExpandedRawRequests] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Map<string, DownloadState>>(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [autoScroll, setAutoScroll] = useState(true);
  const [now, setNow] = useState(Date.now());

  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      setJobs(jobList);

      jobList.forEach((job: Job) => {
        if ((job.status === 'pending' || job.status === 'processing') && job.requestId) {
          startPollingForJob(job);
        }
      });
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

  const startPollingForJob = useCallback(
    (job: Job) => {
      if (!job.requestId) return;
      if (eventSourcesRef.current.has(job.id)) return;

      setActiveJobs((prev) => {
        const newMap = new Map(prev);
        newMap.set(job.id, {
          job,
          isPolling: true,
          pollUpdates: [],
          finalResult: null,
          error: null,
        });
        return newMap;
      });

      const eventSource = new EventSource(`/api/poll/${job.requestId}`);
      eventSourcesRef.current.set(job.id, eventSource);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const status = data.data?.status || data.status;

          const update: PollUpdate = {
            timestamp: Date.now(),
            attempt: data.attempt || 0,
            maxAttempts: data.maxAttempts || 120,
            status: status || 'unknown',
            data: data,
          };

          setActiveJobs((prev) => {
            const newMap = new Map(prev);
            const activeJob = newMap.get(job.id);
            if (activeJob) {
              const updates = [...activeJob.pollUpdates, update].slice(-100);
              newMap.set(job.id, { ...activeJob, pollUpdates: updates });
            }
            return newMap;
          });

          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: status === 'done' ? 'completed' : status === 'error' ? 'failed' : 'processing' }
                : j
            )
          );

          if (status === 'done') {
            const result = data.data || data;
            setActiveJobs((prev) => {
              const newMap = new Map(prev);
              const activeJob = newMap.get(job.id);
              if (activeJob) {
                newMap.set(job.id, { ...activeJob, isPolling: false, finalResult: result });
              }
              return newMap;
            });
            eventSource.close();
            eventSourcesRef.current.delete(job.id);
            refreshBalance();
            setTimeout(() => loadJobs(), 500);
          } else if (status === 'error' || status === 'timeout') {
            const errorMsg = data.data?.error || data.error || 'Job failed';
            setActiveJobs((prev) => {
              const newMap = new Map(prev);
              const activeJob = newMap.get(job.id);
              if (activeJob) {
                newMap.set(job.id, { ...activeJob, isPolling: false, error: errorMsg });
              }
              return newMap;
            });
            eventSource.close();
            eventSourcesRef.current.delete(job.id);
          }
        } catch (err) {
          console.error('[deapi-tester] Failed to parse SSE data:', err);
        }
      };

      eventSource.onerror = () => {
        setActiveJobs((prev) => {
          const newMap = new Map(prev);
          const activeJob = newMap.get(job.id);
          if (activeJob) {
            newMap.set(job.id, { ...activeJob, isPolling: false, error: 'Connection lost' });
          }
          return newMap;
        });
        eventSource.close();
        eventSourcesRef.current.delete(job.id);
      };
    },
    [refreshBalance, loadJobs]
  );

  useEffect(() => {
    loadJobs();

    pollIntervalRef.current = setInterval(() => {
      loadJobs();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      eventSourcesRef.current.forEach((es) => es.close());
      eventSourcesRef.current.clear();
    };
  }, [loadJobs]);

  const handleDelete = async (id: string) => {
    try {
      const es = eventSourcesRef.current.get(id);
      if (es) {
        es.close();
        eventSourcesRef.current.delete(id);
      }

      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      setJobs((prev) => prev.filter((j) => j.id !== id));
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
      eventSourcesRef.current.forEach((es) => es.close());
      eventSourcesRef.current.clear();

      await fetch('/api/history?all=true', { method: 'DELETE' });
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
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Jobs</span>
          {jobs.length > 0 && <span className="text-[10px] font-mono text-zinc-600">{jobs.length}</span>}
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 status-pulse" />
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-800 rounded p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === 'list' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                viewMode === 'logs' ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              Logs
            </button>
          </div>
          <button
            onClick={loadJobs}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
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
            <div className="p-8 text-sm text-zinc-500 text-center">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-sm text-zinc-600 text-center">
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
