'use client';

import { useState, useRef } from 'react';
import { Settings } from 'lucide-react';
import { ConfigDrawer } from '@/components/ConfigDrawer';
import { EndpointSelector } from '@/components/EndpointSelector';
import { EndpointForm } from '@/components/EndpointForm';
import { JobsPanel, JobsPanelRef } from '@/components/JobsPanel';
import { useToast } from '@/components/Toast';
import { useBalance } from '@/components/BalanceContext';
import { EndpointDefinition, JsonValue } from '@/lib/types';

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
<Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Endpoint Selector - full height */}
        <div className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)]">
          <EndpointSelector
            selectedEndpoint={selectedEndpoint}
            onSelect={setSelectedEndpoint}
          />
        </div>

        {/* Center: Form + Jobs stacked */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Form Area */}
          <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)]" style={{ minHeight: '200px', maxHeight: '45vh' }}>
            {selectedEndpoint ? (
              <EndpointForm
                endpoint={selectedEndpoint}
                onSubmit={handleSubmit}
                onPriceCheck={() => jobsPanelRef.current?.refresh()}
                isSubmitting={isSubmitting}
              />
            ) : (
              <div className="h-[200px] flex items-center justify-center">
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

          {/* Jobs Panel - takes remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <JobsPanel
              ref={jobsPanelRef}
            />
          </div>
        </div>
      </div>

      {/* Config Drawer */}
      <ConfigDrawer
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </main>
  );
}
