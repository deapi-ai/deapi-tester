'use client';

import { useState, useEffect, useCallback } from 'react';
import { DeApiModel } from '@/lib/types';

interface ModelsState {
  models: DeApiModel[];
  isLoading: boolean;
  error: string | null;
}

let cachedModels: DeApiModel[] | null = null;

export function useModels() {
  const [state, setState] = useState<ModelsState>({
    models: cachedModels || [],
    isLoading: !cachedModels,
    error: null,
  });

  const fetchModels = useCallback(async () => {
    if (cachedModels) {
      setState({ models: cachedModels, isLoading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch('/api/models');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const models = data.data || [];
      cachedModels = models;
      setState({ models, isLoading: false, error: null });
    } catch (err) {
      console.error('[deapi-tester] Failed to load models:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load models',
      }));
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const getModelBySlug = useCallback((slug: string): DeApiModel | undefined => {
    return state.models.find(m => m.slug === slug);
  }, [state.models]);

  const refreshModels = useCallback(async () => {
    cachedModels = null;
    await fetchModels();
  }, [fetchModels]);

  return {
    ...state,
    getModelBySlug,
    refreshModels,
  };
}
