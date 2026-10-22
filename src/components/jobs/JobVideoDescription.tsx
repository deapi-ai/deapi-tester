'use client';

import { ReactNode, useCallback, useState } from 'react';
import { ChevronRight, ClipboardCheck, ClipboardCopy, Loader2 } from 'lucide-react';
import {
  Job,
  VideoDescriptionEvent,
  VideoDescriptionMeta,
  VideoDescriptionResult,
  VideoDescriptionScene,
} from '@/lib/types';
import {
  formatFileSize,
  formatTimestamp,
  getInlineResult,
  getSourceMetadata,
} from '@/lib/format-utils';
import { KeyValueGrid } from '@/components/jobs/KeyValueGrid';

interface JobVideoDescriptionProps {
  job: Job;
  resultUrl: string | null;
}

interface LoadedResult {
  text: string;
  size: number;
  truncated: boolean;
  inline: boolean;
  parsed: VideoDescriptionResult | null;
}

type View = 'events' | 'scenes' | 'meta' | 'raw';

// A decoder that stops this far short of the declared duration means the
// source ended early (truncated upload/download): the index covers less than
// the header claimed. Below it is rounding noise.
const SHORT_DECODE_TOLERANCE_S = 0.5;

// deAPI validates `events` (numeric start/end + description) before it stores
// the document; `scenes` and `meta` are carried through from the worker as-is.
function parseDescription(text: string): VideoDescriptionResult | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (!Array.isArray(obj.events)) return null;
    return obj as unknown as VideoDescriptionResult;
  } catch {
    return null;
  }
}

function eventsAsText(events: VideoDescriptionEvent[]): string {
  return events
    .map((e) => `${formatTimestamp(e.start)} – ${formatTimestamp(e.end)}  ${e.description}`)
    .join('\n');
}

