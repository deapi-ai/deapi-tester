'use client';

import { useEffect, useRef, useState } from 'react';
import { Minimize2 } from 'lucide-react';

interface PromptTextareaProps {
  value: string;
  placeholder?: string;
  /** localStorage key the dragged height is remembered under. */
  storageKey: string;
  onChange: (value: string) => void;
}

// Smallest height the field can be dragged down to.
const MIN_HEIGHT = 90;
// How close to the bottom-right corner a pointerdown counts as grabbing the
// browser's native resize grip.
const GRIP_SIZE = 20;

/**
 * Prompt input that the user can drag taller and that remembers the height.
 *
 * Until it is dragged the field fills the column (flex-1), so it grows with the
 * form panel. Grabbing the resize corner pins the current height first —
 * flex-grow would otherwise win over the height the browser's native resize
 * sets, and the drag would do nothing — and the height the drag ends on is
 * remembered per field. The reset control hands the field back to the layout.
 */
export function PromptTextarea({ value, placeholder, storageKey, onChange }: PromptTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  // Restore the remembered height for this field.
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey));
    setHeight(Number.isFinite(stored) && stored >= MIN_HEIGHT ? stored : null);
  }, [storageKey]);

  const remember = (px: number) => {
    const next = Math.max(MIN_HEIGHT, Math.round(px));
    setHeight(next);
    localStorage.setItem(storageKey, String(next));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLTextAreaElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const onGrip = e.clientX > rect.right - GRIP_SIZE && e.clientY > rect.bottom - GRIP_SIZE;
    if (!onGrip) return;

    // Take the field out of the flex layout at exactly its current size, so the
    // drag continues from where it looks like it starts.
    if (height === null) remember(rect.height);

    // The browser drives the resize itself; record where it ended up.
    const persist = () => {
      window.removeEventListener('pointerup', persist);
      if (ref.current) remember(ref.current.getBoundingClientRect().height);
    };
    window.addEventListener('pointerup', persist);
  };

  const resetHeight = () => {
    if (ref.current) ref.current.style.height = '';
    setHeight(null);
    localStorage.removeItem(storageKey);
  };

  return (
    <div
      className={`group relative flex flex-col min-h-0 ${
        height === null ? 'flex-1' : 'flex-shrink-0'
      }`}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={handlePointerDown}
        placeholder={placeholder}
        style={height === null ? undefined : { height }}
        className={`w-full rounded px-2 py-1.5 text-sm resize-y min-h-[90px] ${
          height === null ? 'flex-1' : ''
        }`}
      />
      {height !== null && (
        <button
          type="button"
          onClick={resetHeight}
          title="Reset height (fill the panel again)"
          className="absolute top-1 right-1 p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-all"
        >
          <Minimize2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
