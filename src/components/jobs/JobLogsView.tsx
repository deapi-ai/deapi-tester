'use client';

import { useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { JsonValue } from '@/lib/types';

interface LogEntry {
  timestamp: number;
  attempt: number;
  maxAttempts: number;
  status: string;
  data: JsonValue;
  jobId: string;
  endpointId: string;
}

interface JobLogsViewProps {
  logs: LogEntry[];
  autoScroll: boolean;
  onAutoScrollChange: (autoScroll: boolean) => void;
}

export function JobLogsView({ logs, autoScroll, onAutoScrollChange }: JobLogsViewProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Log controls */}
      <div className="flex items-center justify-between px-4 py-1 border-b border-[var(--border-dim)] bg-[var(--surface-2)] flex-shrink-0">
        <span className="text-[10px] text-zinc-500">{logs.length} events</span>
        <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => onAutoScrollChange(e.target.checked)}
            className="w-3 h-3"
          />
          Auto-scroll
        </label>
      </div>

      {/* Log stream */}
      <div ref={logContainerRef} className="flex-1 overflow-y-auto font-mono text-[11px]">
        {logs.length === 0 ? (
          <div className="p-8 text-xs text-zinc-600 text-center">No polling events yet</div>
        ) : (
          logs.map((log, idx) => (
            <details key={idx} className="group border-b border-[var(--border-dim)]">
              <summary className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-zinc-800/30 log-line">
                <ChevronRight className="w-2 h-2 text-zinc-600 transition-transform group-open:rotate-90 flex-shrink-0" />
                <span className="text-zinc-600 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <span
                  className={`shrink-0 ${
                    log.status === 'done'
                      ? 'text-green-500'
                      : log.status === 'error'
                        ? 'text-red-500'
                        : log.status === 'processing'
                          ? 'text-blue-400'
                          : 'text-yellow-500'
                  }`}
                >
                  [{log.status}]
                </span>
                <span className="text-zinc-500 shrink-0">{log.endpointId}</span>
                <span className="text-zinc-600 shrink-0">#{log.attempt}</span>
              </summary>
              <div className="px-4 pb-2">
                <pre className="text-[10px] font-mono text-zinc-500 bg-zinc-900 rounded p-2 overflow-x-auto max-h-48">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