function Badge({ children, tone, title }: { children: ReactNode; tone: string; title?: string }) {
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${tone}`} title={title}>
      {children}
    </span>
  );
}

function EventRow({ event }: { event: VideoDescriptionEvent }) {
  return (
    <div className="flex items-baseline gap-2 px-2 py-1 rounded hover:bg-[var(--hover)]">
      <span className="text-[10px] font-mono text-[var(--text-faint)] flex-shrink-0">
        {formatTimestamp(event.start)} – {formatTimestamp(event.end)}
      </span>
      <span className="text-xs text-[var(--text-primary)] flex-1">{event.description}</span>
      {typeof event.merged === 'number' && event.merged > 1 && (
        <span
          className="text-[9px] font-mono text-green-400 flex-shrink-0"
          title={`Seen independently by ${event.merged} overlapping windows and merged — a confidence signal`}
        >
          ×{event.merged}
        </span>
      )}
      {typeof event.edge_distance === 'number' && (
        <span
          className="text-[9px] font-mono text-[var(--text-faint)] flex-shrink-0"
          title="Seconds from its window's nearer edge — near an edge the model had less context on one side"
        >
          edge {event.edge_distance.toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function SceneRow({ scene, index }: { scene: VideoDescriptionScene; index: number }) {
  return (
    <div className="flex items-baseline gap-2 px-2 py-1 rounded hover:bg-[var(--hover)]">
      <span className="text-[10px] font-mono text-[var(--text-faint)] flex-shrink-0 w-6">
        #{scene.idx ?? index}
      </span>
      {typeof scene.start === 'number' && typeof scene.end === 'number' && (
        <span className="text-[10px] font-mono text-[var(--text-faint)] flex-shrink-0">
          {formatTimestamp(scene.start)} – {formatTimestamp(scene.end)}
        </span>
      )}
      <span className="text-xs text-[var(--text-secondary)] flex-1 whitespace-pre-wrap">
        {scene.text || '—'}
      </span>
    </div>
  );
}

// What deserves a warning in `meta`: windows that ran out of tokens (their
// tails are unreliable) and a decode that stopped short of the declared length.
function MetaWarnings({ meta }: { meta: VideoDescriptionMeta }) {
  const truncated = Array.isArray(meta.truncated_windows) ? meta.truncated_windows : [];
  const endedEarly =
    typeof meta.duration === 'number' &&
    typeof meta.decoded_duration === 'number' &&
    meta.duration - meta.decoded_duration > SHORT_DECODE_TOLERANCE_S;

  return (
    <>
      {truncated.length > 0 && (
        <Badge
          tone="bg-amber-500/15 text-amber-300"
          title={`Windows ${truncated.join(', ')} hit the token cap — their tails are unreliable`}
        >
          {truncated.length} truncated
        </Badge>
      )}
      {endedEarly && (
        <Badge
          tone="bg-amber-500/15 text-amber-300"
          title={`Source declares ${meta.duration}s but only ${meta.decoded_duration}s decoded — the index covers less than the video claims`}
        >
          ended at {formatTimestamp(meta.decoded_duration as number)}
        </Badge>
      )}
    </>
  );
}

/**
 * Video description result panel for a job.
 *
 * The result is a JSON document `{events, scenes, meta}` behind `result_url`
 * (fetched through the server — result URLs are presigned and often
 * unreachable from the browser), or inline in `data.result` when the request
 * set `return_result_in_response`, in which case nothing is fetched.
 */
export function JobVideoDescription({ job, resultUrl }: JobVideoDescriptionProps) {
  const inlineResult = getInlineResult(job);
  const sourceMetadata = getSourceMetadata(job);
  const [isExpanded, setIsExpanded] = useState(false);
  const [result, setResult] = useState<LoadedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<View>('events');

  const load = useCallback(async () => {
    if (inlineResult) {
      setResult({
        text: inlineResult,
        size: new TextEncoder().encode(inlineResult).length,
        truncated: false,
        inline: true,
        parsed: parseDescription(inlineResult),
      });
      return;
    }
    if (!resultUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/result?url=${encodeURIComponent(resultUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load result');
      setResult({
        text: data.text,
        size: data.size,
        truncated: data.truncated,
        inline: false,
        parsed: parseDescription(data.text),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result');
    } finally {
      setIsLoading(false);
    }
  }, [inlineResult, resultUrl]);

  const hasResult = !!inlineResult || !!resultUrl;
  if (!hasResult && !sourceMetadata) return null;

  const toggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && hasResult && !result && !isLoading) load();
  };

  const parsed = result?.parsed;
  const events = parsed?.events ?? [];
  const scenes = parsed?.scenes ?? [];
  const meta = parsed?.meta;
  // The preset that RAN (pinned by deAPI) once the result is in; until then,
  // the one this request asked for — which an empty or unsupported value can
  // differ from.
  const requestedPreset = typeof job.params.preset === 'string' ? job.params.preset : '';
  const preset = meta?.preset ?? requestedPreset;

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(view === 'raw' || !parsed ? result.text : eventsAsText(events));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'events', label: `Events ${events.length}` },
    { id: 'scenes', label: `Scenes ${scenes.length}` },
    { id: 'meta', label: 'Meta' },
    { id: 'raw', label: 'Raw JSON' },
  ];

  return (
    <div className="px-4 pb-3">
      <div className="bg-[var(--surface-inset)] border border-[var(--border-dim)] rounded">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--text-primary)] uppercase tracking-wide"
            title={hasResult ? 'Show the description' : 'Show the source metadata'}
          >
            <ChevronRight
              className={`w-2 h-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
            Description
          </button>
          <div className="flex items-center gap-1.5 flex-wrap">
            {preset && (
              <Badge
                tone="bg-blue-500/15 text-blue-300"
                title={meta?.preset ? 'Preset the job ran with' : 'Preset requested (the result says which one ran)'}
              >
                {preset}
              </Badge>
            )}
            {parsed && (
              <Badge tone="bg-[var(--surface-2)] text-[var(--text-secondary)]">
                {events.length} events
              </Badge>
            )}
            {meta && <MetaWarnings meta={meta} />}
            {inlineResult && (
              <Badge
                tone="bg-purple-500/15 text-purple-300"
                title="Result returned inline in the job status (return_result_in_response)"
              >
                inline
              </Badge>
            )}
            {sourceMetadata && (
              <Badge
                tone="bg-amber-500/15 text-amber-300"
                title="Source metadata returned for include_metadata"
              >
                metadata
              </Badge>
            )}
          </div>
          <div className="flex-1" />
          {result && (
            <>
              <span className="text-[9px] font-mono text-[var(--text-faint)]">
                {formatFileSize(result.size)}
                {result.truncated && ' (truncated)'}
              </span>
              <button
                type="button"
                onClick={copy}
                className={`p-1 transition-colors ${
                  copied ? 'text-green-400' : 'text-[var(--muted)] hover:text-blue-400'
                }`}
                title={view === 'raw' || !parsed ? 'Copy raw JSON' : 'Copy events as text'}
              >
                {copied ? (
                  <ClipboardCheck className="w-3 h-3" />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
              </button>
            </>
          )}
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-[var(--muted)]" />}
        </div>

        {isExpanded && (
          <div className="border-t border-[var(--border-dim)] px-2 py-2 space-y-2">
            {sourceMetadata && <KeyValueGrid entries={sourceMetadata} />}

            {error && <p className="text-[10px] text-red-400 font-mono">{error}</p>}

            {result && !parsed && (
              <pre className="text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap max-h-80 overflow-auto">
                {result.text}
              </pre>
            )}

            {parsed && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[9px] font-mono text-[var(--text-faint)]">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setView(tab.id)}
                      className={view === tab.id ? 'text-blue-400' : 'hover:text-blue-400'}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {typeof meta?.duration === 'number' && (
                    <span className="ml-auto">duration: {formatTimestamp(meta.duration)}</span>
                  )}
                  {typeof meta?.windows === 'number' && <span>windows: {meta.windows}</span>}
                </div>

                {view === 'events' && (
                  <div className="max-h-80 overflow-auto divide-y divide-[var(--border-dim)]">
                    {events.length === 0 && (
                      <p className="text-[10px] text-[var(--muted)] px-2 py-1">No events.</p>
                    )}
                    {events.map((event, idx) => (
                      <EventRow key={`${event.start}-${idx}`} event={event} />
                    ))}
                  </div>
                )}

                {view === 'scenes' && (
                  <div className="max-h-80 overflow-auto divide-y divide-[var(--border-dim)]">
                    {scenes.length === 0 && (
                      <p className="text-[10px] text-[var(--muted)] px-2 py-1">No scenes.</p>
                    )}
                    {scenes.map((scene, idx) => (
                      <SceneRow key={`${scene.idx ?? idx}`} scene={scene} index={idx} />
                    ))}
                  </div>
                )}

                {view === 'meta' &&
                  (meta ? (
                    <KeyValueGrid entries={meta} />
                  ) : (
                    <p className="text-[10px] text-[var(--muted)] px-2 py-1">No meta.</p>
                  ))}

                {view === 'raw' && (
                  <pre className="text-[10px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap max-h-80 overflow-auto">
                    {result!.text}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
