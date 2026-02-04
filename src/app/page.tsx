'use client';

import { useState, useCallback, useRef } from 'react';
import { ConfigDrawer } from '@/components/ConfigDrawer';
import { EndpointSelector } from '@/components/EndpointSelector';
import { EndpointForm } from '@/components/EndpointForm';
import { JobsPanel, JobsPanelRef } from '@/components/JobsPanel';
import { useToast } from '@/components/Toast';
import { useBalance } from '@/components/BalanceContext';
import { EndpointDefinition, Job, JsonValue } from '@/lib/types';

interface ProxyResponse {
  success: boolean;
  jobId?: string;
  isAsync?: boolean;
  error?: string;
  rawResponse?: JsonValue;
}

export default function Home() {
  const { showError } = useToast();
  const { balance } = useBalance();
  const jobsPanelRef = useRef<JobsPanelRef>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDefinition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleSubmit = async (params: Record<string, JsonValue>, formData?: FormData) => {
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: formData ? undefined : { 'Content-Type': 'application/json' },
        body: formData || JSON.stringify(params),
      });

      const data: ProxyResponse = await res.json();

      // Refresh jobs panel immediately
      jobsPanelRef.current?.refresh();

      if (!data.success) {
        showError(data.error || 'Request failed');
        return;
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRerun = useCallback((job: Job) => {
    fetch(`/api/endpoints?id=${job.endpointId}`)
      .then((res) => res.json())
      .then((endpoint: EndpointDefinition) => {
        if (endpoint) {
          setSelectedEndpoint(endpoint);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <main className="h-screen flex flex-col bg-[var(--background)]">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-zinc-200 tracking-tight">deAPI Tester</h1>
          <span className="text-[10px] text-zinc-600 font-mono">v0.1</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Balance display */}
          {balance !== null && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-2)] rounded">
              <span className="text-[10px] text-zinc-500">Balance:</span>
              <span className="text-sm font-mono font-medium text-green-400">${balance}</span>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1h3l.3 2.1a5.5 5.5 0 0 1 1.5.9l2-.8 1.5 2.6-1.7 1.3a5.5 5.5 0 0 1 0 1.8l1.7 1.3-1.5 2.6-2-.8a5.5 5.5 0 0 1-1.5.9L9.5 15h-3l-.3-2.1a5.5 5.5 0 0 1-1.5-.9l-2 .8-1.5-2.6 1.7-1.3a5.5 5.5 0 0 1 0-1.8L1.2 5.8l1.5-2.6 2 .8a5.5 5.5 0 0 1 1.5-.9L6.5 1z" strokeLinejoin="round" />
              <circle cx="8" cy="8" r="2" />
            </svg>
          </button>
        </div>
      </header>

      {/* Row 1: Endpoint Selector + Form */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0" style={{ height: '340px' }}>
        {/* Endpoint Selector */}
        <div className="w-64 flex-shrink-0 border-r border-[var(--border)]">
          <EndpointSelector
            selectedEndpoint={selectedEndpoint}
            onSelect={setSelectedEndpoint}
          />
        </div>

        {/* Form Area */}
        <div className="flex-1 overflow-hidden">
          {selectedEndpoint ? (
            <EndpointForm
              endpoint={selectedEndpoint}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3 text-zinc-800">
                  <path d="M12 8h24v6H12z" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 18h32v22H8z" stroke="currentColor" strokeWidth="2" />
                  <circle cx="16" cy="29" r="2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="32" cy="29" r="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M24 14v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="text-sm text-zinc-500">Select an endpoint to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Jobs Panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <JobsPanel
          ref={jobsPanelRef}
          onRerun={handleRerun}
        />
      </div>

      {/* Config Drawer */}
      <ConfigDrawer
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </main>
  );
}
