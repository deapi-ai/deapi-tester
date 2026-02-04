'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppConfig, AppConfigFull, ConfigProfile } from '@/lib/types';

interface ProfileWithMask extends Omit<ConfigProfile, 'apiToken'> {
  apiToken: string;
  hasToken: boolean;
}

interface ConfigState {
  activeProfileId: string;
  profiles: ProfileWithMask[];
  outputDir: string;
  pollingIntervalMs: number;
  maxPollingAttempts: number;
  isLoading: boolean;
  error: string | null;
}

export function useConfig() {
  const [config, setConfig] = useState<ConfigState>({
    activeProfileId: '',
    profiles: [],
    outputDir: '',
    pollingIntervalMs: 2000,
    maxPollingAttempts: 120,
    isLoading: true,
    error: null,
  });

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) throw new Error('Failed to load config');

      const data = await res.json();
      setConfig({
        activeProfileId: data.activeProfileId || '',
        profiles: data.profiles || [],
        outputDir: data.outputDir || '',
        pollingIntervalMs: data.pollingIntervalMs || 2000,
        maxPollingAttempts: data.maxPollingAttempts || 120,
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
        activeProfileId: data.activeProfileId || '',
        profiles: data.profiles || [],
        outputDir: data.outputDir || '',
        pollingIntervalMs: data.pollingIntervalMs || 2000,
        maxPollingAttempts: data.maxPollingAttempts || 120,
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

  const switchProfile = useCallback(async (profileId: string) => {
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActiveProfile', profileId }),
      });

      if (!res.ok) throw new Error('Failed to switch profile');

      const data = await res.json();
      setConfig(prev => ({
        ...prev,
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
      }));

      return true;
    } catch (err) {
      setConfig(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to switch profile',
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Get active profile for convenience
  const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);

  // Check if token is configured (for backward compatibility)
  const hasToken = activeProfile?.hasToken || false;

  return {
    config,
    activeProfile,
    hasToken,
    saveConfig,
    switchProfile,
    reloadConfig: loadConfig,
  };
}
