'use client';

import { ChevronRight } from 'lucide-react';
import { DeApiModel, ModelDefaults, ModelFeatures, ModelLimits } from '@/lib/types';

interface ModelInfoProps {
  model: DeApiModel | undefined;
  isLoading?: boolean;
}

export function ModelInfo({ model, isLoading }: ModelInfoProps) {
  if (isLoading) {
    return (
      <div className="mt-2 text-[10px] text-[var(--text-faint)]">Loading...</div>
    );
  }

  if (!model) {
    return null;
  }

  const info = Array.isArray(model.info) ? {} : model.info;
  const hasFeatures = info.features && Object.keys(info.features).length > 0;
  const hasLimits = info.limits && Object.keys(info.limits).length > 0;
  const hasDefaults = info.defaults && Object.keys(info.defaults).length > 0;
  const hasLoras = model.loras && model.loras.length > 0;
  const hasLanguages = model.languages && model.languages.length > 0;

  if (!hasFeatures && !hasLimits && !hasDefaults && !hasLoras && !hasLanguages) {
    return null;
  }

  return (
    <div className="mt-2 p-2 bg-[var(--hover)] rounded border border-[var(--border)] space-y-2">
      {/* Features as badges */}
      {hasFeatures && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(info.features as ModelFeatures)
            .map(([key, value]) => {
              const label = key.replace('supports_', '').replace(/_/g, ' ');
              return (
                <span
                  key={key}
                  className={`text-[9px] px-1.5 py-0.5 rounded ${
                    value
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400 line-through'
                  }`}
                >
                  {label}
                </span>
              );
            })}
        </div>
      )}

      {/* Limits - displayed as clean rows */}
      {hasLimits && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
          {renderLimitPairs(info.limits as ModelLimits)}
        </div>
      )}

      {/* Defaults */}
      {hasDefaults && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-[var(--muted)] cursor-pointer hover:text-[var(--text-secondary)]">
            <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
            Defaults
          </summary>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
            {renderDefaults(info.defaults as ModelDefaults)}
          </div>
        </details>
      )}

      {/* LoRAs */}
      {hasLoras && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-[var(--muted)] cursor-pointer hover:text-[var(--text-secondary)]">
            <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
            {model.loras!.length} LoRAs
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {model.loras!.map((lora) => (
              <span
                key={lora.name}
                className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded"
                title={lora.name}
              >
                {lora.display_name}
              </span>
            ))}
          </div>
        </details>
      )}

      {/* Languages */}
      {hasLanguages && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-[var(--muted)] cursor-pointer hover:text-[var(--text-secondary)]">
            <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
            {model.languages!.length} languages
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {model.languages!.map((lang) => (
              <span
                key={lang.slug}
                className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded"
                title={`${lang.voices.length} voices`}
              >
                {lang.name}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const DEFAULT_LABELS: Record<string, string> = {
  steps: 'Steps',
  width: 'Width',
  height: 'Height',
  frames: 'Frames',
  fps: 'FPS',
  lang: 'Language',
  speed: 'Speed',
  voice: 'Voice',
  format: 'Format',
  sample_rate: 'Sample rate',
  prompt: 'Prompt',
  negative_prompt: 'Neg. prompt',
};

function renderDefaults(defaults: ModelDefaults) {
  const elements: React.ReactNode[] = [];

  for (const [key, value] of Object.entries(defaults)) {
    if (value === undefined || value === null) continue;
    const label = DEFAULT_LABELS[key] || key.replace(/_/g, ' ');
    let display = String(value);
    if (key === 'sample_rate' && typeof value === 'number') {
      display = `${(value / 1000).toFixed(0)}kHz`;
    }
    if (typeof value === 'string' && value.length > 30) {
      display = value.substring(0, 30) + '...';
    }
    elements.push(
      <div key={`${key}-label`} className="text-[var(--muted)]">{label}:</div>,
      <div key={`${key}-value`} className="text-[var(--text-secondary)] font-mono truncate" title={String(value)}>
        {display}
      </div>
    );
  }

  return elements;
}

function renderLimitPairs(limits: ModelLimits) {
  const pairs: { label: string; min?: number; max?: number }[] = [];

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
    pairs.push({ label: 'Text length', min: limits.min_text, max: limits.max_text });
  }
  if (limits.min_speed !== undefined || limits.max_speed !== undefined) {
    pairs.push({ label: 'Speed', min: limits.min_speed, max: limits.max_speed });
  }
  if (limits.min_scale !== undefined || limits.max_scale !== undefined) {
    pairs.push({ label: 'Scale', min: limits.min_scale, max: limits.max_scale });
  }

  const elements: React.ReactNode[] = [];

  pairs.forEach((pair) => {
    const rangeStr =
      pair.min !== undefined && pair.max !== undefined
        ? `${pair.min} - ${pair.max}`
        : pair.min !== undefined
        ? `min ${pair.min}`
        : `max ${pair.max}`;

    elements.push(
      <div key={`${pair.label}-label`} className="text-[var(--muted)]">
        {pair.label}:
      </div>,
      <div key={`${pair.label}-value`} className="text-[var(--text-secondary)] font-mono">
        {rangeStr}
      </div>
    );
  });

  if (limits.resolution_step !== undefined) {
    elements.push(
      <div key="res-step-label" className="text-[var(--muted)]">Res step:</div>,
      <div key="res-step-value" className="text-[var(--text-secondary)] font-mono">{limits.resolution_step}px</div>
    );
  }
  if (limits.max_input_tokens !== undefined) {
    elements.push(
      <div key="input-tokens-label" className="text-[var(--muted)]">Input tokens:</div>,
      <div key="input-tokens-value" className="text-[var(--text-secondary)] font-mono">{limits.max_input_tokens.toLocaleString()}</div>
    );
  }
  if (limits.max_total_tokens !== undefined) {
    elements.push(
      <div key="total-tokens-label" className="text-[var(--muted)]">Total tokens:</div>,
      <div key="total-tokens-value" className="text-[var(--text-secondary)] font-mono">{limits.max_total_tokens.toLocaleString()}</div>
    );
  }
  if (limits.max_input_images !== undefined) {
    elements.push(
      <div key="input-images-label" className="text-[var(--muted)]">Max images:</div>,
      <div key="input-images-value" className="text-[var(--text-secondary)] font-mono">{limits.max_input_images}</div>
    );
  }
  if (limits.max_video_duration_seconds !== undefined) {
    elements.push(
      <div key="video-duration-label" className="text-[var(--muted)]">Max duration:</div>,
      <div key="video-duration-value" className="text-[var(--text-secondary)] font-mono">{limits.max_video_duration_seconds}s</div>
    );
  }
  if (limits.available_ratios && limits.available_ratios.length > 0) {
    elements.push(
      <div key="sample-rates-label" className="text-[var(--muted)]">Sample rates:</div>,
      <div key="sample-rates-value" className="text-[var(--text-secondary)] font-mono">
        {limits.available_ratios.map(r => `${(r / 1000).toFixed(0)}kHz`).join(', ')}
      </div>
    );
  }

  return elements;
}
