'use client';

import { ChevronRight } from 'lucide-react';
import { DeApiModel, ModelFeatures, ModelLimits } from '@/lib/types';

interface ModelInfoProps {
  model: DeApiModel | undefined;
  isLoading?: boolean;
}

export function ModelInfo({ model, isLoading }: ModelInfoProps) {
  if (isLoading) {
    return (
      <div className="mt-1.5 text-[9px] text-zinc-600">Loading...</div>
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

  // Build compact limits string
  const limits = info.limits as ModelLimits | undefined;
  const compactLimits: string[] = [];
  if (limits) {
    if (limits.min_width !== undefined || limits.max_width !== undefined) {
      const w = limits.min_width === limits.max_width
        ? `${limits.min_width}`
        : `${limits.min_width || '?'}-${limits.max_width || '?'}`;
      compactLimits.push(`W:${w}`);
    }
    if (limits.min_height !== undefined || limits.max_height !== undefined) {
      const h = limits.min_height === limits.max_height
        ? `${limits.min_height}`
        : `${limits.min_height || '?'}-${limits.max_height || '?'}`;
      compactLimits.push(`H:${h}`);
    }
    if (limits.min_frames !== undefined || limits.max_frames !== undefined) {
      compactLimits.push(`${limits.min_frames || '?'}-${limits.max_frames || '?'}f`);
    }
    if (limits.min_steps !== undefined || limits.max_steps !== undefined) {
      compactLimits.push(`${limits.min_steps || '?'}-${limits.max_steps || '?'}st`);
    }
  }

  return (
    <div className="mt-1.5 space-y-1">
      {/* Features as inline badges */}
      {hasFeatures && (
        <div className="flex flex-wrap gap-0.5">
          {Object.entries(info.features as ModelFeatures)
            .filter(([, value]) => value) // Only show supported features
            .map(([key]) => {
              const label = key.replace('supports_', '').replace(/_/g, ' ');
              return (
                <span
                  key={key}
                  className="text-[8px] px-1 py-0.5 bg-green-500/10 text-green-500 rounded"
                >
                  {label}
                </span>
              );
            })}
        </div>
      )}

      {/* Compact limits line */}
      {compactLimits.length > 0 && (
        <div className="text-[9px] font-mono text-zinc-500">
          {compactLimits.join(' · ')}
        </div>
      )}

      {/* LoRAs - compact */}
      {hasLoras && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer hover:text-zinc-400">
            <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
            {model.loras!.length} LoRAs
          </summary>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {model.loras!.map((lora) => (
              <span
                key={lora.name}
                className="text-[8px] px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded"
                title={lora.name}
              >
                {lora.display_name}
              </span>
            ))}
          </div>
        </details>
      )}

      {/* Languages - compact */}
      {hasLanguages && (
        <details className="group">
          <summary className="flex items-center gap-1 text-[9px] text-zinc-500 cursor-pointer hover:text-zinc-400">
            <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
            {model.languages!.length} languages
          </summary>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {model.languages!.map((lang) => (
              <span
                key={lang.slug}
                className="text-[8px] px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded"
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
