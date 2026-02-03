'use client';

import { useState, useCallback } from 'react';
import { EndpointDefinition, JsonValue } from '@/lib/types';

interface RequestState {
  isLoading: boolean;
  error: string | null;
  jobId: string | null;
  requestId: string | null;
  isAsync: boolean;
  rawRequest: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: JsonValue;
  } | null;
  rawResponse: JsonValue | null;
}

export function useDeApi() {
  const [state, setState] = useState<RequestState>({
    isLoading: false,
    error: null,
    jobId: null,
    requestId: null,
    isAsync: false,
    rawRequest: null,
    rawResponse: null,
  });

  const submitRequest = useCallback(async (
    endpoint: EndpointDefinition,
    params: Record<string, JsonValue>,
    formData?: FormData
  ) => {
    setState({
      isLoading: true,
      error: null,
      jobId: null,
      requestId: null,
      isAsync: false,
      rawRequest: null,
      rawResponse: null,
    });

    try {
      // Add endpoint ID to request
      if (formData) {
        formData.append('_endpointId', endpoint.id);
      }

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: formData ? undefined : { 'Content-Type': 'application/json' },
        body: formData || JSON.stringify({ ...params, _endpointId: endpoint.id }),
      });

      const data = await res.json();

      setState({
        isLoading: false,
        error: data.success ? null : (data.error || 'Request failed'),
        jobId: data.jobId || null,
        requestId: data.requestId || null,
        isAsync: data.isAsync || false,
        rawRequest: data.rawRequest || null,
        rawResponse: data.rawResponse || null,
      });

      return {
        success: data.success,
        jobId: data.jobId,
        requestId: data.requestId,
        isAsync: data.isAsync,
        error: data.error,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      jobId: null,
      requestId: null,
      isAsync: false,
      rawRequest: null,
      rawResponse: null,
    });
  }, []);

  return {
    ...state,
    submitRequest,
    reset,
  };
}
