'use client';

import { useState } from 'react';
import { JsonValue } from '@/lib/types';

interface RequestInspectorProps {
  rawRequest: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: JsonValue;
  } | null;
  rawResponse: JsonValue | null;
}

export function RequestInspector({ rawRequest, rawResponse }: RequestInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

  if (!rawRequest && !rawResponse) {
    return null;
  }

  const copyToClipboard = (data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const formatJson = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--hover)] transition-colors"
      >
        <span className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
          <span>🔍</span> Request Inspector
        </span>
        <span className="text-xs text-[var(--muted)]">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-[var(--border)]">
          <div className="flex border-b border-[var(--border)]">
            <button
              onClick={() => setActiveTab('request')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'request'
                  ? 'bg-[var(--surface-2)] text-[var(--text-emphasis)]'
                  : 'text-[var(--muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Request
            </button>
            <button
              onClick={() => setActiveTab('response')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'response'
                  ? 'bg-[var(--surface-2)] text-[var(--text-emphasis)]'
                  : 'text-[var(--muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Response
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'request' && rawRequest && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">
                    {rawRequest.method} {rawRequest.url}
                  </span>
                  <button
                    onClick={() => copyToClipboard(rawRequest)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--text-primary)]"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-[var(--surface-inset)] rounded p-3 text-xs font-mono text-[var(--text-secondary)] overflow-x-auto max-h-64 overflow-y-auto">
                  {formatJson(rawRequest)}
                </pre>
              </div>
            )}

            {activeTab === 'response' && rawResponse !== null && rawResponse !== undefined && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Response</span>
                  <button
                    onClick={() => copyToClipboard(rawResponse)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--text-primary)]"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-[var(--surface-inset)] rounded p-3 text-xs font-mono text-[var(--text-secondary)] overflow-x-auto max-h-64 overflow-y-auto">
                  {formatJson(rawResponse)}
                </pre>
              </div>
            )}

            {activeTab === 'request' && !rawRequest && (
              <p className="text-sm text-[var(--muted)] italic">No request data</p>
            )}

            {activeTab === 'response' && !rawResponse && (
              <p className="text-sm text-[var(--muted)] italic">No response data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
