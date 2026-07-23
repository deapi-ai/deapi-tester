'use client';

import { useCallback, useState } from 'react';
import { ChevronRight, ClipboardCheck, ClipboardCopy, Loader2 } from 'lucide-react';
import { AsrSegment, AsrTranscription, AsrWord, Job, JsonValue, TranscriptionMeta } from '@/lib/types';
import {
  formatFileSize,
  formatTimestamp,
  getSourceMetadata,
  getTranscriptionMeta,
} from '@/lib/format-utils';

interface JobTranscriptionProps {
  job: Job;
  resultUrl: string | null;
}

interface LoadedResult {
  text: string;
  size: number;
  truncated: boolean;
  parsed: AsrTranscription | null;
}

// Speaker labels come back as SPEAKER_00, SPEAKER_01… — give each a stable colour
// so a diarized transcript is readable at a glance.
const SPEAKER_COLORS = [
  'text-blue-400',
  'text-green-400',
  'text-purple-400',
  'text-orange-400',
  'text-pink-400',
  'text-teal-400',
];

function speakerColor(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) hash = (hash * 31 + speaker.charCodeAt(i)) >>> 0;
  return SPEAKER_COLORS[hash % SPEAKER_COLORS.length];
}

// The structured result is a JSON object with `text` and (when timestamps were
// requested) `segments`. Anything else — plain transcripts, error pages — stays text.
function parseStructured(text: string): AsrTranscription | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const obj = value as Record<string, unknown>;
    if (typeof obj.text !== 'string' && !Array.isArray(obj.segments)) return null;
    return obj as AsrTranscription;
  } catch {
    return null;
  }
}

function MetaBadges({ meta }: { meta: TranscriptionMeta }) {
  const tsLevel = meta.ts_level ?? 'none';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
          meta.structured
            ? 'bg-purple-500/15 text-purple-300'
            : 'bg-[var(--surface-2)] text-[var(--muted)]'
        }`}
        title={
          meta.structured
            ? 'Result file is a JSON transcription object'
            : 'Result file is plain text'
        }
      >
        {meta.structured ? 'JSON' : 'TXT'}
      </span>
      {meta.language && (
        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-[var(--surface-2)] text-[var(--text-secondary)]">
          {meta.language}
        </span>
      )}
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
          tsLevel === 'none'
            ? 'bg-[var(--surface-2)] text-[var(--muted)]'
            : 'bg-blue-500/15 text-blue-300'
        }`}
        title="Timestamp granularity actually delivered (may be coarser than requested)"
      >
        ts: {tsLevel}
      </span>
      {meta.diarization_available && (
        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-green-500/15 text-green-300">
          speakers
        </span>
      )}
    </div>
  );
}

