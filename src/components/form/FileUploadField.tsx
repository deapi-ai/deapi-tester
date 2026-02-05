'use client';

import { Upload, X } from 'lucide-react';
import { formatFileSize } from '@/lib/format-utils';

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
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
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
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
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
                className="h-20 w-auto rounded border border-[var(--border)] object-contain bg-zinc-900"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[9px] font-mono text-zinc-300 rounded-b">
                {preview.format} · {preview.width}×{preview.height} · {formatFileSize(preview.size)}
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded cursor-pointer hover:border-zinc-600 transition-colors">
        <Upload className="w-3 h-3 text-zinc-500 flex-shrink-0" />
        <span className="text-xs text-zinc-400 truncate flex-1">{fileLabel}</span>
        {isMultiMode && fileCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
            {fileCount}
          </span>
        )}
        <input
          type="file"
          accept={accept}
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
    </div>
  );
}
