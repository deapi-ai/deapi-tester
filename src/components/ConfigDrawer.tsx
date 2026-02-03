'use client';

import { useState, useEffect } from 'react';
import { useBalance } from './BalanceContext';

interface ConfigState {
  apiUrl: string;
  apiToken: string;
  outputDir: string;
  hasToken: boolean;
}

interface ConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigDrawer({ isOpen, onClose }: ConfigDrawerProps) {
  const { balance, refreshBalance, isLoading: isBalanceLoading } = useBalance();
  const [config, setConfig] = useState<ConfigState>({
    apiUrl: '',
    apiToken: '',
    outputDir: '',
    hasToken: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig({
        apiUrl: data.apiUrl || '',
        apiToken: '',
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
    setSuccess(false);

    try {
      const updateData: Partial<ConfigState> = {
        apiUrl: config.apiUrl,
        outputDir: config.outputDir,
      };

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

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

      if (data.hasToken) {
        refreshBalance();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 fade-enter"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-[var(--surface)] border-l border-[var(--border)] z-50 drawer-enter flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-zinc-200">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Balance Card */}
          <div className="bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Balance</span>
              <button
                onClick={refreshBalance}
                disabled={isBalanceLoading}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50 p-1"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={isBalanceLoading ? 'animate-spin' : ''}
                >
                  <path d="M14 8A6 6 0 1 1 8 2" strokeLinecap="round" />
                  <path d="M14 2v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <p className="text-xl font-mono font-semibold text-green-400 mt-1">
              {balance !== null ? `$${balance}` : '—'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-lg text-sm text-green-400">
              Configuration saved
            </div>
          )}

          {/* API URL */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">
              API URL
            </label>
            <input
              type="text"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
              className="w-full rounded px-3 py-2 text-sm font-mono"
              placeholder="https://api.deapi.ai/api/v1/client"
            />
          </div>

          {/* API Token */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">
              API Token
              {config.hasToken && (
                <span className="ml-2 text-green-500 normal-case">configured</span>
              )}
            </label>
            <input
              type="password"
              value={config.apiToken}
              onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
              className="w-full rounded px-3 py-2 text-sm font-mono"
              placeholder={config.hasToken ? '••••••••••••••••' : 'Enter your API token'}
            />
          </div>

          {/* Output Directory */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide">
              Output Directory
            </label>
            <input
              type="text"
              value={config.outputDir}
              onChange={(e) => setConfig({ ...config, outputDir: e.target.value })}
              className="w-full rounded px-3 py-2 text-sm font-mono"
              placeholder="./output"
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              Where downloaded results will be saved
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={saveConfig}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded py-2 text-sm font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
