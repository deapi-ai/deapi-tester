'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Settings, Sun, Moon, RefreshCw } from 'lucide-react';
import { useTheme } from '@/components/ThemeContext';
import { ConfigDrawer } from '@/components/ConfigDrawer';
import { EndpointSelector } from '@/components/EndpointSelector';
import { EndpointForm } from '@/components/EndpointForm';
import { JobsPanel, JobsPanelRef } from '@/components/JobsPanel';
import { WsIndicator } from '@/components/WsIndicator';
import { useToast } from '@/components/Toast';
import { useBalance } from '@/components/BalanceContext';
import { useModelsContext } from '@/components/ModelsContext';
import { getEndpointByApiPath } from '@/lib/endpoint-registry';
import { EndpointDefinition, Job, JsonValue, UploadedFile } from '@/lib/types';

interface FormPrefill {
  params: Record<string, JsonValue>;
  uploadedFiles?: UploadedFile[];
  nonce: number;
}

// Request form panel sizing (dragged by the splitter below the form).
const FORM_HEIGHT_KEY = 'deapi-form-height';
const FORM_MIN_HEIGHT = 200;

interface ProxyResponse {
  success: boolean;
  jobId?: string;
  isAsync?: boolean;
  error?: string;
  rawResponse?: JsonValue;
}

export default function Home() {
  const { showError, showSuccess } = useToast();
  const { balance, refreshBalance, isLoading: balanceLoading } = useBalance();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { refreshModels, isLoading: modelsLoading } = useModelsContext();
  const jobsPanelRef = useRef<JobsPanelRef>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDefinition | null>(null);
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Height of the request form panel. Null = the original auto behaviour
  // (min 200px, capped at 45vh); a number is a height the user dragged and is
  // remembered across sessions, so a long prompt can get as much room as needed.
  const [formHeight, setFormHeight] = useState<number | null>(null);
  const formAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem(FORM_HEIGHT_KEY));
    if (Number.isFinite(stored) && stored >= FORM_MIN_HEIGHT) setFormHeight(stored);
  }, []);

  const startFormResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = formAreaRef.current?.getBoundingClientRect().height ?? FORM_MIN_HEIGHT;
    let latest = startHeight;

    const onMove = (ev: PointerEvent) => {
      // Leave room for the jobs panel below, whatever the viewport height is.
      const max = Math.max(FORM_MIN_HEIGHT, window.innerHeight - 200);
      latest = Math.min(max, Math.max(FORM_MIN_HEIGHT, startHeight + ev.clientY - startY));
      setFormHeight(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(FORM_HEIGHT_KEY, String(Math.round(latest)));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const resetFormHeight = () => {
    setFormHeight(null);
    localStorage.removeItem(FORM_HEIGHT_KEY);
  };

  // Duplicate a request from history: select its endpoint and preload its params
  // into the form so the user can tweak and re-run without rebuilding from scratch.
  const handleDuplicate = (job: Job) => {
    const endpoint = getEndpointByApiPath(job.endpointId);
    if (!endpoint) {
      showError(`Cannot duplicate: unknown endpoint "${job.endpointId}"`);
      return;
    }
    setSelectedEndpoint(endpoint);
    setPrefill({ params: job.params, uploadedFiles: job.uploadedFiles, nonce: Date.now() });
    showSuccess(`Loaded "${endpoint.name}" request — review and execute`);
  };

  // Auto-open settings drawer when no API token is configured
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        const activeProfile = data.profiles?.find(
          (p: { id: string; hasToken: boolean }) => p.id === data.activeProfileId
        );
        if (activeProfile && !activeProfile.hasToken) {
          setIsConfigOpen(true);
        }
      })
      .catch(() => {
        // Silently fail — config might not be ready yet
      });
  }, []);

  const handleSubmit = async (params: Record<string, JsonValue>, formData?: FormData) => {
    const endpoint = selectedEndpoint;
    if (!endpoint) return;

    // Persist the job to history immediately as 'sending' so it appears on the
    // list the moment Execute is clicked — without blocking the button. The proxy
    // (price calc + submit) then runs in the background and updates this SAME job
    // in place (request_id + real status) when it returns. We don't have the
    // request_id yet, and that's fine — 'sending' is the start of its lifecycle.
    const displayParams = { ...params };
    delete displayParams._endpointId;

    let jobId: string | undefined;
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointId: endpoint.id, params: displayParams }),
      });
      const data = await res.json();
      jobId = data.jobId;
      jobsPanelRef.current?.refresh(); // show the 'sending' job
    } catch {
      // Couldn't pre-create the stub — fall back to a plain submit (proxy creates the job).
    }

    let body: BodyInit;
    let headers: Record<string, string> | undefined;
    if (formData) {
      if (jobId) formData.append('_jobId', jobId);
      body = formData;
    } else {
      body = JSON.stringify(jobId ? { ...params, _jobId: jobId } : params);
      headers = { 'Content-Type': 'application/json' };
    }

    fetch('/api/proxy', { method: 'POST', headers, body })
      .then((res) => res.json())
      .then((data: ProxyResponse) => {
        if (!data.success) {
          showError(data.error || 'Request failed');
        }
      })
      .catch((err) => {
        showError(err instanceof Error ? err.message : 'Request failed');
      })
      .finally(() => {
        // Pull the now-updated job (request_id + real status) into the list.
        jobsPanelRef.current?.refresh();
      });
  };


  return (
    <main className="h-screen flex flex-col bg-[var(--background)]">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Image src="/logo-deapi.svg" alt="deAPI" width={83} height={32} priority />
          <span className="text-xs text-[var(--text-faint)]">Tester</span>
        </div>

        <div className="flex items-center gap-3">
          {/* WebSocket status (left of balance) */}
          <WsIndicator />

          {/* Balance display */}
          {balance !== null && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-2)] rounded">
              <span className="text-[10px] text-[var(--muted)]">Balance:</span>
              <span className="text-sm font-mono font-medium text-green-400">${balance}</span>
            </div>
          )}

          {/* Refresh models + balance */}
          <button
            onClick={() => {
              refreshModels();
              refreshBalance();
            }}
            disabled={modelsLoading || balanceLoading}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
            title="Refresh models & balance"
          >
            <RefreshCw className={`w-4 h-4 ${modelsLoading || balanceLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings button */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors"
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
          <div
            ref={formAreaRef}
            className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] overflow-hidden"
            style={
              formHeight === null
                ? { minHeight: `${FORM_MIN_HEIGHT}px`, maxHeight: '45vh' }
                : { height: `${formHeight}px` }
            }
          >
            {selectedEndpoint ? (
              <EndpointForm
                endpoint={selectedEndpoint}
                prefill={prefill}
                onSubmit={handleSubmit}
                onPriceCheck={() => jobsPanelRef.current?.refresh()}
                isSubmitting={false}
              />
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3 text-[var(--border)]">
                    <path d="M12 8h24v6H12z" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 18h32v22H8z" stroke="currentColor" strokeWidth="2" />
                    <circle cx="16" cy="29" r="2" stroke="currentColor" strokeWidth="2" />
                    <circle cx="32" cy="29" r="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M24 14v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm text-[var(--muted)]">Select an endpoint to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* Splitter: drag to give the form (and its prompt fields) more room */}
          <div
            onPointerDown={startFormResize}
            onDoubleClick={resetFormHeight}
            className="resize-handle-row flex-shrink-0"
            title="Drag to resize the request form — double-click to reset"
          />

          {/* Jobs Panel - takes remaining space */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <JobsPanel
              ref={jobsPanelRef}
              onDuplicate={handleDuplicate}
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
