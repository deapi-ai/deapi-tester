'use client';

import { useState, useEffect, useCallback } from 'react';
import { Job } from '@/lib/types';

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

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫',
  };

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400',
    processing: 'text-blue-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    cancelled: 'text-zinc-500',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <span>📋</span> History
          {jobs.length > 0 && (
            <span className="text-xs text-zinc-500">({jobs.length})</span>
          )}
        </span>
        <span className="text-xs text-zinc-500">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-800">
          {isLoading ? (
            <div className="p-4 text-sm text-zinc-500 text-center">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500 text-center italic">No history yet</div>
          ) : (
            <>
              <div className="flex justify-end px-4 py-2 border-b border-zinc-800">
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
                    className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30"
                  >
                    <span className="text-lg">{statusIcons[job.status] || '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-300 truncate">
                        {job.endpointId}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {typeof job.params.prompt === 'string'
                          ? job.params.prompt.slice(0, 50)
                          : job.requestId || 'No prompt'}
                      </p>
                    </div>
                    <span className={`text-xs ${statusColors[job.status]}`}>
                      {job.status}
                    </span>
                    <span className="text-xs text-zinc-600 w-16 text-right">
                      {formatTime(job.createdAt)}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onRerun(job)}
                        className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded"
                        title="Rerun"
                      >
                        🔄
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="text-xs px-2 py-1 bg-zinc-800 hover:bg-red-900 rounded"
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
