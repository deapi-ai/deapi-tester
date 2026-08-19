'use client';

import { useState } from 'react';
import { ClipboardCheck, ClipboardCopy, Sparkles } from 'lucide-react';
import { Job, JsonValue } from '@/lib/types';

interface JobPromptBoostProps {
  job: Job;
}

interface BoostTexts {
  prompt?: string | null;
  promptOriginal?: string | null;
  negativePrompt?: string | null;
  negativePromptOriginal?: string | null;
}

// The boost details are persisted on the job, but a job that finished before
// this column existed (or one still being polled) only carries them inside the
// raw status payload — read both.
function getBoost(job: Job): BoostTexts | null {
  if (job.promptBoost) return job.promptBoost;
  const response = job.rawResponse as Record<string, JsonValue> | undefined;
  const data = response?.data as Record<string, JsonValue> | undefined;
  const boost = data?.prompt_boost as Record<string, JsonValue> | null | undefined;
  if (!boost) return null;
  const str = (v: JsonValue | undefined) => (typeof v === 'string' ? v : null);
  return {
    prompt: str(boost.prompt),
    promptOriginal: str(boost.prompt_original),
    negativePrompt: str(boost.negative_prompt),
    negativePromptOriginal: str(boost.negative_prompt_original),
  };
}

function PromptPair({
  label,
  original,
  boosted,
}: {
  label: string;
  original?: string | null;
  boosted?: string | null;
}) {
  if (!original && !boosted) return null;
  return (
    <div className="space-y-1">
      <div className="text-[9px] font-mono text-[var(--text-faint)] uppercase tracking-wide">
        {label}
      </div>
      {original && (
        <p className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface)] rounded p-2 whitespace-pre-wrap">
          {original}
        </p>
      )}
      {boosted && (
        <p className="text-[11px] text-purple-200 bg-purple-500/10 rounded p-2 whitespace-pre-wrap">
          {boosted}
        </p>
      )}
    </div>
  );
}

/**
 * Inline prompt-booster result for a job.
 *
 * When a request is sent with `enhance_prompt`, deAPI rewrites the prompt as a
 * pre-step of the job and reports both versions on the status. This panel shows
 * what was actually generated from. It is opened from the row's "boosted" chip,
 * so it never takes space on rows nobody asked about.
 */
export function JobPromptBoost({ job }: JobPromptBoostProps) {
  const boost = getBoost(job);
  const [copied, setCopied] = useState(false);

  if (!boost || (!boost.prompt && !boost.negativePrompt)) return null;

  const copy = () => {
    if (!boost.prompt) return;
    navigator.clipboard.writeText(boost.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="px-4 pb-3">
      <div className="bg-[var(--surface-inset)] border border-[var(--border-dim)] rounded">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-[10px] text-[var(--muted)] uppercase tracking-wide">Prompt boost</span>
          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">
            <Sparkles className="w-2.5 h-2.5" />
            enhance_prompt
          </span>
          <div className="flex-1" />
          {boost.prompt && (
            <button
              type="button"
              onClick={copy}
              className={`p-1 transition-colors ${
                copied ? 'text-green-400' : 'text-[var(--muted)] hover:text-blue-400'
              }`}
              title="Copy boosted prompt"
            >
              {copied ? (
                <ClipboardCheck className="w-3 h-3" />
              ) : (
                <ClipboardCopy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>

        <div className="border-t border-[var(--border-dim)] px-2 py-2 space-y-2">
          <PromptPair
            label="prompt (original → boosted)"
            original={boost.promptOriginal}
            boosted={boost.prompt}
          />
          <PromptPair
            label="negative prompt (original → boosted)"
            original={boost.negativePromptOriginal}
            boosted={boost.negativePrompt}
          />
        </div>
      </div>
    </div>
  );
}