// Rendered generically: which fields a platform reports varies, and deAPI can
// grow the block without a change here.
function SourceMetadata({ metadata }: { metadata: Record<string, JsonValue> }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 bg-[var(--surface)] rounded p-2">
      {Object.entries(metadata).map(([key, value]) => (
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

function WordList({ words }: { words: AsrWord[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {words.map((word, idx) => (
        <span
          key={`${word.start}-${idx}`}
          className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-secondary)]"
          title={`${formatTimestamp(word.start)} – ${formatTimestamp(word.end)}${
            word.score !== undefined ? ` · score ${word.score.toFixed(2)}` : ''
          }${word.speaker ? ` · ${word.speaker}` : ''}${
            word.chars ? ` · ${word.chars.length} chars` : ''
          }`}
        >
          {word.word}
        </span>
      ))}
    </div>
  );
}

function SegmentRow({ segment }: { segment: AsrSegment }) {
  const [showWords, setShowWords] = useState(false);
  const hasWords = !!segment.words && segment.words.length > 0;

  return (
    <div className="px-2 py-1 rounded hover:bg-[var(--hover)]">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-mono text-[var(--text-faint)] flex-shrink-0">
          {formatTimestamp(segment.start)} – {formatTimestamp(segment.end)}
        </span>
        {segment.speaker && (
          <span className={`text-[10px] font-mono flex-shrink-0 ${speakerColor(segment.speaker)}`}>
            {segment.speaker}
          </span>
        )}
        <span className="text-xs text-[var(--text-primary)] flex-1">{segment.text}</span>
        {hasWords && (
          <button
            type="button"
            onClick={() => setShowWords((v) => !v)}
            className="text-[9px] font-mono text-[var(--muted)] hover:text-blue-400 flex-shrink-0"
          >
            {segment.words!.length}w
          </button>
        )}
        {segment.avg_logprob !== undefined && (
          <span
            className="text-[9px] font-mono text-[var(--text-faint)] flex-shrink-0"
            title="Average log probability of this segment"
          >
            {segment.avg_logprob.toFixed(2)}
          </span>
        )}
      </div>
      {showWords && hasWords && <WordList words={segment.words!} />}
    </div>
  );
}

/**
 * Transcription result panel for a job.
 *
 * The shape of the result is decided by the model, not the request: deAPI
 * reports it as `structured` on the job status, and the file behind
 * `result_url` is either a JSON transcription object (rendered as segments /
 * words / speakers) or plain text. Both are fetched through the server, since
 * result URLs are presigned and often unreachable from the browser.
 */
export function JobTranscription({ job, resultUrl }: JobTranscriptionProps) {
  const meta = getTranscriptionMeta(job);
  const sourceMetadata = getSourceMetadata(job);
  const [isExpanded, setIsExpanded] = useState(false);
  const [result, setResult] = useState<LoadedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
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
        parsed: parseStructured(data.text),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result');
    } finally {
      setIsLoading(false);
    }
  }, [resultUrl]);

  if (!meta && !sourceMetadata) return null;

  const toggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    // Metadata is already in hand; only the result file needs fetching.
    if (next && resultUrl && !result && !isLoading) load();
  };

  const copy = () => {
    if (!result) return;
    const text = result.parsed?.text ?? result.text;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const parsed = result?.parsed;
  const segments = parsed?.segments ?? [];

  return (
    <div className="px-4 pb-3">
      <div className="bg-[var(--surface-inset)] border border-[var(--border-dim)] rounded">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button
            type="button"
            onClick={toggle}
            disabled={!resultUrl && !sourceMetadata}
            className="flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
            title={resultUrl || sourceMetadata ? 'Show transcript' : 'No result file yet'}
          >
            <ChevronRight
              className={`w-2 h-2 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
            Transcript
          </button>
          {meta && <MetaBadges meta={meta} />}
          {sourceMetadata && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-amber-500/15 text-amber-300"
              title="Source metadata returned for include_metadata"
            >
              metadata
            </span>
          )}
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
                title="Copy transcript text"
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
            {sourceMetadata && <SourceMetadata metadata={sourceMetadata} />}

            {error && <p className="text-[10px] text-red-400 font-mono">{error}</p>}

            {result && !parsed && (
              <pre className="text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap max-h-80 overflow-auto">
                {result.text}
              </pre>
            )}

            {parsed && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[9px] font-mono text-[var(--text-faint)]">
                  {parsed.language && <span>language: {parsed.language}</span>}
                  {parsed.language_probability !== undefined && (
                    <span>p: {parsed.language_probability}</span>
                  )}
                  {parsed.ts_level && <span>ts_level: {parsed.ts_level}</span>}
                  <span>segments: {segments.length}</span>
                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="ml-auto hover:text-blue-400"
                  >
                    {showRaw ? 'Rendered' : 'Raw JSON'}
                  </button>
                </div>

                {showRaw ? (
                  <pre className="text-[10px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap max-h-80 overflow-auto">
                    {result!.text}
                  </pre>
                ) : (
                  <>
                    {parsed.text && (
                      <pre className="text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap max-h-40 overflow-auto bg-[var(--surface)] rounded p-2">
                        {parsed.text}
                      </pre>
                    )}
                    {segments.length > 0 && (
                      <div className="max-h-80 overflow-auto divide-y divide-[var(--border-dim)]">
                        {segments.map((segment, idx) => (
                          <SegmentRow key={`${segment.start}-${idx}`} segment={segment} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
