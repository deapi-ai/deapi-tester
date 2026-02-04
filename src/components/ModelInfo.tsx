'use client';

import { ReactNode } from 'react';
import { DeApiModel, ModelFeatures, ModelLimits } from '@/lib/types';

interface ModelInfoProps {
  model: DeApiModel | undefined;
  isLoading?: boolean;
}

export function ModelInfo({ model, isLoading }: ModelInfoProps) {
  if (isLoading) {
    return (
      <div className="mt-2 p-2 bg-zinc-800/50 rounded border border-zinc-700/50 text-[10px] text-zinc-500">
        Loading model info...
      </div>
    );
  }

  if (!model) {
    return null;
  }

  const info = Array.isArray(model.info) ? {} : model.info;
  const hasFeatures = info.features && Object.keys(info.features).length > 0;
  const hasLimits = info.limits && Object.keys(info.limits).length > 0;
  const hasLoras = model.loras && model.loras.length > 0;
  const hasLanguages = model.languages && model.languages.length > 0;

  if (!hasFeatures && !hasLimits && !hasLoras && !hasLanguages) {
    return null;
  }

  return (
    <div className="mt-2 p-2 bg-zinc-800/50 rounded border border-zinc-700/50 space-y-2">
      {/* Features */}
      {hasFeatures && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(info.features as ModelFeatures).map(([key, value]) => {
            const label = key.replace('supports_', '').replace(/_/g, ' ');
            return (
              <span
                key={key}
                className={`text-[9px] px-1.5 py-0.5 rounded ${
                  value
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-zinc-700/50 text-zinc-500 line-through'
                }`}
                title={value ? `Supports ${label}` : `Does not support ${label}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Limits */}
      {hasLimits && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
          {renderLimitPairs(info.limits as ModelLimits)}
        </div>
      )}

      {/* LoRAs */}
      {hasLoras && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer hover:text-zinc-400">
            <svg
              width="6"
              height="6"
              viewBox="0 0 8 8"
              fill="currentColor"
              className="transition-transform group-open:rotate-90"
            >
              <path d="M2 0l4 4-4 4" />
            </svg>
            LoRAs available ({model.loras!.length})
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {model.loras!.map((lora) => (
              <span
                key={lora.name}
                className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20"
                title={lora.name}
              >
                {lora.display_name}
              </span>
            ))}
          </div>
        </details>
      )}

      {/* Languages (for TTS) */}
      {hasLanguages && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer hover:text-zinc-400">
            <svg
              width="6"
              height="6"
              viewBox="0 0 8 8"
              fill="currentColor"
              className="transition-transform group-open:rotate-90"
            >
              <path d="M2 0l4 4-4 4" />
            </svg>
            Languages ({model.languages!.length})
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {model.languages!.map((lang) => (
              <span
                key={lang.slug}
                className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20"
                title={`${lang.voices.length} voices`}
              >
                {lang.name} ({lang.voices.length})
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function renderLimitPairs(limits: ModelLimits) {
  const pairs: { label: string; min?: number; max?: number }[] = [];

  // Group min/max pairs
  if (limits.min_steps !== undefined || limits.max_steps !== undefined) {
    pairs.push({ label: 'Steps', min: limits.min_steps, max: limits.max_steps });
  }
  if (limits.min_width !== undefined || limits.max_width !== undefined) {
    pairs.push({ label: 'Width', min: limits.min_width, max: limits.max_width });
  }
  if (limits.min_height !== undefined || limits.max_height !== undefined) {
    pairs.push({ label: 'Height', min: limits.min_height, max: limits.max_height });
  }
  if (limits.min_frames !== undefined || limits.max_frames !== undefined) {
    pairs.push({ label: 'Frames', min: limits.min_frames, max: limits.max_frames });
  }
  if (limits.min_fps !== undefined || limits.max_fps !== undefined) {
    pairs.push({ label: 'FPS', min: limits.min_fps, max: limits.max_fps });
  }
  if (limits.min_text !== undefined || limits.max_text !== undefined) {
    pairs.push({ label: 'Text', min: limits.min_text, max: limits.max_text });
  }
  if (limits.min_speed !== undefined || limits.max_speed !== undefined) {
    pairs.push({ label: 'Speed', min: limits.min_speed, max: limits.max_speed });
  }

  const elements: ReactNode[] = [];

  pairs.forEach((pair, idx) => {
    const rangeStr =
      pair.min !== undefined && pair.max !== undefined
        ? `${pair.min} - ${pair.max}`
        : pair.min !== undefined
        ? `min ${pair.min}`
        : `max ${pair.max}`;

    elements.push(
      <div key={`${pair.label}-label`} className="text-zinc-500">
        {pair.label}:
      </div>,
      <div key={`${pair.label}-value`} className="text-zinc-400 font-mono">
        {rangeStr}
      </div>
    );
  });

  // Single values
  if (limits.resolution_step !== undefined) {
    elements.push(
      <div key="res-step-label" className="text-zinc-500">Res step:</div>,
      <div key="res-step-value" className="text-zinc-400 font-mono">{limits.resolution_step}px</div>
    );
  }
  if (limits.max_input_tokens !== undefined) {
    elements.push(
      <div key="input-tokens-label" className="text-zinc-500">Max tokens:</div>,
      <div key="input-tokens-value" className="text-zinc-400 font-mono">{limits.max_input_tokens.toLocaleString()}</div>
    );
  }

  return elements;
}
