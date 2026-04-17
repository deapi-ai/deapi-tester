'use client';

import { useState, useRef, DragEvent } from 'react';
import { Upload, X, FolderOpen } from 'lucide-react';
import { formatFileSize } from '@/lib/format-utils';
import { OutputPicker } from './OutputPicker';
import { useSettings } from '../SettingsContext';

interface ImagePreview {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

interface FileUploadFieldProps {
  name: string;
  label: string;
  required?: boolean;
  accept?: string;
  multiFieldName?: string;
  files: File | File[] | undefined;
  isMultiMode: boolean;
  previews: ImagePreview[];
  onFileChange: (name: string, file: File | File[] | null) => void;
  onRemoveFile: (name: string, index: number) => void;
  onModeChange: (name: string, isMulti: boolean) => void;
}

export function FileUploadField({
  name,
  label,
  required,
  accept,
  multiFieldName,
  files,
  isMultiMode,
  previews,
  onFileChange,
  onRemoveFile,
  onModeChange,
}: FileUploadFieldProps) {
  const { strictValidation } = useSettings();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const isImageAccept = accept?.includes('image/') ?? false;

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    if (isMultiMode) {
      onFileChange(name, Array.from(droppedFiles));
    } else {
      onFileChange(name, droppedFiles[0]);
    }
  };

  const fileArray = files ? (Array.isArray(files) ? files : [files]) : [];
  const fileCount = fileArray.length;
  const fileLabel =
    fileCount === 0
      ? isMultiMode
        ? 'Choose file(s)...'
        : 'Choose file...'
      : fileCount === 1
        ? fileArray[0].name
        : `${fileCount} files selected`;

  return (
    <div className="flex flex-col gap-2">
      {/* Mode switch for fields with multiFieldName */}
      {multiFieldName && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onModeChange(name, false);
              onFileChange(name, null);
            }}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              !isMultiMode
                ? 'bg-blue-600 text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
            }`}
          >
            Single ({name})
          </button>
          <button
            type="button"
            onClick={() => {
              onModeChange(name, true);
              onFileChange(name, null);
            }}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              isMultiMode
                ? 'bg-blue-600 text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
            }`}
          >
            Multiple ({multiFieldName})
          </button>
        </div>
      )}

      {/* Image previews */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((preview, idx) => (
            <div key={idx} className="relative group">
              {/* Delete button */}
              <button
                type="button"
                onClick={() => onRemoveFile(name, idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Remove"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt=""
                className="h-20 w-auto rounded border border-[var(--border)] object-contain bg-[var(--surface)]"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[9px] font-mono text-[var(--text-primary)] rounded-b">
                {preview.format} · {preview.width}×{preview.height} · {formatFileSize(preview.size)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative rounded border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-transparent'
        }`}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center z-10 rounded pointer-events-none">
            <span className="text-xs font-medium text-blue-400">Drop {isMultiMode ? 'file(s)' : 'file'} here</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${isDragging ? 'opacity-30' : ''}`}>
          <label className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--border-strong)] transition-colors flex-1 min-w-0">
            <Upload className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
            <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{fileLabel}</span>
            {isMultiMode && fileCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                {fileCount}
              </span>
            )}
            <input
              type="file"
              accept={strictValidation ? accept : undefined}
              multiple={isMultiMode}
              onChange={(e) => {
                const selectedFiles = e.target.files;
                if (!selectedFiles || selectedFiles.length === 0) {
                  onFileChange(name, null);
                } else if (isMultiMode) {
                  onFileChange(name, Array.from(selectedFiles));
                } else {
                  onFileChange(name, selectedFiles[0]);
                }
              }}
              className="hidden"
            />
          </label>

          {fileCount > 0 && !isImageAccept && (
            <button
              type="button"
              onClick={() => onFileChange(name, null)}
              className="flex items-center justify-center w-8 h-8 bg-[var(--surface-2)] border border-[var(--border)] rounded hover:border-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="Remove file"
            >
              <X className="w-3.5 h-3.5 text-[var(--muted)]" />
            </button>
          )}

          {isImageAccept && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center justify-center w-8 h-8 bg-[var(--surface-2)] border border-[var(--border)] rounded hover:border-[var(--border-strong)] hover:bg-[var(--hover)] transition-colors flex-shrink-0"
              title="Pick from output"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[var(--muted)]" />
            </button>
          )}
        </div>
      </div>

      {isImageAccept && (
        <OutputPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(file) => onFileChange(name, file)}
        />
      )}
    </div>
  );
}
