'use client';

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Job, JsonValue } from '@/lib/types';
import { useToast } from './Toast';
import { useBalance } from './BalanceContext';

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

interface JobsPanelProps {
  onRerun?: (job: Job) => void;
}

type ViewMode = 'list' | 'logs';

export const JobsPanel = forwardRef<JobsPanelRef, JobsPanelProps>(
  function JobsPanel({ onRerun }, ref) {
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
    const logContainerRef = useRef<HTMLDivElement>(null);

    const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

    // Timer for real-time elapsed time updates
    useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }, []);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-scroll logs
    useEffect(() => {
      if (autoScroll && logContainerRef.current && viewMode === 'logs') {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, [activeJobs, autoScroll, viewMode]);

    const getResultUrl = (job: Job, activeJob?: ActiveJob): string | null => {
      if (job.resultUrl) return job.resultUrl;
      if (activeJob?.finalResult) {
        const result = activeJob.finalResult as Record<string, JsonValue>;
        if (result.result_url) return result.result_url as string;
      }
      if (job.rawResponse) {
        const response = job.rawResponse as Record<string, JsonValue>;
        const data = response.data as Record<string, JsonValue> | undefined;
        if (data?.result_url) return data.result_url as string;
      }
      return null;
    };

    const getCost = (job: Job, activeJob?: ActiveJob): number | null => {
      // First check job.costCredits (from history)
      if (job.costCredits !== undefined && job.costCredits !== null) return job.costCredits;

      // Then check activeJob finalResult
      if (activeJob?.finalResult) {
        const result = activeJob.finalResult as Record<string, JsonValue>;
        if (result.cost_credits !== undefined) return result.cost_credits as number;
      }

      // Then check job.rawResponse
      if (job.rawResponse) {
        const response = job.rawResponse as Record<string, JsonValue>;
        const data = response.data as Record<string, JsonValue> | undefined;
        if (data?.cost_credits !== undefined) return data.cost_credits as number;
      }

      return null;
    };

    const handleOpenResult = (url: string) => {
      window.open(url, '_blank');
    };

    const handleDownload = async (job: Job, resultUrl: string) => {
      setDownloadStates(prev => {
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
          setDownloadStates(prev => {
            const newMap = new Map(prev);
            newMap.set(job.id, {
              isDownloading: false,
              downloaded: true,
              localPath: data.path
            });
            return newMap;
          });
          showSuccess(`Downloaded: ${data.filename}`);
        } else {
          throw new Error(data.error || 'Download failed');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Download failed';
        setDownloadStates(prev => {
          const newMap = new Map(prev);
          newMap.set(job.id, {
            isDownloading: false,
            downloaded: false,
            error: errorMsg
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

    useImperativeHandle(ref, () => ({
      refresh: loadJobs,
      selectJob: (jobId: string) => {
        setExpandedPollings(prev => new Set(prev).add(jobId));
      },
    }), [loadJobs]);

    const startPollingForJob = useCallback((job: Job) => {
      if (!job.requestId) return;
      if (eventSourcesRef.current.has(job.id)) return;

      setActiveJobs(prev => {
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

          setActiveJobs(prev => {
            const newMap = new Map(prev);
            const activeJob = newMap.get(job.id);
            if (activeJob) {
              const updates = [...activeJob.pollUpdates, update].slice(-100);
              newMap.set(job.id, {
                ...activeJob,
                pollUpdates: updates,
              });
            }
            return newMap;
          });

          setJobs(prev => prev.map(j =>
            j.id === job.id ? { ...j, status: status === 'done' ? 'completed' : status === 'error' ? 'failed' : 'processing' } : j
          ));

          if (status === 'done') {
            const result = data.data || data;
            setActiveJobs(prev => {
              const newMap = new Map(prev);
              const activeJob = newMap.get(job.id);
              if (activeJob) {
                newMap.set(job.id, {
                  ...activeJob,
                  isPolling: false,
                  finalResult: result,
                });
              }
              return newMap;
            });
            eventSource.close();
            eventSourcesRef.current.delete(job.id);
            refreshBalance();
            // Reload to get updated history with cost
            setTimeout(() => loadJobs(), 500);
          } else if (status === 'error' || status === 'timeout') {
            const errorMsg = data.data?.error || data.error || 'Job failed';
            setActiveJobs(prev => {
              const newMap = new Map(prev);
              const activeJob = newMap.get(job.id);
              if (activeJob) {
                newMap.set(job.id, {
                  ...activeJob,
                  isPolling: false,
                  error: errorMsg,
                });
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
        setActiveJobs(prev => {
          const newMap = new Map(prev);
          const activeJob = newMap.get(job.id);
          if (activeJob) {
            newMap.set(job.id, {
              ...activeJob,
              isPolling: false,
              error: 'Connection lost',
            });
          }
          return newMap;
        });
        eventSource.close();
        eventSourcesRef.current.delete(job.id);
      };
    }, [refreshBalance, loadJobs]);

    useEffect(() => {
      loadJobs();

      pollIntervalRef.current = setInterval(() => {
        loadJobs();
      }, 5000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        eventSourcesRef.current.forEach(es => es.close());
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
        setJobs(prev => prev.filter(j => j.id !== id));
        setActiveJobs(prev => {
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
        eventSourcesRef.current.forEach(es => es.close());
        eventSourcesRef.current.clear();

        await fetch('/api/history?all=true', { method: 'DELETE' });
        setJobs([]);
        setActiveJobs(new Map());
      } catch (err) {
        console.error('[deapi-tester] Failed to clear history:', err);
      }
    };

    const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour12: false });
    };

    const togglePolling = (jobId: string) => {
      setExpandedPollings(prev => {
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
      setExpandedRawRequests(prev => {
        const newSet = new Set(prev);
        if (newSet.has(jobId)) {
          newSet.delete(jobId);
        } else {
          newSet.add(jobId);
        }
        return newSet;
      });
    };

    const statusColors: Record<string, string> = {
      pending: 'bg-yellow-500',
      processing: 'bg-blue-500',
      completed: 'bg-green-500',
      done: 'bg-green-500',
      failed: 'bg-red-500',
      error: 'bg-red-500',
      cancelled: 'bg-zinc-500',
    };

    const activeCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;

    // Determine result type for preview
    const getResultType = (endpointId: string): 'image' | 'video' | 'audio' | 'other' => {
      if (endpointId.includes('txt2img') || endpointId.includes('img2img') || endpointId.includes('rmbg') || endpointId.includes('upscale')) {
        return 'image';
      }
      if (endpointId.includes('video')) {
        return 'video';
      }
      if (endpointId.includes('audio') || endpointId.includes('txt2audio')) {
        return 'audio';
      }
      return 'other';
    };

    // Get all logs from all jobs for logs view
    const allLogs = Array.from(activeJobs.values())
      .flatMap(aj => aj.pollUpdates.map(u => ({ ...u, jobId: aj.job.id, endpointId: aj.job.endpointId })))
      .sort((a, b) => a.timestamp - b.timestamp);

    return (
      <div className="h-full flex flex-col bg-[var(--surface)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Jobs</span>
            {jobs.length > 0 && (
              <span className="text-[10px] font-mono text-zinc-600">{jobs.length}</span>
            )}
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
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 8a6 6 0 0 1 10.2-4.2M14 8a6 6 0 0 1-10.2 4.2" strokeLinecap="round" />
                <path d="M14 2v4h-4M2 14v-4h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={handleClearAll}
              className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
              title="Clear all"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4h12M5 4V2h6v2M6 7v6M10 7v6M3 4l1 10h8l1-10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'list' ? (
          /* List View */
          <div className="flex-1 overflow-y-auto">
            {isLoading && jobs.length === 0 ? (
              <div className="p-8 text-sm text-zinc-500 text-center">Loading...</div>
            ) : jobs.length === 0 ? (
              <div className="p-8 text-sm text-zinc-600 text-center">No jobs yet. Select an endpoint and execute a request.</div>
            ) : (
              <div className="divide-y divide-[var(--border-dim)]">
                {jobs.map((job) => {
                  const activeJob = activeJobs.get(job.id);
                  const isPollingExpanded = expandedPollings.has(job.id);
                  const isRawExpanded = expandedRawRequests.has(job.id);
                  const lastUpdate = activeJob?.pollUpdates[activeJob.pollUpdates.length - 1];
                  const cost = getCost(job, activeJob);
                  const resultUrl = getResultUrl(job, activeJob);
                  const resultType = getResultType(job.endpointId);
                  const downloadState = downloadStates.get(job.id);

                  return (
                    <div key={job.id} className="hover:bg-zinc-800/20">
                      {/* Job Row - 3 columns */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
                        {/* Column 1: Job Info (5 cols) */}
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          {/* Status dot */}
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[job.status]} ${
                            activeJob?.isPolling ? 'status-pulse' : ''
                          }`} />

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-zinc-300">{job.endpointId}</span>
                              {job.requestId && (
                                <span className="text-[10px] font-mono text-zinc-500">{job.requestId}</span>
                              )}
                              {cost !== null && (
                                <span className="text-[10px] font-mono text-yellow-500">
                                  ${typeof cost === 'number' && cost !== 0 && Math.abs(cost) < 0.000001
                                    ? cost.toFixed(10).replace(/\.?0+$/, '')
                                    : cost}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-600 truncate font-mono">
                              {typeof job.params.prompt === 'string'
                                ? job.params.prompt.slice(0, 60)
                                : typeof job.params.text === 'string'
                                  ? job.params.text.slice(0, 60)
                                  : typeof job.params.input === 'string'
                                    ? job.params.input.slice(0, 60)
                                    : job.requestId || '—'}
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Polling & Status (4 cols) */}
                        <div className="col-span-4 flex items-center gap-2">
                          {/* Progress and elapsed time for active jobs */}
                          {activeJob && activeJob.pollUpdates.length > 0 && (() => {
                            const firstPollUpdate = activeJob.pollUpdates[0];
                            const lastPollUpdate = activeJob.pollUpdates[activeJob.pollUpdates.length - 1];
                            // Extract progress - API response is in update.data.data (SSE wraps it)
                            const apiData = (lastPollUpdate?.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
                            const pollProgress = apiData?.progress as number | undefined;
                            const elapsedSec = Math.floor(((activeJob.isPolling ? now : lastPollUpdate?.timestamp) - firstPollUpdate?.timestamp) / 1000);

                            return (
                              <div className="flex items-center gap-2 text-[10px] font-mono">
                                {pollProgress !== undefined && (
                                  <span className="text-blue-400">{pollProgress}%</span>
                                )}
                                <span className="text-zinc-500">{elapsedSec}s</span>
                              </div>
                            );
                          })()}

                          {/* Raw request button */}
                          {job.rawRequest && (
                            <button
                              onClick={() => toggleRawRequest(job.id)}
                              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                isRawExpanded ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'
                              }`}
                            >
                              Raw
                            </button>
                          )}

                          {/* Polling expand button */}
                          {activeJob && activeJob.pollUpdates.length > 0 && (
                            <button
                              onClick={() => togglePolling(job.id)}
                              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                                isPollingExpanded ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800'
                              }`}
                            >
                              <svg
                                width="8"
                                height="8"
                                viewBox="0 0 8 8"
                                fill="currentColor"
                                className={`transition-transform ${isPollingExpanded ? 'rotate-90' : ''}`}
                              >
                                <path d="M2 0l4 4-4 4" />
                              </svg>
                              {activeJob.pollUpdates.length}
                            </button>
                          )}

                          {/* Status badge - show polling API status or REQUEST FAILURE */}
                          {(() => {
                            // Determine what status to display
                            let displayStatus: string;
                            let statusClass: string;

                            if (activeJob?.error) {
                              // SSE connection error
                              displayStatus = 'CONNECTION LOST';
                              statusClass = 'failed';
                            } else if (lastUpdate?.status) {
                              // Use status directly from polling API
                              displayStatus = lastUpdate.status.toUpperCase();
                              statusClass = lastUpdate.status === 'done' ? 'completed' :
                                           lastUpdate.status === 'error' ? 'failed' :
                                           lastUpdate.status;
                            } else if (job.status === 'failed' && !activeJob?.pollUpdates?.length) {
                              // Request failed before polling started
                              displayStatus = 'REQUEST FAILURE';
                              statusClass = 'failed';
                            } else {
                              // Fallback to job status (uppercase)
                              displayStatus = job.status.toUpperCase();
                              statusClass = job.status;
                            }

                            return (
                              <span className={`status-badge status-${statusClass}`}>{displayStatus}</span>
                            );
                          })()}

                          {/* Error message for failed jobs */}
                          {job.status === 'failed' && job.error && (
                            <span className="text-[10px] text-red-400 truncate max-w-[150px]" title={job.error}>
                              {job.error}
                            </span>
                          )}

                          {/* Time */}
                          <span className="text-[10px] text-zinc-600">{formatTime(job.createdAt)}</span>
                        </div>

                        {/* Column 3: Preview & Actions (3 cols) */}
                        <div className="col-span-3 flex items-center justify-end gap-2">
                          {/* Result preview thumbnail */}
                          {resultUrl && (resultType === 'image' || resultType === 'video') && (
                            <div
                              className="w-12 h-12 rounded bg-zinc-900 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all flex-shrink-0"
                              onClick={() => handleOpenResult(resultUrl)}
                            >
                              {resultType === 'image' ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={resultUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <video src={resultUrl} className="w-full h-full object-cover" muted />
                              )}
                            </div>
                          )}

                          {/* Processing placeholder */}
                          {activeJob?.isPolling && !resultUrl && (resultType === 'image' || resultType === 'video') && (
                            <div className="w-12 h-12 rounded bg-zinc-900 flex items-center justify-center flex-shrink-0">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700 animate-spin">
                                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                                <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
                              </svg>
                            </div>
                          )}

                          {/* Action buttons */}
                          {resultUrl && job.status === 'completed' && (
                            <>
                              <button
                                onClick={() => handleOpenResult(resultUrl)}
                                className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors"
                                title="Open"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 8V14H2V4h6M10 2h4v4M16 0L8 8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDownload(job, resultUrl)}
                                disabled={downloadState?.isDownloading}
                                className={`p-1.5 transition-colors ${downloadState?.downloaded ? 'text-green-400' : 'text-zinc-500 hover:text-green-400'}`}
                                title="Download"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M8 2v8M4 7l4 4 4-4M2 12v2h12v-2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </>
                          )}

                          {onRerun && (
                            <button
                              onClick={() => onRerun(job)}
                              className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                              title="Rerun"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 2v12l10-6-10-6z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(job.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 4h12M5 4V2h6v2M6 7v6M10 7v6M3 4l1 10h8l1-10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Raw Request & Response */}
                      {isRawExpanded && (job.rawRequest || job.rawResponse) && (
                        <div className="px-4 pb-3 space-y-2">
                          {/* Raw Request */}
                          {job.rawRequest && (
                            <div className="bg-zinc-900/50 border border-[var(--border-dim)] rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Raw Request</span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(JSON.stringify(job.rawRequest, null, 2))}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-40">
                                {JSON.stringify(job.rawRequest, null, 2)}
                              </pre>
                            </div>
                          )}
                          {/* Raw Response */}
                          {job.rawResponse && (
                            <div className="bg-zinc-900/50 border border-[var(--border-dim)] rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Raw Response</span>
                                <button
                                  onClick={() => navigator.clipboard.writeText(JSON.stringify(job.rawResponse, null, 2))}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-40">
                                {JSON.stringify(job.rawResponse, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Polling Details */}
                      {isPollingExpanded && activeJob && activeJob.pollUpdates.length > 0 && (() => {
                        const firstUpdate = activeJob.pollUpdates[0];
                        const lastUpdateData = activeJob.pollUpdates[activeJob.pollUpdates.length - 1];
                        const elapsedMs = ((activeJob.isPolling ? now : lastUpdateData?.timestamp) || Date.now()) - (firstUpdate?.timestamp || Date.now());
                        const elapsedSec = Math.floor(elapsedMs / 1000);
                        // Extract progress - API response is in update.data.data
                        const apiData = (lastUpdateData?.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
                        const progressData = apiData?.progress as number | undefined;

                        return (
                          <div className="bg-zinc-900/50 border-t border-[var(--border-dim)]">
                            <div className="px-4 py-2">
                              {/* Header with elapsed time and progress */}
                              <div className="flex items-center justify-between mb-2 text-[10px]">
                                <span className="text-zinc-500 uppercase tracking-wide">Polling Updates</span>
                                <div className="flex items-center gap-3 text-zinc-400 font-mono">
                                  {progressData !== undefined && (
                                    <span className="text-blue-400">{progressData}%</span>
                                  )}
                                  <span>
                                    {elapsedSec}s
                                    {activeJob.isPolling && <span className="ml-1 text-blue-400">(running)</span>}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                {activeJob.pollUpdates.slice().reverse().map((update, idx) => {
                                  const updateApiData = (update.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
                                  const updateProgress = updateApiData?.progress as number | undefined;
                                  return (
                                    <details key={activeJob.pollUpdates.length - idx} className="group">
                                      <summary className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer text-xs">
                                        <svg
                                          width="8"
                                          height="8"
                                          viewBox="0 0 8 8"
                                          fill="currentColor"
                                          className="text-zinc-600 transition-transform group-open:rotate-90 flex-shrink-0"
                                        >
                                          <path d="M2 0l4 4-4 4" />
                                        </svg>
                                        <span className="text-zinc-600 font-mono w-8">#{update.attempt}</span>
                                        <span className={`font-medium ${
                                          update.status === 'done' ? 'text-green-500' :
                                          update.status === 'error' ? 'text-red-500' :
                                          update.status === 'processing' ? 'text-blue-400' :
                                          'text-yellow-500'
                                        }`}>
                                          {update.status}
                                        </span>
                                        {updateProgress !== undefined && (
                                          <span className="text-blue-400 font-mono">{updateProgress}%</span>
                                        )}
                                        <span className="text-zinc-600 flex-1 text-right">
                                          +{Math.floor((update.timestamp - firstUpdate.timestamp) / 1000)}s
                                        </span>
                                      </summary>
                                      <div className="ml-5 mt-1 mb-2">
                                        <pre className="text-[10px] font-mono text-zinc-500 bg-zinc-900 rounded p-2 overflow-x-auto max-h-32">
                                          {JSON.stringify(update.data, null, 2)}
                                        </pre>
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Error display */}
                      {activeJob?.error && (
                        <div className="px-4 pb-3">
                          <div className="p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400">
                            {activeJob.error}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Logs View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Log controls */}
            <div className="flex items-center justify-between px-4 py-1 border-b border-[var(--border-dim)] bg-[var(--surface-2)] flex-shrink-0">
              <span className="text-[10px] text-zinc-500">
                {allLogs.length} events
              </span>
              <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="w-3 h-3"
                />
                Auto-scroll
              </label>
            </div>

            {/* Log stream */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto font-mono text-[11px]"
            >
              {allLogs.length === 0 ? (
                <div className="p-8 text-xs text-zinc-600 text-center">No polling events yet</div>
              ) : (
                allLogs.map((log, idx) => (
                  <details key={idx} className="group border-b border-[var(--border-dim)]">
                    <summary className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-zinc-800/30 log-line">
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="currentColor"
                        className="text-zinc-600 transition-transform group-open:rotate-90 flex-shrink-0"
                      >
                        <path d="M2 0l4 4-4 4" />
                      </svg>
                      <span className="text-zinc-600 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      <span className={`shrink-0 ${
                        log.status === 'done' ? 'text-green-500' :
                        log.status === 'error' ? 'text-red-500' :
                        log.status === 'processing' ? 'text-blue-400' :
                        'text-yellow-500'
                      }`}>
                        [{log.status}]
                      </span>
                      <span className="text-zinc-500 shrink-0">{log.endpointId}</span>
                      <span className="text-zinc-600 shrink-0">#{log.attempt}</span>
                    </summary>
                    <div className="px-4 pb-2">
                      <pre className="text-[10px] font-mono text-zinc-500 bg-zinc-900 rounded p-2 overflow-x-auto max-h-48">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
