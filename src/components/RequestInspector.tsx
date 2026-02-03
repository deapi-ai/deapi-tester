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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <span>🔍</span> Request Inspector
        </span>
        <span className="text-xs text-zinc-500">{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-800">
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('request')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'request'
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Request
            </button>
            <button
              onClick={() => setActiveTab('response')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'response'
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Response
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'request' && rawRequest && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {rawRequest.method} {rawRequest.url}
                  </span>
                  <button
                    onClick={() => copyToClipboard(rawRequest)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-zinc-950 rounded p-3 text-xs font-mono text-zinc-400 overflow-x-auto max-h-64 overflow-y-auto">
                  {formatJson(rawRequest)}
                </pre>
              </div>
            )}

            {activeTab === 'response' && rawResponse !== null && rawResponse !== undefined && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Response</span>
                  <button
                    onClick={() => copyToClipboard(rawResponse)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Copy
                  </button>
                </div>
                <pre className="bg-zinc-950 rounded p-3 text-xs font-mono text-zinc-400 overflow-x-auto max-h-64 overflow-y-auto">
                  {formatJson(rawResponse)}
                </pre>
              </div>
            )}

            {activeTab === 'request' && !rawRequest && (
              <p className="text-sm text-zinc-500 italic">No request data</p>
            )}

            {activeTab === 'response' && !rawResponse && (
              <p className="text-sm text-zinc-500 italic">No response data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
