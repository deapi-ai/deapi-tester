'use client';

import { useState, useEffect, useCallback } from 'react';
import { JsonValue } from '@/lib/types';

export interface JobResult {
  status: string;
  result_url?: string;
  result?: JsonValue;
  cost_credits?: number;
}

interface JobTrackerProps {
  requestId: string | null;
  onComplete: (result: JobResult) => void;
  onError: (error: string) => void;
}

interface PollData {
  attempt?: number;
  maxAttempts?: number;
  status?: string;
  data?: {
    status: string;
    result_url?: string;
    result?: JsonValue;
    cost_credits?: number;
    error?: string;
  };
  error?: string;
}

export function JobTracker({ requestId, onComplete, onError }: JobTrackerProps) {
  const [status, setStatus] = useState<string>('idle');
  const [attempt, setAttempt] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(120);

  const startPolling = useCallback(() => {
    if (!requestId) return;

    setStatus('polling');
    setAttempt(0);

    const eventSource = new EventSource(`/api/poll/${requestId}`);

    eventSource.onmessage = (event) => {
      try {
        const data: PollData = JSON.parse(event.data);

        setAttempt(data.attempt || 0);
        setMaxAttempts(data.maxAttempts || 120);

        const jobStatus = data.data?.status || data.status;

        if (jobStatus === 'completed') {
          setStatus('completed');
          eventSource.close();
          onComplete({
            status: 'completed',
            result_url: data.data?.result_url,
            result: data.data?.result,
            cost_credits: data.data?.cost_credits,
          });
        } else if (jobStatus === 'failed') {
          setStatus('failed');
          eventSource.close();
          onError(data.data?.error || data.error || 'Job failed');
        } else if (jobStatus === 'timeout') {
          setStatus('timeout');
          eventSource.close();
          onError('Polling timed out');
        } else if (jobStatus === 'error') {
          setStatus('error');
          eventSource.close();
          onError(data.error || 'Unknown error');
        } else {
          setStatus(jobStatus || 'processing');
        }
      } catch (err) {
        console.error('[deapi-tester] Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      eventSource.close();
      onError('Connection lost');
    };

    return () => {
      eventSource.close();
    };
  }, [requestId, onComplete, onError]);

  useEffect(() => {
    if (requestId) {
      const cleanup = startPolling();
      return cleanup;
    }
  }, [requestId, startPolling]);

  if (!requestId) {
    return null;
  }

  const progress = maxAttempts > 0 ? (attempt / maxAttempts) * 100 : 0;

  const statusColors: Record<string, string> = {
    idle: 'text-zinc-500',
    polling: 'text-blue-400',
    processing: 'text-yellow-400',
    pending: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    timeout: 'text-orange-400',
    error: 'text-red-400',
  };

  const statusIcons: Record<string, string> = {
    idle: '⏸️',
    polling: '🔄',
    processing: '⏳',
    pending: '⏳',
    completed: '✅',
    failed: '❌',
    timeout: '⏰',
    error: '⚠️',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <span>{statusIcons[status] || '🔄'}</span> Job Status
        </h3>
        <span className={`text-sm font-medium ${statusColors[status] || 'text-zinc-400'}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {(status === 'polling' || status === 'processing' || status === 'pending') && (
        <>
          <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Polling attempt {attempt} of {maxAttempts}
          </p>
        </>
      )}

      <p className="text-xs text-zinc-600 mt-2 font-mono truncate">
        Request ID: {requestId}
      </p>
    </div>
  );
}
