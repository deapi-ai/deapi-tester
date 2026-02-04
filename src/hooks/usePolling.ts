'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { JsonValue } from '@/lib/types';

interface PollState {
  status: 'idle' | 'polling' | 'completed' | 'failed' | 'timeout' | 'error';
  attempt: number;
  maxAttempts: number;
  data: JsonValue | null;
  error: string | null;
}

interface PollResult {
  status: string;
  result_url?: string;
  result?: JsonValue;
  cost_credits?: number;
  error?: string;
}

export function usePolling(requestId: string | null) {
  const [state, setState] = useState<PollState>({
    status: 'idle',
    attempt: 0,
    maxAttempts: 120,
    data: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const stopPolling = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!requestId) return;

    stopPolling();

    setState({
      status: 'polling',
      attempt: 0,
      maxAttempts: 120,
      data: null,
      error: null,
    });

    const eventSource = new EventSource(`/api/poll/${requestId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const status = data.data?.status || data.status;

        setState(prev => ({
          ...prev,
          attempt: data.attempt || prev.attempt,
          maxAttempts: data.maxAttempts || prev.maxAttempts,
          data: data,
        }));

        // deAPI returns: pending, processing, done, error
        if (status === 'done' || status === 'completed') {
          setState(prev => ({ ...prev, status: 'completed' }));
          eventSource.close();
        } else if (status === 'error' || status === 'failed') {
          setState(prev => ({
            ...prev,
            status: 'failed',
            error: data.data?.error || data.error || 'Job failed',
          }));
          eventSource.close();
        } else if (status === 'timeout') {
          setState(prev => ({ ...prev, status: 'timeout', error: 'Polling timed out' }));
          eventSource.close();
        }
      } catch (err) {
        console.error('[deapi-tester] Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      setState(prev => ({ ...prev, status: 'error', error: 'Connection lost' }));
      eventSource.close();
    };
  }, [requestId, stopPolling]);

  useEffect(() => {
    if (requestId) {
      startPolling();
    }
    return () => stopPolling();
  }, [requestId, startPolling, stopPolling]);

  const getResult = useCallback((): PollResult | null => {
    if (!state.data || typeof state.data !== 'object') return null;
    const data = state.data as Record<string, JsonValue>;
    const innerData = data.data as Record<string, JsonValue> | undefined;

    return {
      status: (innerData?.status as string) || (data.status as string) || '',
      result_url: innerData?.result_url as string | undefined,
      result: innerData?.result,
      cost_credits: innerData?.cost_credits as number | undefined,
      error: (innerData?.error as string) || (data.error as string),
    };
  }, [state.data]);

  return {
    ...state,
    startPolling,
    stopPolling,
    getResult,
  };
}
