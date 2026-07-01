'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, Pencil, Trash2, Copy, AlertTriangle } from 'lucide-react';
import { useBalance } from './BalanceContext';
import { useModelsContext } from './ModelsContext';
import { useSettings } from './SettingsContext';
import { useJobSocket } from './JobSocketContext';

interface ProfileState {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  hasToken: boolean;
  wsEnabled?: boolean;
  wsKey?: string;
  wsHost?: string;
  wsPort?: number;
  wsForceTLS?: boolean;
  wsCluster?: string;
  wsClientId?: string;
  wsAuthUrl?: string;
}

interface ConfigState {
  activeProfileId: string;
  profiles: ProfileState[];
  outputDir: string;
  fallbackPollIntervalMs: number;
}

interface EditForm {
  name: string;
  apiUrl: string;
  apiToken: string;
  wsEnabled: boolean;
  wsClientId: string;
  wsKey: string;
  wsHost: string;
  wsPort: string;
  wsForceTLS: boolean;
  wsCluster: string;
  wsAuthUrl: string;
}

const EMPTY_EDIT_FORM: EditForm = {
  name: '',
  apiUrl: '',
  apiToken: '',
  wsEnabled: true,
  wsClientId: '',
  wsKey: '',
  wsHost: '',
  wsPort: '443',
  wsForceTLS: true,
  wsCluster: 'mt1',
  wsAuthUrl: '',
};

// A deAPI v2 base URL normally ends with /api/v2. We don't hard-block other
// values (a dev machine may legitimately need a custom path), but we surface a
// yellow warning so an accidental typo doesn't silently point at the wrong host.
function getApiUrlWarning(url: string): string | null {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    new URL(trimmed);
  } catch {
    return "This doesn't look like a valid URL.";
  }
  if (!trimmed.endsWith('/api/v2')) {
    return 'URL usually ends with /api/v2 — double-check this is correct.';
  }
  return null;
}

