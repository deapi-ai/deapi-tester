'use client';

import { useState, DragEvent } from 'react';
import { X, Music, GripVertical } from 'lucide-react';
import { formatFileSize, formatDuration } from '@/lib/format-utils';
import { FilePreview } from '@/lib/form-utils';

interface FilePickListProps {
  /** Previews 1:1 with the field's files, in the order they will be sent. */
  previews: FilePreview[];
  /**
   * Whether position carries meaning. Ordered lists get a 1-based badge and can
   * be dragged into a different order — for reference inputs the index is what
   * the prompt's <Picture N> / <Video N> / <Audio N> tags bind against.
   */
  ordered: boolean;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}

/**
 * The files currently held by a file field, as draggable tiles.
 *
 * Rendering them at all is the point: a multi-file field used to collapse to
 * "3 files selected", which said nothing about which files or in what order.
 */
export function FilePickList({ previews, ordered, onRemove, onReorder }: FilePickListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (previews.length === 0) return null;

  const handleDragStart = (index: number) => (e: DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox ignores a drag that carries no payload.
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (index: number) => (e: DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  };

  const handleDrop = (index: number) => (e: DragEvent) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex !== index) onReorder(dragIndex, index);
    setDragIndex(null);
    setOverIndex(null);
  };

  const reset = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {previews.map((preview, idx) => {
        const isDragged = dragIndex === idx;
        const isTarget = overIndex === idx && dragIndex !== null && dragIndex !== idx;
        return (
          <div
            key={`${preview.url}-${idx}`}
            draggable={ordered}
            onDragStart={ordered ? handleDragStart(idx) : undefined}
            onDragOver={ordered ? handleDragOver(idx) : undefined}
            onDrop={ordered ? handleDrop(idx) : undefined}
            onDragEnd={reset}
            title={tileTooltip(preview, ordered)}
            className={`group relative w-[74px] rounded border bg-[var(--surface-2)] overflow-hidden transition-all ${
              ordered ? 'cursor-grab active:cursor-grabbing' : ''
            } ${isDragged ? 'opacity-40' : ''} ${
              isTarget ? 'border-blue-500 ring-1 ring-blue-500' : 'border-[var(--border)]'
            }`}
          >
            {ordered && (
              <span className="absolute top-0.5 left-0.5 z-10 w-4 h-4 rounded bg-black/75 text-white text-[9px] font-medium flex items-center justify-center">
                {idx + 1}
              </span>
            )}

            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute top-0.5 right-0.5 z-10 w-4 h-4 bg-red-600 hover:bg-red-500 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>

            <Thumb preview={preview} />

            <div className="px-1 py-0.5">
              <div className="text-[8px] text-[var(--text-secondary)] truncate leading-tight">
                {preview.name}
              </div>
              <div className="text-[8px] font-mono text-[var(--text-faint)] truncate leading-tight">
                {tileMeta(preview)}
              </div>
            </div>

            {ordered && (
              <GripVertical className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-[var(--text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Square preview area: the frame itself for image/video, an icon for audio. */
function Thumb({ preview }: { preview: FilePreview }) {
  if (preview.kind === 'image') {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={preview.url}
        alt=""
        draggable={false}
        className="w-full h-[52px] object-cover bg-[var(--surface-inset)]"
      />
    );
  }

  if (preview.kind === 'video') {
    return (
      <video
        src={`${preview.url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => {
          e.currentTarget.pause();
          e.currentTarget.currentTime = 0.1;
        }}
        className="w-full h-[52px] object-cover bg-[var(--surface-inset)]"
      />
    );
  }

  return (
    <div className="w-full h-[52px] flex items-center justify-center bg-[var(--surface-inset)]">
      <Music className="w-4 h-4 text-[var(--muted)]" />
    </div>
  );
}

/**
 * The one line of metadata a 74px tile has room for — whichever facts identify
 * the file at a glance for its kind. Everything else lives in the tooltip.
 */
function tileMeta(preview: FilePreview): string {
  const dimensions = preview.width && preview.height ? `${preview.width}×${preview.height}` : null;
  const duration = preview.duration !== undefined ? formatDuration(preview.duration) : null;

  if (preview.kind === 'image') return dimensions ?? preview.format;
  if (preview.kind === 'video') return [duration, dimensions].filter(Boolean).join(' · ') || preview.format;
  return [duration, preview.format].filter(Boolean).join(' · ');
}

function tileTooltip(preview: FilePreview, ordered: boolean): string {
  const parts = [preview.name, tileMeta(preview), formatFileSize(preview.size)];
  if (ordered) parts.push('drag to reorder');
  return parts.join(' — ');
}
