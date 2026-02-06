'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, ImageOff } from 'lucide-react';
import { formatFileSize } from '@/lib/format-utils';

interface OutputFile {
  name: string;
  size: number;
  modified: number;
  url: string;
}

interface OutputPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (file: File) => void;
}

export function OutputPicker({ open, onClose, onPick }: OutputPickerProps) {
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('Failed to load files');
      const data: OutputFile[] = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFiles();
    }
  }, [open, fetchFiles]);

  const handlePick = async (file: OutputFile) => {
    setPicking(file.name);
    try {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error('Failed to fetch file');
      const blob = await res.blob();
      const picked = new File([blob], file.name, { type: blob.type });
      onPick(picked);
      onClose();
    } catch {
      setError('Failed to load selected file');
    } finally {
      setPicking(null);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-[560px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <span className="text-sm font-medium text-zinc-200">Pick from output</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-zinc-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Loading files...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <ImageOff className="w-8 h-8 mb-2" />
              <span className="text-sm">No downloaded images yet</span>
              <span className="text-xs text-zinc-600 mt-1">Run a generation and download the result first</span>
            </div>
          )}

          {!loading && files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  disabled={picking !== null}
                  onClick={() => handlePick(file)}
                  className="group relative flex flex-col bg-zinc-800 rounded border border-zinc-700 hover:border-blue-500 transition-colors overflow-hidden disabled:opacity-50"
                >
                  {picking === file.name && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.name}
                    loading="lazy"
                    className="w-full aspect-square object-cover bg-zinc-900"
                  />
                  <div className="px-1.5 py-1 text-left">
                    <div className="text-[10px] text-zinc-300 truncate">{file.name}</div>
                    <div className="text-[9px] text-zinc-500">
                      {formatDate(file.modified)} · {formatFileSize(file.size)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