interface ConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigDrawer({ isOpen, onClose }: ConfigDrawerProps) {
  const { balance, refreshBalance, isLoading: isBalanceLoading } = useBalance();
  const { refreshModels } = useModelsContext();
  const { strictValidation, setStrictValidation, showResponseHeaders, setShowResponseHeaders } = useSettings();
  const { reconnect: reconnectSocket } = useJobSocket();
  const [config, setConfig] = useState<ConfigState>({
    activeProfileId: '',
    profiles: [],
    outputDir: '',
    fallbackPollIntervalMs: 10000,
  });
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT_FORM);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileForm, setNewProfileForm] = useState({ name: '', apiUrl: 'https://api.deapi.ai/api/v2', apiToken: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setEditingProfileId(null);
      setIsAddingProfile(false);
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig({
        activeProfileId: data.activeProfileId || '',
        profiles: data.profiles || [],
        outputDir: data.outputDir || '',
        fallbackPollIntervalMs: data.fallbackPollIntervalMs || 10000,
      });
    } catch (err) {
      console.error('[deapi-tester] Failed to load config:', err);
    }
  };

  const switchProfile = async (profileId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActiveProfile', profileId }),
      });
      if (!res.ok) throw new Error('Failed to switch profile');
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
        outputDir: data.outputDir,
      }));
      // Refresh balance and models for new profile, and rebuild the WS connection
      refreshBalance();
      refreshModels();
      reconnectSocket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch profile');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditProfile = (profile: ProfileState) => {
    setEditingProfileId(profile.id);
    setEditForm({
      name: profile.name,
      apiUrl: profile.apiUrl,
      apiToken: '',
      wsEnabled: profile.wsEnabled ?? true,
      wsClientId: profile.wsClientId ?? '',
      wsKey: profile.wsKey ?? '',
      wsHost: profile.wsHost ?? '',
      wsPort: String(profile.wsPort ?? 443),
      wsForceTLS: profile.wsForceTLS ?? true,
      wsCluster: profile.wsCluster ?? 'mt1',
      wsAuthUrl: profile.wsAuthUrl ?? '',
    });
  };

  const saveEditProfile = async () => {
    if (!editingProfileId) return;
    setIsSaving(true);
    setError(null);
    try {
      const updates: Record<string, string | number | boolean> = {
        name: editForm.name,
        apiUrl: editForm.apiUrl,
        wsEnabled: editForm.wsEnabled,
        wsClientId: editForm.wsClientId.trim(),
        wsKey: editForm.wsKey.trim(),
        wsHost: editForm.wsHost.trim(),
        wsPort: Number(editForm.wsPort) || 443,
        wsForceTLS: editForm.wsForceTLS,
        wsCluster: editForm.wsCluster.trim(),
        wsAuthUrl: editForm.wsAuthUrl.trim(),
      };
      if (editForm.apiToken) {
        updates.apiToken = editForm.apiToken;
      }
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateProfile', profileId: editingProfileId, updates }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        activeProfileId: data.config.activeProfileId,
        profiles: data.config.profiles,
        outputDir: data.config.outputDir,
      }));
      const editedActive = editingProfileId === config.activeProfileId;
      setEditingProfileId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      // If editing active profile, refresh balance/models and rebuild the WS connection
      if (editedActive) {
        refreshBalance();
        refreshModels();
        reconnectSocket();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const addNewProfile = async () => {
    if (!newProfileForm.name.trim()) {
      setError('Profile name is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addProfile', profile: newProfileForm }),
      });
      if (!res.ok) throw new Error('Failed to add profile');
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        activeProfileId: data.config.activeProfileId,
        profiles: data.config.profiles,
        outputDir: data.config.outputDir,
      }));
      setIsAddingProfile(false);
      setNewProfileForm({ name: '', apiUrl: 'https://api.deapi.ai/api/v2', apiToken: '' });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add profile');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (config.profiles.length <= 1) {
      setError('Cannot delete the last profile');
      return;
    }
    if (!confirm('Are you sure you want to delete this profile?')) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteProfile', profileId }),
      });
      if (!res.ok) throw new Error('Failed to delete profile');
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
        outputDir: data.outputDir,
      }));
      // If deleted active profile, refresh balance/models and rebuild the WS connection
      if (profileId === config.activeProfileId) {
        refreshBalance();
        refreshModels();
        reconnectSocket();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateProfileAction = async (profileId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicateProfile', profileId }),
      });
      if (!res.ok) throw new Error('Failed to duplicate profile');
      const data = await res.json();
      setConfig((prev) => ({
        ...prev,
        activeProfileId: data.config.activeProfileId,
        profiles: data.config.profiles,
        outputDir: data.config.outputDir,
      }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate profile');
    } finally {
      setIsSaving(false);
    }
  };

  const saveGlobalSettings = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputDir: config.outputDir,
          fallbackPollIntervalMs: config.fallbackPollIntervalMs,
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const activeProfile = config.profiles.find(p => p.id === config.activeProfileId);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 fade-enter"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] bg-[var(--surface)] border-l border-[var(--border)] z-50 drawer-enter flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-emphasis)]">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--surface-2)] rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--text-emphasis)]"
          >
<X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Balance Card */}
          <div className="bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted)] uppercase tracking-wide">Balance</span>
              <button
                onClick={refreshBalance}
                disabled={isBalanceLoading}
                className="text-[var(--muted)] hover:text-[var(--text-primary)] disabled:opacity-50 p-1"
              >
