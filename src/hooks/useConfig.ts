'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppConfig } from '@/lib/types';

interface ConfigState extends Partial<AppConfig> {
  hasToken: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useConfig() {
  const [config, setConfig] = useState<ConfigState>({
    hasToken: false,
    isLoading: true,
    error: null,
  });

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load config');

      const data = await res.json();
      setConfig({
        apiUrl: data.apiUrl,
        outputDir: data.outputDir,
        pollingIntervalMs: data.pollingIntervalMs,
        maxPollingAttempts: data.maxPollingAttempts,
        hasToken: data.hasToken,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setConfig(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load config',
      }));
    }
  }, []);

  const saveConfig = useCallback(async (updates: Partial<AppConfig>) => {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to save config');

      const data = await res.json();
      setConfig({
        apiUrl: data.apiUrl,
        outputDir: data.outputDir,
        pollingIntervalMs: data.pollingIntervalMs,
        maxPollingAttempts: data.maxPollingAttempts,
        hasToken: data.hasToken,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      setConfig(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save config',
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    saveConfig,
    reloadConfig: loadConfig,
  };
}
