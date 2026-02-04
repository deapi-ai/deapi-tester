'use client';

import { useState, useEffect } from 'react';
import { useBalance } from './BalanceContext';
import { useModelsContext } from './ModelsContext';

interface ProfileState {
  id: string;
  name: string;
  apiUrl: string;
  hasToken: boolean;
}

interface ConfigState {
  activeProfileId: string;
  profiles: ProfileState[];
  outputDir: string;
}

export function ConfigPanel() {
  const { balance, refreshBalance, isLoading: isBalanceLoading } = useBalance();
  const { refreshModels } = useModelsContext();
  const [config, setConfig] = useState<ConfigState>({
    activeProfileId: '',
    profiles: [],
    outputDir: '',
  });
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig({
        activeProfileId: data.activeProfileId || '',
        profiles: data.profiles || [],
        outputDir: data.outputDir || '',
      });
    } catch (err) {
      console.error('[deapi-tester] Failed to load config:', err);
    }
  };

  const switchProfile = async (profileId: string) => {
    setIsSwitching(true);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActiveProfile', profileId }),
      });
      if (!res.ok) throw new Error('Failed to switch profile');
      const data = await res.json();
      setConfig({
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
        outputDir: data.outputDir,
      });
      // Refresh balance and models for new profile
      refreshBalance();
      refreshModels();
    } catch (err) {
      console.error('[deapi-tester] Failed to switch profile:', err);
    } finally {
      setIsSwitching(false);
    }
  };

  const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <span>Profile:</span>
          </h2>

          {config.profiles.length > 1 ? (
            <select
              value={config.activeProfileId}
              onChange={e => switchProfile(e.target.value)}
              disabled={isSwitching}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              {config.profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} {!profile.hasToken ? '(no token)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-zinc-400 text-sm">
              {activeProfile?.name || 'Default'}
              {activeProfile && !activeProfile.hasToken && (
                <span className="ml-2 text-red-400">(no token)</span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {balance !== null && (
            <span className="text-sm text-green-400 flex items-center gap-1">
              Balance: ${balance}
              <button
                onClick={refreshBalance}
                disabled={isBalanceLoading}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                title="Refresh balance"
              >
                {isBalanceLoading ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
                    <path d="M14 2v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </span>
          )}
        </div>
      </div>

      {activeProfile && (
        <div className="mt-2 text-xs text-zinc-500 font-mono truncate">
          {activeProfile.apiUrl}
        </div>
      )}
    </div>
  );
}
