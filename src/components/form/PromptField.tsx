'use client';

import { Loader2, Dices, Sparkles } from 'lucide-react';
import { EndpointParam } from '@/lib/types';
import { getRandomPrompt } from '@/lib/sample-prompts';
import { PromptTextarea } from '@/components/form/PromptTextarea';

interface PromptFieldProps {
  param: EndpointParam;
  value: string;
  onChange: (value: string) => void;
  isArrayMode: boolean;
  onToggleArrayMode: () => void;
  // Boost button (rewrites the text in place); hidden when undefined.
  onBoost?: () => void;
  isBoosting: boolean;
  // "Boost in request" checkbox (sends enhance_prompt); hidden when undefined.
  onInlineBoostChange?: (enabled: boolean) => void;
  inlineBoost: boolean;
}

/** A text field from the prompt group, with its toolbar: random, boost, inline boost, array mode. */
export function PromptField({
  param,
  value,
  onChange,
  isArrayMode,
  onToggleArrayMode,
  onBoost,
  isBoosting,
  onInlineBoostChange,
  inlineBoost,
}: PromptFieldProps) {
  const isPrimary = param.name === 'prompt' || param.name === 'caption';

  return (
    // The primary prompt gets twice the slack of any secondary text field, so
    // dragging the form taller mostly grows the prompt. min-h-fit is what stops
    // flex from squeezing the field into an overflow that paints over the file
    // fields below — including when it carries a height the user dragged it to.
    // Past that floor the column scrolls instead.
    <div className={`flex flex-col min-h-fit ${isPrimary ? 'flex-[2]' : 'flex-1'}`}>
      <div className="flex items-center gap-1 mb-1 flex-shrink-0">
        <label className="flex items-baseline gap-1 text-xs text-[var(--text-secondary)]">
          {param.label}
          {param.required && <span className="text-red-500">*</span>}
        </label>
        {param.name === 'prompt' && (
          <button
            type="button"
            onClick={() => onChange(getRandomPrompt())}
            className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors flex-shrink-0"
            title="Random prompt"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
        )}
        {onBoost && (
          <button
            type="button"
            onClick={onBoost}
            disabled={isBoosting}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 disabled:opacity-50 transition-colors flex-shrink-0"
            title="Enhance this prompt for the selected model"
          >
            {isBoosting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Boost
          </button>
        )}
        {onInlineBoostChange && (
          <label
            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors flex-shrink-0 ${
              inlineBoost
                ? 'text-purple-200 bg-purple-500/25'
                : 'text-[var(--text-secondary)] bg-[var(--surface-2)] hover:bg-purple-500/15'
            }`}
            title="Send enhance_prompt=true — deAPI boosts the prompt as a pre-step of this job. The boost fee is billed on the job and is included in the price estimate."
          >
            <input
              type="checkbox"
              checked={inlineBoost}
              onChange={(e) => onInlineBoostChange(e.target.checked)}
              className="w-3 h-3 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-purple-600 cursor-pointer"
            />
            Boost in request
          </label>
        )}
        {param.supportsArray && (
          <button
            type="button"
            onClick={onToggleArrayMode}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ml-auto ${
              isArrayMode
                ? 'bg-blue-600 text-white'
                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-emphasis)]'
            }`}
          >
            {isArrayMode ? 'Array mode' : 'Single'}
          </button>
        )}
      </div>
      <PromptTextarea
        value={value}
        onChange={onChange}
        placeholder={isArrayMode ? 'One item per line...' : param.placeholder}
        storageKey={`deapi-prompt-height:${param.name}`}
      />
    </div>
  );
}
