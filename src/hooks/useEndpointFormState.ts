'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EndpointDefinition, JsonValue, UploadedFile } from '@/lib/types';
import { useModelsContext } from '@/components/ModelsContext';
import { useFormFiles } from '@/hooks/useFormFiles';
import { useModelDefaults } from '@/hooks/useModelDefaults';

export interface FormPrefill {
  params: Record<string, JsonValue>;
  uploadedFiles?: UploadedFile[];
  nonce: number;
}

/**
 * All of EndpointForm's state: values, nullable toggles, array mode and files.
 * Resets when the endpoint changes, follows the selected model's defaults, and
 * loads a "duplicate request" prefill from history.
 *
 * Effect order matters and is kept on purpose: init → model defaults → prefill,
 * so a prefill's values win over the defaults applied in the same render.
 */
export function useEndpointFormState(endpoint: EndpointDefinition, prefill: FormPrefill | null | undefined) {
  const [values, setValues] = useState<Record<string, JsonValue>>({});
  const [nullableDisabled, setNullableDisabled] = useState<Record<string, boolean>>({});
  const [arrayMode, setArrayMode] = useState<Record<string, boolean>>({});
  const fileState = useFormFiles();
  const { resetFiles, restoreUploadedFiles } = fileState;
  const { models, getModelBySlug } = useModelsContext();

  const selectedModelSlug = values['model'] as string | undefined;
  const selectedModel = selectedModelSlug ? getModelBySlug(selectedModelSlug) : undefined;

  const appliedModelRef = useRef<string | undefined>(undefined);
  const savedModelsRef = useRef<Record<string, string>>({});
  const appliedPrefillRef = useRef<number | undefined>(undefined);

  // Remember the model picked per endpoint, to restore it on the way back
  useEffect(() => {
    if (selectedModelSlug) savedModelsRef.current[endpoint.id] = selectedModelSlug;
  }, [selectedModelSlug, endpoint.id]);

  // Initialize form state when the endpoint changes
  useEffect(() => {
    const defaults: Record<string, JsonValue> = {};
    const nullableDefaults: Record<string, boolean> = {};
    const modes: Record<string, boolean> = {};

    endpoint.params.forEach((param) => {
      if (param.default !== undefined) defaults[param.name] = param.default;
      if (param.nullable) {
        nullableDefaults[param.name] = param.default === null || param.default === undefined;
      }
      if (param.multiFieldName) {
        // multiOnly fields have no single-file spelling in the API, so they start in — and stay
        // in — array mode; the switch is hidden for them in FileUploadField.
        modes[param.name] = param.multiOnly === true;
      }
    });

    const savedModel = savedModelsRef.current[endpoint.id];
    if (savedModel && endpoint.params.some((p) => p.name === 'model')) {
      defaults['model'] = savedModel;
    }

    setValues(defaults);
    setNullableDisabled(nullableDefaults);
    setArrayMode({});
    resetFiles(modes);
    appliedModelRef.current = undefined;
  }, [endpoint.id, endpoint.params, resetFiles]);

  const applyModelDefaults = useModelDefaults({
    endpoint,
    models,
    selectedModel,
    selectedModelSlug,
    enhancementType: values['type'] as string | undefined,
    setValues,
    setNullableDisabled,
    appliedModelRef,
  });

  // Apply a "duplicate request" prefill — load params from a history job into the
  // form. Keyed on a one-shot nonce so it never re-applies on later re-renders.
  useEffect(() => {
    if (!prefill || prefill.nonce === appliedPrefillRef.current) return;
    appliedPrefillRef.current = prefill.nonce;

    const source = prefill.params;
    const newValues: Record<string, JsonValue> = {};
    const newNullableDisabled: Record<string, boolean> = {};
    const newArrayMode: Record<string, boolean> = {};

    endpoint.params.forEach((param) => {
      // File fields are restored from the persisted uploads below.
      if (param.type === 'file') return;

      let value: JsonValue | undefined = source[param.name];
      // Skip file placeholder strings the proxy logs for multipart fields (e.g. "[File: x.png]").
      if (typeof value === 'string' && value.startsWith('[File:')) value = undefined;

      if (value !== undefined) {
        if (param.supportsArray && Array.isArray(value)) {
          // Array values came from "array mode" — restore them as newline-separated text.
          newValues[param.name] = value.join('\n');
          newArrayMode[param.name] = true;
        } else {
          newValues[param.name] = value;
        }
      } else if (param.default !== undefined) {
        newValues[param.name] = param.default;
      }

      if (param.nullable) {
        const v = newValues[param.name];
        newNullableDisabled[param.name] = v === null || v === undefined;
      }
    });

    setValues(newValues);
    setNullableDisabled(newNullableDisabled);
    setArrayMode(newArrayMode);
    // Array-only fields have no single-file spelling — reset them back to multi
    // mode, not to the empty default, or the next submit sends the wrong key.
    resetFiles(Object.fromEntries(endpoint.params.filter((p) => p.multiOnly).map((p) => [p.name, true])));
    // Mark the prefilled model as "already applied" so its defaults do not
    // overwrite the restored numeric fields (steps/width/height/etc.).
    appliedModelRef.current = (newValues['model'] as string | undefined) ?? undefined;

    if (prefill.uploadedFiles && prefill.uploadedFiles.length > 0) {
      const nonce = prefill.nonce;
      void restoreUploadedFiles(endpoint.params, prefill.uploadedFiles, () => appliedPrefillRef.current === nonce);
    }
  }, [prefill, endpoint.params, resetFiles, restoreUploadedFiles]);

  const handleChange = useCallback(
    (name: string, value: JsonValue) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        // When the TTS language changes, auto-select its first voice
        if (name === 'lang') {
          const model = models.find((m) => m.slug === prev['model']);
          const lang = model?.languages?.find((l) => l.slug === value);
          if (lang && lang.voices.length > 0) next['voice'] = lang.voices[0].slug;
        }
        return next;
      });
    },
    [models]
  );

  const toggleNullable = useCallback((name: string, disabled: boolean) => {
    setNullableDisabled((prev) => ({ ...prev, [name]: disabled }));
    if (disabled) setValues((prev) => ({ ...prev, [name]: null }));
  }, []);

  const toggleArrayMode = useCallback((name: string) => {
    setArrayMode((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  return {
    values,
    nullableDisabled,
    arrayMode,
    selectedModel,
    selectedModelSlug,
    handleChange,
    toggleNullable,
    toggleArrayMode,
    applyModelDefaults,
    ...fileState,
  };
}
