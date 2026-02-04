'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { DeApiModel } from '@/lib/types';

interface ModelsContextValue {
  models: DeApiModel[];
  isLoading: boolean;
  error: string | null;
  refreshModels: () => Promise<void>;
  getModelBySlug: (slug: string) => DeApiModel | undefined;
}

const ModelsContext = createContext<ModelsContextValue | null>(null);

export function useModelsContext() {
  const context = useContext(ModelsContext);
  if (!context) {
    throw new Error('useModelsContext must be used within ModelsProvider');
  }
  return context;
}

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [models, setModels] = useState<DeApiModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/models', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setModels(data.data || []);
    } catch (err) {
      console.error('[deapi-tester] Failed to load models:', err);
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getModelBySlug = useCallback((slug: string): DeApiModel | undefined => {
    return models.find(m => m.slug === slug);
  }, [models]);

  // Load models on mount if token exists
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        const activeProfile = data.profiles?.find((p: { id: string }) => p.id === data.activeProfileId);
        if (activeProfile?.hasToken) {
          refreshModels();
        }
      })
      .catch(console.error);
  }, [refreshModels]);

  return (
    <ModelsContext.Provider value={{ models, isLoading, error, refreshModels, getModelBySlug }}>
      {children}
    </ModelsContext.Provider>
  );
}
