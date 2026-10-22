'use client';

import { useState, useRef, DragEvent } from 'react';
import { Upload, X, FolderOpen, Plus } from 'lucide-react';
import { AssetPicker } from './AssetPicker';
import { FilePickList } from './FilePickList';
import { FilePreview } from '@/lib/form-utils';
import { mediaKindFromAccept } from '@/lib/media-types';
import { useSettings } from '../SettingsContext';

/** How new files join the ones already in the field. */
export type AddMode = 'append' | 'replace';

interface FileUploadFieldProps {
  name: string;
  label: string;
  required?: boolean;
  accept?: string;
  multiFieldName?: string;
  multiOnly?: boolean;
  /** How many files the selected model accepts here, from /models. */
  maxFiles?: number;
  files: File | File[] | undefined;
  isMultiMode: boolean;
  previews: FilePreview[];
  onFileChange: (name: string, files: File[] | null, mode: AddMode) => void;
  onRemoveFile: (name: string, index: number) => void;
  onReorderFiles: (name: string, from: number, to: number) => void;
  onModeChange: (name: string, isMulti: boolean) => void;
}

export function FileUploadField({
  name,
  label,
  accept,
  multiFieldName,
  multiOnly,
  maxFiles,
  files,
  isMultiMode,
  previews,
  onFileChange,
  onRemoveFile,
  onReorderFiles,
  onModeChange,
}: FileUploadFieldProps) {
  const { strictValidation } = useSettings();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const mediaKind = mediaKindFromAccept(accept);

  // A multi-file field adds to its list; a single-file field swaps its one file.
  // Every entry point — the file dialog, the drop zone and the library — uses
  // this same rule, so what a field does with new files is never a surprise.
  const addMode: AddMode = isMultiMode ? 'append' : 'replace';

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

    const list = Array.from(droppedFiles);
    onFileChange(name, isMultiMode ? list : [list[0]], addMode);
  };

  const fileCount = files ? (Array.isArray(files) ? files.length : 1) : 0;
  const hasFiles = fileCount > 0;
  // The model's own cap, so the count reads as "2 / 3" and going over is caught
  // here rather than by a 422 after the upload.
  const overLimit = maxFiles !== undefined && fileCount > maxFiles;

  const chooseLabel = isMultiMode
    ? hasFiles
      ? 'Add more files...'
      : 'Choose file(s)...'
    : hasFiles
      ? 'Replace file...'
      : 'Choose file...';

  return (
    <div className="flex flex-col gap-1.5">
      {/* Mode switch for fields with multiFieldName. Hidden when the field is array-only:
          the API has no single-file spelling of it, so "Single" would just build a 422. */}
      {multiFieldName && !multiOnly && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onModeChange(name, false);
              onFileChange(name, null, 'replace');
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
              onFileChange(name, null, 'replace');
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

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative flex flex-col gap-1.5 rounded transition-colors ${
          isDragging ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
        }`}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center z-20 rounded bg-[var(--background)]/80 pointer-events-none">
            <span className="text-xs font-medium text-blue-400">
              {isMultiMode ? 'Drop to add file(s)' : 'Drop to replace file'}
            </span>
          </div>
        )}

        <FilePickList
          previews={previews}
          ordered={isMultiMode}
          onRemove={(index) => onRemoveFile(name, index)}
          onReorder={(from, to) => onReorderFiles(name, from, to)}
        />

        <div className="flex items-center gap-1">
          <label className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--border-strong)] transition-colors flex-1 min-w-0">
            {isMultiMode && hasFiles ? (
              <Plus className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
            ) : (
              <Upload className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
            )}
            <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{chooseLabel}</span>
            {isMultiMode && hasFiles && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                  overLimit ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {fileCount}
                {maxFiles !== undefined && ` / ${maxFiles}`}
              </span>
            )}
            <input
              type="file"
              accept={strictValidation ? accept : undefined}
              multiple={isMultiMode}
              onChange={(e) => {
                const selectedFiles = e.target.files;
                if (!selectedFiles || selectedFiles.length === 0) return;
                onFileChange(name, Array.from(selectedFiles), addMode);
                // Let the same file be chosen again after it was removed.
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>

          {mediaKind !== 'other' && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center justify-center w-8 h-8 bg-[var(--surface-2)] border border-[var(--border)] rounded hover:border-[var(--border-strong)] hover:bg-[var(--hover)] transition-colors flex-shrink-0"
              title={isMultiMode ? 'Add from saved results' : 'Pick from saved results'}
            >
              <FolderOpen className="w-3.5 h-3.5 text-[var(--muted)]" />
            </button>
          )}

          {hasFiles && (
            <button
              type="button"
              onClick={() => onFileChange(name, null, 'replace')}
              className="flex items-center justify-center w-8 h-8 bg-[var(--surface-2)] border border-[var(--border)] rounded hover:border-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
              title={isMultiMode ? 'Remove all files' : 'Remove file'}
            >
              <X className="w-3.5 h-3.5 text-[var(--muted)]" />
            </button>
          )}
        </div>
      </div>

      {overLimit && (
        <span className="text-[10px] text-red-400">
          {maxFiles === 0
            ? 'This model takes no files here.'
            : `This model takes at most ${maxFiles} file${maxFiles === 1 ? '' : 's'} here — remove ${fileCount - (maxFiles ?? 0)}.`}
        </span>
      )}

      {mediaKind !== 'other' && (
        <AssetPicker
          open={pickerOpen}
          kind={mediaKind}
          fieldLabel={label}
          mode={addMode}
          onClose={() => setPickerOpen(false)}
          onPick={(picked) => onFileChange(name, picked, addMode)}
        />
      )}
    </div>
  );
}
