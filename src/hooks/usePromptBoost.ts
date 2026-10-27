'use client';

import { useState } from 'react';
import { EndpointDefinition, JsonValue } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { ENHANCEMENT_TYPES_REQUIRING_IMAGE, enhancementTypeForPath } from '@/lib/prompt-enhancement';
import { FormFiles } from '@/lib/form-payload';

// The first uploaded image — the reference image for enhancement types that
// require one (e.g. images.edits / videos.animations).
function findFirstImageFile(files: FormFiles): File | null {
  for (const value of Object.values(files)) {
    const list = Array.isArray(value) ? value : [value];
    const image = list.find((f) => f instanceof File && f.type.startsWith('image/'));
    if (image) return image;
  }
  return null;
}

interface UsePromptBoostOptions {
  endpoint: EndpointDefinition;
  values: Record<string, JsonValue>;
  files: FormFiles;
  selectedModelSlug: string | undefined;
  onChange: (name: string, value: JsonValue) => void;
  // Called after the boost request, so the jobs panel picks up its job.
  onDone?: () => void;
}

/**
 * The "Boost" button: rewrite the prompt/caption in place via the unified
 * prompt-enhancement endpoint. Supported when the endpoint maps to a known
 * enhancement type AND has a primary text field (prompt or caption).
 */
export function usePromptBoost({ endpoint, values, files, selectedModelSlug, onChange, onDone }: UsePromptBoostOptions) {
  const [isBoosting, setIsBoosting] = useState(false);
  const { showError, showSuccess } = useToast();

  const enhancementType = enhancementTypeForPath(endpoint.path);
  const enhanceableField = endpoint.params.some((p) => p.name === 'prompt')
    ? 'prompt'
    : endpoint.params.some((p) => p.name === 'caption')
      ? 'caption'
      : null;
  const canBoost = !!enhancementType && !!enhanceableField;

  const boost = async (fieldName: string) => {
    if (!enhancementType) return;

    const promptValue = String(values[fieldName] ?? '').trim();
    if (promptValue.length < 3) {
      showError('Enter a prompt (min 3 characters) to boost');
      return;
    }
    if (!selectedModelSlug) {
      showError('Select a model first');
      return;
    }

    const formData = new FormData();
    // Route through the proxy as the prompt-enhancement endpoint so the boost is
    // logged as a job (with its cost), just like any other request.
    formData.append('_endpointId', 'prompt-enhancement');
    formData.append('prompt', promptValue);
    formData.append('type', enhancementType);
    formData.append('model_slug', selectedModelSlug);

    const negativeValue = String(values['negative_prompt'] ?? '').trim();
    if (negativeValue.length >= 3) formData.append('negative_prompt', negativeValue);

    if (ENHANCEMENT_TYPES_REQUIRING_IMAGE.includes(enhancementType)) {
      const image = findFirstImageFile(files);
      if (!image) {
        showError('Upload a reference image first to boost this prompt');
        return;
      }
      formData.append('image', image);
    }

    setIsBoosting(true);
    try {
      const res = await fetch('/api/proxy', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) {
        showError(data.error || 'Failed to enhance prompt');
        return;
      }
      // Enhancement is synchronous: the rewritten prompt comes back in the
      // (top-level) response body.
      const enhanced = data.rawResponse?.prompt ?? data.rawResponse?.data?.prompt;
      const enhancedNegative = data.rawResponse?.negative_prompt ?? data.rawResponse?.data?.negative_prompt;
      if (enhanced) onChange(fieldName, enhanced);
      if (enhancedNegative && endpoint.params.some((p) => p.name === 'negative_prompt')) {
        onChange('negative_prompt', enhancedNegative);
      }
      onDone?.();
      showSuccess('Prompt enhanced');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to enhance prompt');
    } finally {
      setIsBoosting(false);
    }
  };

  return { canBoost, enhanceableField, isBoosting, boost };
}
