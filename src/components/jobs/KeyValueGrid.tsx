'use client';

import { JsonValue } from '@/lib/types';

interface KeyValueGridProps {
  entries: Record<string, JsonValue | undefined>;
}

// Rendered generically: which fields a source platform (metadata) or a worker
// (description meta) reports varies, and deAPI can grow either block without a
// change here. Nested values are shown as compact JSON.
export function KeyValueGrid({ entries }: KeyValueGridProps) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 bg-[var(--surface)] rounded p-2">
      {Object.entries(entries).map(([key, value]) => (
        <div key={key} className="contents">
          <span className="text-[9px] font-mono text-[var(--text-faint)]">{key}</span>
          <span className="text-[10px] text-[var(--text-secondary)] break-words">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
