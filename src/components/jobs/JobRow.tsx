'use client';

import { useState } from 'react';
import { ChevronRight, ExternalLink, Download, Trash2, Loader2, Copy, ClipboardCopy, ClipboardCheck } from 'lucide-react';
import { Job, JsonValue } from '@/lib/types';
import { STATUS_BG_COLORS } from '@/lib/constants';
import { formatTime, formatCost, getResultType, getResultText } from '@/lib/format-utils';
import { useSettings } from '@/components/SettingsContext';

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

interface JobRowProps {
  job: Job;
  activeJob?: ActiveJob;
  isPollingExpanded: boolean;
  isRawExpanded: boolean;
  downloadState?: DownloadState;
  now: number;
  onTogglePolling: (jobId: string) => void;
  onToggleRaw: (jobId: string) => void;
  onOpenResult: (url: string) => void;
  onDownload: (job: Job, resultUrl: string) => void;
  onDelete: (jobId: string) => void;
  onDuplicate: (job: Job) => void;
}

export function JobRow({
  job,
  activeJob,
  isPollingExpanded,
  isRawExpanded,
  downloadState,
  now,
  onTogglePolling,
  onToggleRaw,
  onOpenResult,
  onDownload,
  onDelete,
  onDuplicate,
}: JobRowProps) {
  const { showResponseHeaders } = useSettings();
  const [copiedOutput, setCopiedOutput] = useState(false);
  const lastUpdate = activeJob?.pollUpdates[activeJob.pollUpdates.length - 1];
  const hasResponseHeaders =
    !!job.rawResponseHeaders && Object.keys(job.rawResponseHeaders).length > 0;
  // Text output (OCR, transcription, prompt booster) — offer a one-click copy.
  const resultText = getResultText(job);

  const handleCopyOutput = () => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1500);
  };

  const getResultUrl = (): string | null => {
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

  const getCost = (): number | null => {
    if (job.costCredits !== undefined && job.costCredits !== null) return job.costCredits;
    if (activeJob?.finalResult) {
      const result = activeJob.finalResult as Record<string, JsonValue>;
      if (result.cost_credits !== undefined) return result.cost_credits as number;
    }
    if (job.rawResponse) {
      const response = job.rawResponse as Record<string, JsonValue>;
      const data = response.data as Record<string, JsonValue> | undefined;
      if (data?.cost_credits !== undefined) return data.cost_credits as number;
    }
    return null;
  };

  const resultUrl = getResultUrl();
  const cost = getCost();
  // Derived from the result URL extension (most reliable) with the endpoint's
  // group as fallback — robust to the v2 path stored in job.endpointId.
  const resultType = getResultType(job.endpointId, resultUrl);

  return (
    <div className="hover:bg-[var(--hover)]">
      {/* Job Row - 3 columns */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
        {/* Column 1: Job Info (5 cols) */}
        <div className="col-span-5 flex items-center gap-3 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_BG_COLORS[job.status] || 'bg-[var(--muted)]'} ${
              activeJob?.isPolling || job.status === 'sending' ? 'status-pulse' : ''
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">{job.endpointId}</span>
              {job.requestId && (
                <span className="text-[10px] font-mono text-[var(--muted)]">{job.requestId}</span>
              )}
              {cost !== null && (
                <span className="text-[10px] font-mono text-yellow-500">${formatCost(cost)}</span>
              )}
            </div>
            <div className="text-xs text-[var(--text-faint)] truncate font-mono">
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
          {activeJob && activeJob.pollUpdates.length > 0 && (() => {
            const firstPollUpdate = activeJob.pollUpdates[0];
            const lastPollUpdate = activeJob.pollUpdates[activeJob.pollUpdates.length - 1];
            const apiData = (lastPollUpdate?.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
            const pollProgress = apiData?.progress as number | undefined;
            const elapsedSec = Math.floor(
              ((activeJob.isPolling ? now : lastPollUpdate?.timestamp) - firstPollUpdate?.timestamp) / 1000
            );

            return (
              <div className="flex items-center gap-2 text-[10px] font-mono">
                {pollProgress !== undefined && <span className="text-blue-400">{pollProgress}%</span>}
                <span className="text-[var(--muted)]">{elapsedSec}s</span>
              </div>
            );
          })()}

          {job.rawRequest && (
            <button
              onClick={() => onToggleRaw(job.id)}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                isRawExpanded
                  ? 'bg-[var(--border-strong)] text-[var(--text-primary)]'
                  : 'text-[var(--muted)] hover:text-[var(--text-primary)] bg-[var(--hover)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Raw
            </button>
          )}

          {activeJob && activeJob.pollUpdates.length > 0 && (
            <button
              onClick={() => onTogglePolling(job.id)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                isPollingExpanded
                  ? 'bg-[var(--border-strong)] text-[var(--text-primary)]'
                  : 'text-[var(--muted)] hover:text-[var(--text-primary)] bg-[var(--hover)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <ChevronRight className={`w-2 h-2 transition-transform ${isPollingExpanded ? 'rotate-90' : ''}`} />
              {activeJob.pollUpdates.length}
            </button>
          )}

          {(() => {
            let displayStatus: string;
            let statusClass: string;

            if (activeJob?.error) {
              displayStatus = 'CONNECTION LOST';
              statusClass = 'failed';
            } else if (lastUpdate?.status) {
              displayStatus = lastUpdate.status.toUpperCase();
              statusClass =
                lastUpdate.status === 'done'
                  ? 'completed'
                  : lastUpdate.status === 'error'
                    ? 'failed'
                    : lastUpdate.status;
            } else if (job.status === 'failed' && !activeJob?.pollUpdates?.length) {
              displayStatus = 'REQUEST FAILURE';
              statusClass = 'failed';
            } else {
              displayStatus = job.status.toUpperCase();
              statusClass = job.status;
            }

            return <span className={`status-badge status-${statusClass}`}>{displayStatus}</span>;
          })()}

          {job.status === 'failed' && job.error && (
            <span className="text-[10px] text-red-400 truncate max-w-[150px]" title={job.error}>
              {job.error}
            </span>
          )}

          <span className="text-[10px] text-[var(--text-faint)]">{formatTime(job.createdAt)}</span>
        </div>

        {/* Column 3: Preview & Actions (3 cols) */}
        <div className="col-span-3 flex items-center justify-end gap-2">
          {resultUrl && (resultType === 'image' || resultType === 'video') && (
            <div
              className="w-12 h-12 rounded bg-[var(--surface)] overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all flex-shrink-0"
              onClick={() => onOpenResult(resultUrl)}
            >
              {resultType === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={resultUrl} className="w-full h-full object-cover" muted />
              )}
            </div>
          )}

          {resultUrl && resultType === 'audio' && (
            <audio src={resultUrl} controls className="h-8 w-32 flex-shrink-0" style={{ minWidth: '128px' }} />
          )}

          {activeJob?.isPolling && !resultUrl && (resultType === 'image' || resultType === 'video' || resultType === 'audio') &&
            (() => {
              const lastPoll = activeJob.pollUpdates[activeJob.pollUpdates.length - 1];
              const pollApiData = (lastPoll?.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
              const previewBase64 = pollApiData?.preview as string | undefined;

              if (previewBase64 && resultType === 'image') {
                return (
                  <div className="w-12 h-12 rounded bg-[var(--surface)] overflow-hidden flex-shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/jpeg;base64,${previewBase64}`}
                      alt="Preview"
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="w-3 h-3 text-white/70 animate-spin" />
                    </div>
                  </div>
                );
              }

              return (
                <div className="w-12 h-12 rounded bg-[var(--surface)] flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 text-[var(--border-strong)] animate-spin" />
                </div>
              );
            })()}

          {resultUrl && job.status === 'completed' && (
            <>
              <button
                onClick={() => onOpenResult(resultUrl)}
                className="p-1.5 text-[var(--muted)] hover:text-blue-400 transition-colors"
                title="Open"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDownload(job, resultUrl)}
                disabled={downloadState?.isDownloading}
                className={`p-1.5 transition-colors ${
                  downloadState?.downloaded ? 'text-green-400' : 'text-[var(--muted)] hover:text-green-400'
                }`}
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {resultText && (
            <button
              onClick={handleCopyOutput}
              className={`p-1.5 transition-colors ${
                copiedOutput ? 'text-green-400' : 'text-[var(--muted)] hover:text-blue-400'
              }`}
              title="Copy text output to clipboard"
            >
              {copiedOutput ? (
                <ClipboardCheck className="w-3.5 h-3.5" />
              ) : (
                <ClipboardCopy className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            onClick={() => onDuplicate(job)}
            className="p-1.5 text-[var(--muted)] hover:text-blue-400 transition-colors"
            title="Duplicate request — load these parameters into the form"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(job.id)}
            className="p-1.5 text-[var(--muted)] hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Raw Request & Response */}
      {isRawExpanded && (job.rawRequest || job.rawResponse || (showResponseHeaders && hasResponseHeaders)) && (
        <div className="px-4 pb-3 space-y-2">
          {job.rawRequest && (
            <div className="bg-[var(--surface-inset)] border border-[var(--border-dim)] rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Raw Request</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(job.rawRequest, null, 2))}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--text-primary)]"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-40">
                {JSON.stringify(job.rawRequest, null, 2)}
              </pre>
            </div>
          )}
          {showResponseHeaders && hasResponseHeaders && (
            <div className="bg-[var(--surface-inset)] border border-[var(--border-dim)] rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Response Headers</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(job.rawResponseHeaders, null, 2))}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--text-primary)]"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-40">
                {Object.entries(job.rawResponseHeaders!)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join('\n')}
              </pre>
            </div>
          )}
          {job.rawResponse && (
            <div className="bg-[var(--surface-inset)] border border-[var(--border-dim)] rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Raw Response</span>
                <button
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(job.rawResponse, null, 2))}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--text-primary)]"
                >
                  Copy
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-40">
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
        const elapsedMs =
          ((activeJob.isPolling ? now : lastUpdateData?.timestamp) || Date.now()) - (firstUpdate?.timestamp || Date.now());
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const apiData = (lastUpdateData?.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
        const progressData = apiData?.progress as number | undefined;

        return (
          <div className="bg-[var(--surface-inset)] border-t border-[var(--border-dim)]">
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-2 text-[10px]">
                <span className="text-[var(--muted)] uppercase tracking-wide">Polling Updates</span>
                <div className="flex items-center gap-3 text-[var(--text-secondary)] font-mono">
                  {progressData !== undefined && <span className="text-blue-400">{progressData}%</span>}
                  <span>
                    {elapsedSec}s{activeJob.isPolling && <span className="ml-1 text-blue-400">(running)</span>}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                {activeJob.pollUpdates
                  .slice()
                  .reverse()
                  .map((update, idx) => {
                    const updateApiData = (update.data as Record<string, unknown>)?.data as
                      | Record<string, unknown>
                      | undefined;
                    const updateProgress = updateApiData?.progress as number | undefined;
                    return (
                      <details key={activeJob.pollUpdates.length - idx} className="group">
                        <summary className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--hover)] cursor-pointer text-xs">
                          <ChevronRight className="w-2 h-2 text-[var(--text-faint)] transition-transform group-open:rotate-90 flex-shrink-0" />
                          <span className="text-[var(--text-faint)] font-mono w-8">#{update.attempt}</span>
                          <span
                            className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                              update.source === 'ws'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-[var(--surface-2)] text-[var(--muted)]'
                            }`}
                            title={update.source === 'ws' ? 'Received over WebSocket' : 'Received via polling'}
                          >
                            {update.source === 'ws' ? 'WS' : 'POLL'}
                          </span>
                          <span
                            className={`font-medium ${
                              update.status === 'done'
                                ? 'text-green-500'
                                : update.status === 'error'
                                  ? 'text-red-500'
                                  : update.status === 'processing'
                                    ? 'text-blue-400'
                                    : 'text-yellow-500'
                            }`}
                          >
                            {update.status}
                          </span>
                          {updateProgress !== undefined && (
                            <span className="text-blue-400 font-mono">{updateProgress}%</span>
                          )}
                          <span className="text-[var(--text-faint)] flex-1 text-right">
                            +{Math.floor((update.timestamp - firstUpdate.timestamp) / 1000)}s
                          </span>
                        </summary>
                        <div className="ml-5 mt-1 mb-2">
                          <pre className="text-[10px] font-mono text-[var(--muted)] bg-[var(--surface)] rounded p-2 overflow-x-auto max-h-32">
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

      {activeJob?.error && (
        <div className="px-4 pb-3">
          <div className="p-2 bg-red-900/20 border border-red-800/50 rounded text-xs text-red-400">
            {activeJob.error}
          </div>
        </div>
      )}
    </div>
  );
}
