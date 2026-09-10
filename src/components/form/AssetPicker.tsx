'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, FolderOpen, Music, Check, RefreshCw } from 'lucide-react';
import { formatFileSize } from '@/lib/format-utils';
import { MediaKind, MEDIA_KIND_LABELS } from '@/lib/media-types';

interface AssetFile {
  name: string;
  size: number;
  modified: number;
  kind: MediaKind;
  url: string;
}

interface AssetPickerProps {
  open: boolean;
  /** Which media the field takes — the library lists only this kind. */
  kind: MediaKind;
  /** Field this picker fills, named in the header so the target is never in doubt. */
  fieldLabel: string;
  /**
   * 'append' — the picked files are added after the ones already in the field,
   * so several can be selected at once and the order of selection is kept.
   * 'replace' — the field holds one file, so picking one swaps it.
   */
  mode: 'append' | 'replace';
  onClose: () => void;
  onPick: (files: File[]) => void;
}

/**
 * Library of saved results (the output directory) to pull inputs from.
 *
 * The header says what picking will do — add to the list or replace what is
 * there — because for an ordered multi-file field those are very different
 * outcomes and the old picker silently did the destructive one.
 */
export function AssetPicker({ open, kind, fieldLabel, mode, onClose, onPick }: AssetPickerProps) {
  const [files, setFiles] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = kind === 'other' ? '' : `?kind=${kind}`;
      const res = await fetch(`/api/files${query}`);
      if (!res.ok) throw new Error('Failed to load files');
      const data: AssetFile[] = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setError(null);
      fetchFiles();
    }
  }, [open, fetchFiles]);

  // Download the chosen library entries and hand them over as real Files.
  const deliver = async (names: string[]) => {
    if (names.length === 0) return;
    setFetching(true);
    try {
      const picked: File[] = [];
      for (const name of names) {
        const entry = files.find((f) => f.name === name);
        if (!entry) continue;
        const res = await fetch(entry.url);
        if (!res.ok) throw new Error(`Failed to load ${name}`);
        const blob = await res.blob();
        picked.push(new File([blob], entry.name, { type: blob.type }));
      }
      if (picked.length === 0) throw new Error('Nothing to add');
      onPick(picked);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load selected files');
    } finally {
      setFetching(false);
    }
  };

  const toggle = (name: string) => {
    if (mode === 'replace') {
      deliver([name]);
      return;
    }
    // Selection order is the order the files are appended in.
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  if (!open) return null;

  const kindLabel = MEDIA_KIND_LABELS[kind].toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl w-[620px] max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — states the action, not just the source */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--text-emphasis)]">
              {mode === 'append' ? 'Add to' : 'Replace'} {fieldLabel}
            </span>
            <span className="text-[10px] text-[var(--muted)]">
              {mode === 'append'
                ? `Saved ${kindLabel} from the output folder — picked files are appended in the order you select them`
                : `Saved ${kindLabel} from the output folder — picking one replaces the current file`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchFiles}
              className="p-1.5 hover:bg-[var(--hover)] rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-[var(--hover)] rounded transition-colors"
            >
              <X className="w-4 h-4 text-[var(--muted)]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12 text-[var(--muted)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Loading files...</span>
            </div>
          )}

          {error && <div className="text-center py-3 text-red-400 text-sm">{error}</div>}

          {!loading && !error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)]">
              <FolderOpen className="w-8 h-8 mb-2" />
              <span className="text-sm">No saved {kindLabel} yet</span>
              <span className="text-xs text-[var(--text-faint)] mt-1">
                Run a job and download the result — it lands in the output folder and shows up here
              </span>
            </div>
          )}

          {!loading && files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file) => {
                const order = selected.indexOf(file.name);
                const isSelected = order >= 0;
                return (
                  <button
                    key={file.name}
                    type="button"
                    disabled={fetching}
                    onClick={() => toggle(file.name)}
                    className={`group relative flex flex-col bg-[var(--surface-2)] rounded border transition-colors overflow-hidden disabled:opacity-50 ${
                      isSelected ? 'border-blue-500' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1 left-1 z-10 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center">
                        {mode === 'append' ? order + 1 : <Check className="w-3 h-3" />}
                      </span>
                    )}
                    <AssetThumb file={file} />
                    <div className="px-1.5 py-1 text-left w-full">
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">{file.name}</div>
                      <div className="text-[9px] text-[var(--text-faint)]">
                        {formatDate(file.modified)} · {formatFileSize(file.size)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — only multi-select needs a commit step */}
        {mode === 'append' && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--muted)]">
              {selected.length === 0 ? 'Select one or more files' : `${selected.length} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs bg-[var(--border-strong)] hover:bg-[var(--muted)] rounded text-[var(--text-emphasis)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selected.length === 0 || fetching}
                onClick={() => deliver(selected)}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed rounded text-white flex items-center gap-1.5 transition-colors"
              >
                {fetching && <Loader2 className="w-3 h-3 animate-spin" />}
                Add {selected.length > 0 ? selected.length : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tile body: a real frame for image/video, a labelled placeholder for audio. */
function AssetThumb({ file }: { file: AssetFile }) {
  if (file.kind === 'image') {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={file.url}
        alt={file.name}
        loading="lazy"
        className="w-full aspect-square object-cover bg-[var(--surface-inset)]"
      />
    );
  }

  if (file.kind === 'video') {
    return (
      <video
        // The fragment nudges the browser past frame 0 so a poster frame decodes.
        src={`${file.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => {
          e.currentTarget.pause();
          e.currentTarget.currentTime = 0.1;
        }}
        className="w-full aspect-square object-cover bg-[var(--surface-inset)]"
      />
    );
  }

  return (
    <div className="w-full aspect-square flex items-center justify-center bg-[var(--surface-inset)]">
      <Music className="w-7 h-7 text-[var(--muted)]" />
    </div>
  );
}