<RefreshCw className={`w-3.5 h-3.5 ${isBalanceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-xl font-mono font-semibold text-green-400 mt-1">
              {balance !== null ? `$${balance}` : '—'}
            </p>
            {activeProfile && (
              <p className="text-xs text-[var(--muted)] mt-1">
                Profile: {activeProfile.name}
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-lg text-sm text-green-400">
              Saved successfully
            </div>
          )}

          {/* Profiles Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--muted)] uppercase tracking-wide">
                API Profiles
              </label>
              <button
                onClick={() => setIsAddingProfile(true)}
                disabled={isAddingProfile}
                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                + Add Profile
              </button>
            </div>

            <div className="space-y-2">
              {config.profiles.map(profile => (
                <div
                  key={profile.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    profile.id === config.activeProfileId
                      ? 'border-blue-500/50 bg-blue-500/5'
                      : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  {editingProfileId === profile.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded px-2 py-1.5 text-sm"
                        placeholder="Profile name"
                      />
                      <input
                        type="text"
                        value={editForm.apiUrl}
                        onChange={e => setEditForm({ ...editForm, apiUrl: e.target.value })}
                        className="w-full rounded px-2 py-1.5 text-sm font-mono"
                        placeholder="API URL"
                      />
                      {getApiUrlWarning(editForm.apiUrl) && (
                        <p className="text-[11px] text-yellow-500 flex items-start gap-1 -mt-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>{getApiUrlWarning(editForm.apiUrl)}</span>
                        </p>
                      )}
                      <input
                        type="password"
                        value={editForm.apiToken}
                        onChange={e => setEditForm({ ...editForm, apiToken: e.target.value })}
                        className="w-full rounded px-2 py-1.5 text-sm font-mono"
                        placeholder={profile.hasToken ? 'Leave empty to keep current' : 'API Token'}
                      />

                      {/* WebSocket (realtime) settings */}
                      <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">
                            WebSocket (realtime)
                          </span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.wsEnabled}
                              onChange={e => setEditForm({ ...editForm, wsEnabled: e.target.checked })}
                              className="w-3.5 h-3.5 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600 cursor-pointer"
                            />
                            <span className="text-[11px] text-[var(--text-secondary)]">Enabled</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={editForm.wsClientId}
                          onChange={e => setEditForm({ ...editForm, wsClientId: e.target.value })}
                          className="w-full rounded px-2 py-1.5 text-sm font-mono"
                          placeholder="Client ID (private-client.{id}, from dashboard)"
                        />
                        <p className="text-[10px] text-[var(--text-faint)] -mt-1">
                          Required to enable WebSocket. Without it the app falls back to polling.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editForm.wsKey}
                            onChange={e => setEditForm({ ...editForm, wsKey: e.target.value })}
                            className="flex-1 rounded px-2 py-1.5 text-xs font-mono"
                            placeholder="App key"
                          />
                          <input
                            type="text"
                            value={editForm.wsCluster}
                            onChange={e => setEditForm({ ...editForm, wsCluster: e.target.value })}
                            className="w-20 rounded px-2 py-1.5 text-xs font-mono"
                            placeholder="cluster"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editForm.wsHost}
                            onChange={e => setEditForm({ ...editForm, wsHost: e.target.value })}
                            className="flex-1 rounded px-2 py-1.5 text-xs font-mono"
                            placeholder="WS host (e.g. soketi.deapi.ai)"
                          />
                          <input
                            type="number"
                            value={editForm.wsPort}
                            onChange={e => setEditForm({ ...editForm, wsPort: e.target.value })}
                            className="w-20 rounded px-2 py-1.5 text-xs font-mono"
                            placeholder="port"
                          />
                          <label className="flex items-center gap-1.5 cursor-pointer px-1">
                            <input
                              type="checkbox"
                              checked={editForm.wsForceTLS}
                              onChange={e => setEditForm({ ...editForm, wsForceTLS: e.target.checked })}
                              className="w-3.5 h-3.5 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600 cursor-pointer"
                            />
                            <span className="text-[11px] text-[var(--text-secondary)]">TLS</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          value={editForm.wsAuthUrl}
                          onChange={e => setEditForm({ ...editForm, wsAuthUrl: e.target.value })}
                          className="w-full rounded px-2 py-1.5 text-xs font-mono"
                          placeholder="Auth URL (blank = derive {origin}/broadcasting/auth)"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={saveEditProfile}
                          disabled={isSaving}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded py-1.5 text-xs font-medium"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingProfileId(null)}
                          className="px-3 py-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)] rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {profile.id === config.activeProfileId && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          <span className="font-medium text-sm">{profile.name}</span>
                          {profile.hasToken ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                              Token set
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                              No token
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {profile.id !== config.activeProfileId && (
                            <button
                              onClick={() => switchProfile(profile.id)}
                              disabled={isSaving}
                              className="text-xs px-2 py-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => duplicateProfileAction(profile.id)}
                            disabled={isSaving}
                            className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-strong)] rounded disabled:opacity-50"
                            title="Duplicate profile (copies token + WebSocket settings)"
                          >
<Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => startEditProfile(profile)}
                            className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-strong)] rounded"
                            title="Edit profile"
                          >
<Pencil className="w-3.5 h-3.5" />
                          </button>
                          {config.profiles.length > 1 && (
                            <button
                              onClick={() => deleteProfile(profile.id)}
                              className="p-1 text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 rounded"
                            >
<Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1 font-mono truncate">
                        {profile.apiUrl}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Add new profile form */}
              {isAddingProfile && (
                <div className="rounded-lg border border-dashed border-blue-500/50 bg-blue-500/5 p-3 space-y-2">
                  <input
                    type="text"
                    value={newProfileForm.name}
                    onChange={e => setNewProfileForm({ ...newProfileForm, name: e.target.value })}
                    className="w-full rounded px-2 py-1.5 text-sm"
                    placeholder="Profile name (e.g. Production)"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newProfileForm.apiUrl}
                    onChange={e => setNewProfileForm({ ...newProfileForm, apiUrl: e.target.value })}
                    className="w-full rounded px-2 py-1.5 text-sm font-mono"
                    placeholder="API URL"
                  />
                  {getApiUrlWarning(newProfileForm.apiUrl) && (
                    <p className="text-[11px] text-yellow-500 flex items-start gap-1 -mt-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{getApiUrlWarning(newProfileForm.apiUrl)}</span>
                    </p>
                  )}
                  <input
                    type="password"
                    value={newProfileForm.apiToken}
                    onChange={e => setNewProfileForm({ ...newProfileForm, apiToken: e.target.value })}
                    className="w-full rounded px-2 py-1.5 text-sm font-mono"
                    placeholder="API Token"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addNewProfile}
                      disabled={isSaving}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded py-1.5 text-xs font-medium"
                    >
                      {isSaving ? 'Adding...' : 'Add Profile'}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingProfile(false);
                        setNewProfileForm({ name: '', apiUrl: 'https://api.deapi.ai/api/v2', apiToken: '' });
                      }}
                      className="px-3 py-1.5 bg-[var(--border-strong)] hover:bg-[var(--muted)] rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Global Settings */}
          <div className="border-t border-[var(--border)] pt-4">
            <label className="block text-xs text-[var(--muted)] mb-2 uppercase tracking-wide">
              Global Settings
            </label>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">
                  Output Directory
                </label>
                <input
                  type="text"
                  value={config.outputDir}
                  onChange={e => setConfig({ ...config, outputDir: e.target.value })}
                  className="w-full rounded px-3 py-2 text-sm font-mono"
                  placeholder="./output"
                />
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                  Where downloaded results will be saved
                </p>
              </div>

              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">
                  Fallback poll interval (seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  value={Math.round(config.fallbackPollIntervalMs / 1000)}
                  onChange={e =>
                    setConfig({
                      ...config,
                      fallbackPollIntervalMs: Math.max(1, Number(e.target.value) || 1) * 1000,
                    })
                  }
                  className="w-full rounded px-3 py-2 text-sm font-mono"
                  placeholder="10"
                />
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                  How often to poll job status as a fallback. WebSocket is the primary source;
                  this poll also catches failures (delivered via webhooks, never over WS).
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={strictValidation}
                    onChange={e => setStrictValidation(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Strict form validation</span>
                </label>
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                  When on, enforces model min/max limits on numeric fields and file type restrictions.
                  Turn off to send any value to the API for debugging.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResponseHeaders}
                    onChange={e => setShowResponseHeaders(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Show response headers</span>
                </label>
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                  When on, the response HTTP headers from deAPI are shown in each job&apos;s Raw panel.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={saveGlobalSettings}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded py-2 text-sm font-medium transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Global Settings'}
          </button>
        </div>
      </div>
    </>
  );
}
