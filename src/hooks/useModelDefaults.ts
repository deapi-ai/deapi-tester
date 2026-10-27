'use client';

import { Dispatch, MutableRefObject, SetStateAction, useCallback, useEffect } from 'react';
import { DeApiModel, EndpointDefinition, JsonValue } from '@/lib/types';
import {
  getModelInfoParts,
  modelsForInferenceType,
  modelsForEnhancementType,
  withModelDefaultDisabled,
  withModelDefaultValues,
  withValidModelOptions,
} from '@/lib/model-params';

interface UseModelDefaultsOptions {
  endpoint: EndpointDefinition;
  models: DeApiModel[];
  selectedModel: DeApiModel | undefined;
  selectedModelSlug: string | undefined;
  // Chosen prompt-enhancement `type`; drives the `model_slug` pool.
  enhancementType: string | undefined;
  setValues: Dispatch<SetStateAction<Record<string, JsonValue>>>;
  setNullableDisabled: Dispatch<SetStateAction<Record<string, boolean>>>;
  // Model whose defaults are already in the form. Reset it to undefined to have
  // the next model's defaults applied; set it to skip them (e.g. a prefill).
  appliedModelRef: MutableRefObject<string | undefined>;
}

/**
 * Keep the form in step with the selected model: pick a valid model, apply its
 * defaults when it changes, and keep model-driven selects on allowed values.
 * Returns the handler for the "Set defaults" button.
 */
export function useModelDefaults({
  endpoint,
  models,
  selectedModel,
  selectedModelSlug,
  enhancementType,
  setValues,
  setNullableDisabled,
  appliedModelRef,
}: UseModelDefaultsOptions): () => void {
  const { limits } = getModelInfoParts(selectedModel);
  const inferenceType = endpoint.inferenceType ?? endpoint.id;

  // Auto-select the first model when models load or the endpoint changes
  useEffect(() => {
    if (models.length === 0) return;
    if (!endpoint.params.some((p) => p.name === 'model')) return;

    const filtered = modelsForInferenceType(models, inferenceType);
    setValues((prev) => {
      const current = prev['model'] as string | undefined;
      if (!current || !filtered.some((m) => m.slug === current)) {
        return { ...prev, model: filtered.length > 0 ? filtered[0].slug : '' };
      }
      return prev;
    });
  }, [models, inferenceType, endpoint.params, setValues]);

  // Prompt enhancement: keep `model_slug` on a model that supports the chosen
  // `type`, so changing `type` re-picks one the API will accept.
  useEffect(() => {
    if (models.length === 0) return;
    if (!endpoint.params.some((p) => p.name === 'model_slug')) return;

    const pool = modelsForEnhancementType(models, enhancementType);
    setValues((prev) => {
      const current = prev['model_slug'] as string | undefined;
      if (!current || !pool.some((m) => m.slug === current)) {
        return { ...prev, model_slug: pool[0].slug };
      }
      return prev;
    });
  }, [models, endpoint.params, enhancementType, setValues]);

  // Apply the model's defaults when the selection changes
  useEffect(() => {
    if (!selectedModelSlug || selectedModelSlug === appliedModelRef.current) return;
    if (!selectedModel?.info || Array.isArray(selectedModel.info)) return;

    appliedModelRef.current = selectedModelSlug;
    setValues((prev) => withModelDefaultValues(prev, selectedModel));
    setNullableDisabled((prev) => withModelDefaultDisabled(prev, selectedModel));
  }, [selectedModelSlug, selectedModel, appliedModelRef, setValues, setNullableDisabled]);

  // Switching to a model with a shorter option list (e.g. ts_level) would
  // otherwise keep a value the API rejects.
  useEffect(() => {
    setValues((prev) => withValidModelOptions(prev, endpoint.params, limits));
  }, [limits, endpoint.params, setValues]);

  return useCallback(() => {
    setValues((prev) => withModelDefaultValues(prev, selectedModel));
    setNullableDisabled((prev) => withModelDefaultDisabled(prev, selectedModel));
  }, [selectedModel, setValues, setNullableDisabled]);
}
