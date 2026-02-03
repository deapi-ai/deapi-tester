'use client';

import { useState, useEffect } from 'react';
import { useBalance } from './BalanceContext';

interface ConfigState {
  apiUrl: string;
  apiToken: string;
  outputDir: string;
  hasToken: boolean;
}

export function ConfigPanel() {
  const { balance, refreshBalance, isLoading: isBalanceLoading } = useBalance();
  const [config, setConfig] = useState<ConfigState>({
    apiUrl: '',
    apiToken: '',
    outputDir: '',
    hasToken: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig({
        apiUrl: data.apiUrl || '',
        apiToken: '', // Don't show masked token in input
        outputDir: data.outputDir || '',
        hasToken: data.hasToken || false,
      });
    } catch (err) {
      console.error('[deapi-tester] Failed to load config:', err);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const updateData: Partial<ConfigState> = {
        apiUrl: config.apiUrl,
        outputDir: config.outputDir,
      };

      // Only send token if it was changed (not empty)
      if (config.apiToken) {
        updateData.apiToken = config.apiToken;
      }

      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setConfig({
        apiUrl: data.apiUrl || '',
        apiToken: '',
        outputDir: data.outputDir || '',
        hasToken: data.hasToken || false,
      });

      setIsEditing(false);

      // Refresh balance if token was set
      if (data.hasToken) {
        refreshBalance();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <span>⚙️</span> Configuration
        </h2>
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
                {isBalanceLoading ? '⏳' : '🔄'}
              </button>
            </span>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/50 border border-red-800 rounded text-sm text-red-300">
          {error}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">API URL</label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="https://api.deapi.ai/api/v1/client"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">
              API Token {config.hasToken && <span className="text-green-500">(configured)</span>}
            </label>
            <input
              type="password"
              value={config.apiToken}
              onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder={config.hasToken ? '••••••••' : 'Enter your deAPI token'}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Output Directory</label>
            <input
              type="text"
              value={config.outputDir}
              onChange={(e) => setConfig({ ...config, outputDir: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="./output"
            />
          </div>
          <button
            onClick={saveConfig}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded py-2 text-sm font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-zinc-500">API:</span>{' '}
            <span className="text-zinc-300 truncate">{config.apiUrl || 'Not set'}</span>
          </div>
          <div>
            <span className="text-zinc-500">Token:</span>{' '}
            <span className={config.hasToken ? 'text-green-400' : 'text-red-400'}>
              {config.hasToken ? 'Configured' : 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Output:</span>{' '}
            <span className="text-zinc-300">{config.outputDir || './output'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
