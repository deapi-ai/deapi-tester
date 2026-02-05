'use client';

import { useState, useEffect, useCallback } from 'react';
import { Job } from '@/lib/types';
import { STATUS_TEXT_COLORS, STATUS_ICONS } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/format-utils';

interface HistoryPanelProps {
  onRerun: (job: Job) => void;
  refreshTrigger?: number;
}

export function HistoryPanel({ onRerun, refreshTrigger }: HistoryPanelProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[deapi-tester] Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      loadHistory();
    }
  }, [isExpanded, refreshTrigger, loadHistory]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      console.error('[deapi-tester] Failed to delete job:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all history?')) return;

    try {
      await fetch('/api/history?all=true', { method: 'DELETE' });
      setJobs([]);
    } catch (err) {
      console.error('[deapi-tester] Failed to clear history:', err);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--hover)] transition-colors"
      >
        <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <span>📋</span> History
          {jobs.length > 0 && (
            <span className="text-xs text-[var(--muted)]">({jobs.length})</span>
          )}
        </span>
        <span className="text-xs text-[var(--muted)]">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--border)]">
          {isLoading ? (
            <div className="p-4 text-sm text-[var(--muted)] text-center">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-4 text-sm text-[var(--muted)] text-center italic">No history yet</div>
          ) : (
            <>
              <div className="flex justify-end px-4 py-2 border-b border-[var(--border)]">
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear All
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--hover)]"
                  >
                    <span className="text-lg">{STATUS_ICONS[job.status] || '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {job.endpointId}
                      </p>
                      <p className="text-xs text-[var(--muted)] truncate">
                        {typeof job.params.prompt === 'string'
                          ? job.params.prompt.slice(0, 50)
                          : job.requestId || 'No prompt'}
                      </p>
                    </div>
                    <span className={`text-xs ${STATUS_TEXT_COLORS[job.status] || 'text-[var(--muted)]'}`}>
                      {job.status}
                    </span>
                    <span className="text-xs text-[var(--text-faint)] w-16 text-right">
                      {formatRelativeTime(job.createdAt)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onRerun(job)}
                        className="text-xs px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--border-strong)] rounded"
                        title="Rerun"
                      >
                        🔄
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="text-xs px-2 py-1 bg-[var(--surface-2)] hover:bg-red-900 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
