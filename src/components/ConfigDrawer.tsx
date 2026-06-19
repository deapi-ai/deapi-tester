'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { useBalance } from './BalanceContext';
import { useModelsContext } from './ModelsContext';
import { useSettings } from './SettingsContext';

interface ProfileState {
  id: string;
  name: string;
  apiUrl: string;
  apiToken: string;
  hasToken: boolean;
}

interface ConfigState {
  activeProfileId: string;
  profiles: ProfileState[];
  outputDir: string;
}

interface ConfigDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigDrawer({ isOpen, onClose }: ConfigDrawerProps) {
  const { balance, refreshBalance, isLoading: isBalanceLoading } = useBalance();
  const { refreshModels } = useModelsContext();
  const { strictValidation, setStrictValidation } = useSettings();
  const [config, setConfig] = useState<ConfigState>({
    activeProfileId: '',
    profiles: [],
    outputDir: '',
  });
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', apiUrl: '', apiToken: '' });
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
      setConfig({
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
        outputDir: data.outputDir,
      });
      // Refresh balance and models for new profile
      refreshBalance();
      refreshModels();
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
    });
  };

  const saveEditProfile = async () => {
    if (!editingProfileId) return;
    setIsSaving(true);
    setError(null);
    try {
      const updates: Record<string, string> = {
        name: editForm.name,
        apiUrl: editForm.apiUrl,
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
      setConfig({
        activeProfileId: data.config.activeProfileId,
        profiles: data.config.profiles,
        outputDir: data.config.outputDir,
      });
      setEditingProfileId(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      // If editing active profile, refresh balance and models
      if (editingProfileId === config.activeProfileId) {
        refreshBalance();
        refreshModels();
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
      setConfig({
        activeProfileId: data.config.activeProfileId,
        profiles: data.config.profiles,
        outputDir: data.config.outputDir,
      });
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
      setConfig({
        activeProfileId: data.activeProfileId,
        profiles: data.profiles,
        outputDir: data.outputDir,
      });
      // If deleted active profile, refresh balance and models for new active
      if (profileId === config.activeProfileId) {
        refreshBalance();
        refreshModels();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
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
        body: JSON.stringify({ outputDir: config.outputDir }),
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
                      <input
                        type="password"
                        value={editForm.apiToken}
                        onChange={e => setEditForm({ ...editForm, apiToken: e.target.value })}
                        className="w-full rounded px-2 py-1.5 text-sm font-mono"
                        placeholder={profile.hasToken ? 'Leave empty to keep current' : 'API Token'}
                      />
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
                            onClick={() => startEditProfile(profile)}
                            className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-strong)] rounded"
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
