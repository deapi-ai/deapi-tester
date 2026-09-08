'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, CircleDollarSign, Play, ChevronRight, RotateCcw, Dices, Sparkles } from 'lucide-react';
import { EndpointDefinition, EndpointParam, JsonValue, DeApiModel, UploadedFile } from '@/lib/types';
import { useModelsContext } from '@/components/ModelsContext';
import { useToast } from '@/components/Toast';
import {
  enhancementTypeForPath,
  ENHANCEMENT_TYPES_REQUIRING_IMAGE,
  INLINE_BOOST_FIELD,
  supportsInlineBoost,
} from '@/lib/prompt-enhancement';
import { getEndpointByApiPath } from '@/lib/endpoint-registry';
import { ModelInfo } from '@/components/ModelInfo';
import { FormField } from '@/components/form/FormField';
import { FileUploadField } from '@/components/form/FileUploadField';
import { PromptTextarea } from '@/components/form/PromptTextarea';
import {
  categorizeParams,
  generateImagePreview,
  modelMatchesInferenceType,
  FIELD_TO_FEATURE_MAP,
  DEFAULTABLE_FIELDS,
} from '@/lib/form-utils';
import { getRandomPrompt } from '@/lib/sample-prompts';
import { formatCost } from '@/lib/format-utils';

interface ImagePreview {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

interface FormPrefill {
  params: Record<string, JsonValue>;
  uploadedFiles?: UploadedFile[];
  nonce: number;
}

interface EndpointFormProps {
  endpoint: EndpointDefinition;
  prefill?: FormPrefill | null;
  onSubmit: (params: Record<string, JsonValue>, formData?: FormData) => void;
  onPriceCheck?: () => void;
  isSubmitting: boolean;
}

export function EndpointForm({ endpoint, prefill, onSubmit, onPriceCheck, isSubmitting }: EndpointFormProps) {
  const [values, setValues] = useState<Record<string, JsonValue>>({});
  const [files, setFiles] = useState<Record<string, File | File[]>>({});
  const [nullableDisabled, setNullableDisabled] = useState<Record<string, boolean>>({});
  const [multiFileMode, setMultiFileMode] = useState<Record<string, boolean>>({});
  const [arrayMode, setArrayMode] = useState<Record<string, boolean>>({});
  const [imagePreviews, setImagePreviews] = useState<Record<string, ImagePreview[]>>({});
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [priceResult, setPriceResult] = useState<{
    credits: number;
    boostCredits?: number;
    error?: string;
  } | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);
  const { models, isLoading: modelsLoading, getModelBySlug } = useModelsContext();
  const { showError, showSuccess } = useToast();

  const isRequestStatusEndpoint = endpoint.id === 'request-status';
  const selectedModelSlug = values['model'] as string | undefined;
  const selectedModel = selectedModelSlug ? getModelBySlug(selectedModelSlug) : undefined;

  // Prompt enhancement ("boost"): supported when this endpoint maps to a known
  // enhancement type AND has a primary text field (prompt or caption).
  const enhancementType = enhancementTypeForPath(endpoint.path);
  const enhanceableField = endpoint.params.some((p) => p.name === 'prompt')
    ? 'prompt'
    : endpoint.params.some((p) => p.name === 'caption')
      ? 'caption'
      : null;
  const canBoost = !!enhancementType && !!enhanceableField;

  // Inline boost: instead of rewriting the prompt in the form first, the request
  // carries `enhance_prompt: true` and deAPI boosts it as a pre-step of the job.
  // Only four endpoints accept the flag. The choice is remembered per endpoint.
  const canInlineBoost = supportsInlineBoost(endpoint.path);
  const [inlineBoost, setInlineBoost] = useState(false);
  const inlineBoostStorageKey = `deapi-inline-boost:${endpoint.id}`;
  useEffect(() => {
    if (!canInlineBoost) {
      setInlineBoost(false);
      return;
    }
    setInlineBoost(localStorage.getItem(inlineBoostStorageKey) === '1');
  }, [canInlineBoost, inlineBoostStorageKey]);

  const toggleInlineBoost = (enabled: boolean) => {
    setInlineBoost(enabled);
    localStorage.setItem(inlineBoostStorageKey, enabled ? '1' : '0');
  };

  // Inline boost flag as the API expects it. Laravel's `boolean` rule accepts
  // 1/0 but not the string "true", so multipart requests send "1".
  const inlineBoostPayload = useCallback(
    (contentType: 'json' | 'multipart'): Record<string, JsonValue> =>
      canInlineBoost && inlineBoost
        ? { [INLINE_BOOST_FIELD]: contentType === 'multipart' ? '1' : true }
        : {},
    [canInlineBoost, inlineBoost]
  );

  const prevModelSlugRef = useRef<string | undefined>(undefined);
  const savedModelsRef = useRef<Record<string, string>>({});
  const appliedPrefillRef = useRef<number | undefined>(undefined);

  // Resolve lang/voice default values (API returns names, selects use slugs)
  const resolveLangSlug = useCallback((value: string, model: DeApiModel | undefined): string => {
    if (!model?.languages) return value;
    const match = model.languages.find((l) => l.slug === value || l.name === value);
    return match ? match.slug : value;
  }, []);

  const resolveVoiceSlug = useCallback((value: string, langSlug: string, model: DeApiModel | undefined): string => {
    if (!model?.languages) return value;
    const normalizedLangSlug = resolveLangSlug(langSlug, model);
    const lang = model.languages.find((l) => l.slug === normalizedLangSlug);
    if (lang) {
      const match = lang.voices.find((v) => v.slug === value || v.name === value);
      return match ? match.slug : value;
    }
    // Search all languages as fallback
    for (const l of model.languages) {
      const match = l.voices.find((v) => v.slug === value || v.name === value);
      if (match) return match.slug;
    }
    return value;
  }, [resolveLangSlug]);

  // Get model defaults/limits/features from API data
  const modelDefaults =
    selectedModel?.info && !Array.isArray(selectedModel.info) ? selectedModel.info.defaults : undefined;
  const modelLimits =
    selectedModel?.info && !Array.isArray(selectedModel.info) ? selectedModel.info.limits : undefined;
  const modelFeatures =
    selectedModel?.info && !Array.isArray(selectedModel.info) ? selectedModel.info.features : undefined;

  // Save model selection when it changes
  useEffect(() => {
    if (selectedModelSlug) {
      savedModelsRef.current[endpoint.id] = selectedModelSlug;
    }
  }, [selectedModelSlug, endpoint.id]);

  // Initialize form state when endpoint changes
  useEffect(() => {
    const defaults: Record<string, JsonValue> = {};
    const nullableDefaults: Record<string, boolean> = {};
    const multiFileModeDefaults: Record<string, boolean> = {};

    endpoint.params.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
      if (param.nullable) {
        nullableDefaults[param.name] = param.default === null || param.default === undefined;
      }
      if (param.multiFieldName) {
        multiFileModeDefaults[param.name] = false;
      }
    });

    // Restore previously selected model for this endpoint
    const savedModel = savedModelsRef.current[endpoint.id];
    if (savedModel && endpoint.params.some((p) => p.name === 'model')) {
      defaults['model'] = savedModel;
    }

    setValues(defaults);
    setFiles({});
    setNullableDisabled(nullableDefaults);
    setMultiFileMode(multiFileModeDefaults);
    setArrayMode({});
    setPriceResult(null);
    prevModelSlugRef.current = undefined;
    setImagePreviews((prev) => {
      Object.values(prev).flat().forEach((p) => URL.revokeObjectURL(p.url));
      return {};
    });
  }, [endpoint.id, endpoint.params]);

  // Auto-select first model when models load or endpoint changes
  useEffect(() => {
    if (models.length === 0) return;

    const modelParam = endpoint.params.find((p) => p.name === 'model');
    if (!modelParam) return;

    const inferenceType = endpoint.inferenceType ?? endpoint.id;
    const filteredModels = models.filter((m) => modelMatchesInferenceType(m, inferenceType));

    setValues((prev) => {
      const currentModel = prev['model'] as string | undefined;
      if (!currentModel || !filteredModels.some((m) => m.slug === currentModel)) {
        const newModel = filteredModels.length > 0 ? filteredModels[0].slug : '';
        return { ...prev, model: newModel };
      }
      return prev;
    });
  }, [models, endpoint.id, endpoint.inferenceType, endpoint.params]);

  // Map a prompt-enhancement `type` (dot notation, e.g. "images.generations")
  // to the model inference_type used for filtering (e.g. "txt2img").
  const enhancementInferenceType = useCallback((dotType: string | undefined): string | undefined => {
    if (!dotType) return undefined;
    const ep = getEndpointByApiPath('/' + dotType.replace(/\./g, '/'));
    return ep?.inferenceType ?? ep?.id;
  }, []);

  // Auto-select a valid model for the prompt-enhancement `model_slug` field.
  // The pool is filtered by the chosen `type`, so changing `type` re-picks a
  // model the API will accept.
  const enhancementSelectedType = values['type'] as string | undefined;
  useEffect(() => {
    if (models.length === 0) return;
    if (!endpoint.params.some((p) => p.name === 'model_slug')) return;

    const inf = enhancementInferenceType(enhancementSelectedType);
    const filtered = inf ? models.filter((m) => modelMatchesInferenceType(m, inf)) : [];
    const pool = filtered.length > 0 ? filtered : models;

    setValues((prev) => {
      const current = prev['model_slug'] as string | undefined;
      if (!current || !pool.some((m) => m.slug === current)) {
        return { ...prev, model_slug: pool[0].slug };
      }
      return prev;
    });
  }, [models, endpoint.params, enhancementSelectedType, enhancementInferenceType]);

  // Auto-apply model defaults when model selection changes
  useEffect(() => {
    if (!selectedModelSlug || selectedModelSlug === prevModelSlugRef.current) return;
    if (!selectedModel?.info || Array.isArray(selectedModel.info)) return;

    prevModelSlugRef.current = selectedModelSlug;

    const defaults = (selectedModel.info.defaults || {}) as Record<string, unknown>;
    const features = (selectedModel.info.features || {}) as Record<string, boolean | undefined>;

    setValues((prev) => {
      const newValues = { ...prev };
      DEFAULTABLE_FIELDS.forEach((field) => {
        if (defaults[field] !== undefined) {
          const featureName = FIELD_TO_FEATURE_MAP[field];
          if (!featureName || features[featureName] !== false) {
            newValues[field] = defaults[field] as number;
          }
        }
      });
      // Skip negative_prompt defaults — API returns placeholder text like "Negative prompt"
      // which is not a useful default value. Users should fill this in themselves.
      // Auto-set lang/voice defaults for TTS (resolve names to slugs)
      if (defaults.lang !== undefined) {
        newValues['lang'] = resolveLangSlug(defaults.lang as string, selectedModel);
      }
      if (defaults.voice !== undefined) {
        const langSlug = (newValues['lang'] ?? '') as string;
        newValues['voice'] = resolveVoiceSlug(defaults.voice as string, langSlug, selectedModel);
      }
      if (defaults.format !== undefined) newValues['format'] = defaults.format as string;
      if (defaults.sample_rate !== undefined) newValues['sample_rate'] = defaults.sample_rate as number;
      return newValues;
    });

    setNullableDisabled((prev) => {
      const newDisabled = { ...prev };
      DEFAULTABLE_FIELDS.forEach((field) => {
        const featureName = FIELD_TO_FEATURE_MAP[field];
        if (featureName && features[featureName] === false) {
          newDisabled[field] = true;
        } else if (defaults[field] !== undefined) {
          newDisabled[field] = false;
        }
      });
      return newDisabled;
    });
  }, [selectedModelSlug, selectedModel, resolveLangSlug, resolveVoiceSlug]);

  // Keep model-driven selects (e.g. ts_level) on a value the selected model
  // actually offers — switching to a model with a shorter list would otherwise
  // keep a value the API rejects.
  useEffect(() => {
    const limits = (modelLimits ?? {}) as Record<string, unknown>;
    const modelDriven = endpoint.params.filter((p) => p.optionsFromModel);
    if (modelDriven.length === 0) return;

    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      modelDriven.forEach((param) => {
        const list = limits[param.optionsFromModel as string];
        if (!Array.isArray(list) || list.length === 0) return;
        const allowed = list.map((v) => String(v));
        if (!allowed.includes(String(next[param.name] ?? ''))) {
          next[param.name] = allowed[0];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [modelLimits, endpoint.params]);

  // Apply a "duplicate request" prefill — load params from a history job into the form.
  // Declared after the init / auto-select / auto-default effects so it runs last and its
  // values win. Keyed on a one-shot nonce so it never re-applies on later re-renders.
  useEffect(() => {
    if (!prefill || prefill.nonce === appliedPrefillRef.current) return;
    appliedPrefillRef.current = prefill.nonce;

    const source = prefill.params;
    const newValues: Record<string, JsonValue> = {};
    const newNullableDisabled: Record<string, boolean> = {};
    const newArrayMode: Record<string, boolean> = {};

    endpoint.params.forEach((param) => {
      // Files can't be restored from history — user must re-upload them.
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
    setFiles({});
    setNullableDisabled(newNullableDisabled);
    setArrayMode(newArrayMode);
    setMultiFileMode({});
    setPriceResult(null);
    setImagePreviews((prev) => {
      Object.values(prev).flat().forEach((p) => URL.revokeObjectURL(p.url));
      return {};
    });
    // Mark the prefilled model as "already applied" so the auto-default effect does not
    // overwrite the restored numeric fields (steps/width/height/etc.).
    prevModelSlugRef.current = (newValues['model'] as string | undefined) ?? undefined;

    // Restore persisted multipart files (async) so duplicated requests keep uploads.
    const uploaded = prefill.uploadedFiles;
    if (uploaded && uploaded.length > 0) {
      const thisNonce = prefill.nonce;
      const fileParamsList = endpoint.params.filter((p) => p.type === 'file');
      (async () => {
        const restoredFiles: Record<string, File | File[]> = {};
        const restoredPreviews: Record<string, ImagePreview[]> = {};
        const restoredMultiMode: Record<string, boolean> = {};

        for (const param of fileParamsList) {
          const matches = uploaded.filter(
            (u) => u.field === param.name || (!!param.multiFieldName && u.field === param.multiFieldName)
          );
          if (matches.length === 0) continue;

          const isMulti =
            matches.length > 1 ||
            (!!param.multiFieldName && matches.some((m) => m.field === param.multiFieldName));

          const fetched: File[] = [];
          for (const m of matches) {
            try {
              const res = await fetch(`/api/uploads/${encodeURIComponent(m.storedName)}`);
              if (!res.ok) continue;
              const blob = await res.blob();
              fetched.push(new File([blob], m.fileName, { type: m.mimeType }));
            } catch {
              // skip files that can't be restored
            }
          }
          if (fetched.length === 0) continue;
          // A newer prefill superseded this one mid-fetch — abandon stale work
          if (appliedPrefillRef.current !== thisNonce) return;

          restoredFiles[param.name] = isMulti ? fetched : fetched[0];
          if (isMulti && param.multiFieldName) restoredMultiMode[param.name] = true;

          const images = fetched.filter((f) => f.type.startsWith('image/'));
          if (images.length > 0) {
            restoredPreviews[param.name] = await Promise.all(images.map(generateImagePreview));
          }
        }

        if (appliedPrefillRef.current !== thisNonce) return;
        if (Object.keys(restoredFiles).length > 0) setFiles(restoredFiles);
        if (Object.keys(restoredPreviews).length > 0) {
          setImagePreviews((prev) => ({ ...prev, ...restoredPreviews }));
        }
        if (Object.keys(restoredMultiMode).length > 0) {
          setMultiFileMode((prev) => ({ ...prev, ...restoredMultiMode }));
        }
      })();
    }
  }, [prefill, endpoint.params]);

  const handleChange = useCallback((name: string, value: JsonValue) => {
    setValues((prev) => {
      const newValues = { ...prev, [name]: value };
      // When language changes in TTS, auto-select first voice for that language
      if (name === 'lang') {
        const model = models.find((m) => m.slug === prev['model']);
        if (model?.languages) {
          const lang = model.languages.find((l) => l.slug === value);
          if (lang && lang.voices.length > 0) {
            newValues['voice'] = lang.voices[0].slug;
          }
        }
      }
      return newValues;
    });
  }, [models]);

  const handleFileChange = useCallback(async (name: string, file: File | File[] | null) => {
    if (file) {
      const incomingFiles = Array.isArray(file) ? file : [file];
      const isMulti = Array.isArray(file);

      // In multi mode, append to existing files
      const mergedFiles = isMulti
        ? [...(Array.isArray(files[name]) ? files[name] as File[] : files[name] ? [files[name] as File] : []), ...incomingFiles]
        : incomingFiles;

      setFiles((prev) => ({ ...prev, [name]: isMulti ? mergedFiles : mergedFiles[0] }));

      const imageFiles = incomingFiles.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        const newPreviews = await Promise.all(imageFiles.map(generateImagePreview));
        setImagePreviews((prev) => ({
          ...prev,
          [name]: isMulti ? [...(prev[name] || []), ...newPreviews] : newPreviews,
        }));
      } else if (!isMulti) {
        // Single mode non-image: clear old previews
        setImagePreviews((prev) => {
          const old = prev[name];
          if (old) old.forEach((p) => URL.revokeObjectURL(p.url));
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    } else {
      // Clear all
      setImagePreviews((prev) => {
        const old = prev[name];
        if (old) old.forEach((p) => URL.revokeObjectURL(p.url));
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[name];
        return newFiles;
      });
    }
  }, [files]);

  const toggleNullable = useCallback((name: string, disabled: boolean) => {
    setNullableDisabled((prev) => ({ ...prev, [name]: disabled }));
    if (disabled) {
      setValues((prev) => ({ ...prev, [name]: null }));
    }
  }, []);

  const removeFile = useCallback(
    (name: string, index: number) => {
      const currentFiles = files[name];
      if (!currentFiles) return;

      const fileArray = Array.isArray(currentFiles) ? currentFiles : [currentFiles];

      if (fileArray.length <= 1) {
        handleFileChange(name, null);
        return;
      }

      const newFiles = fileArray.filter((_, i) => i !== index);
      setFiles((prev) => ({ ...prev, [name]: newFiles }));

      setImagePreviews((prev) => {
        const prevPreviews = prev[name] || [];
        if (prevPreviews[index]) {
          URL.revokeObjectURL(prevPreviews[index].url);
        }
        return {
          ...prev,
          [name]: prevPreviews.filter((_, i) => i !== index),
        };
      });
    },
    [files, handleFileChange]
  );

  const handleModeChange = useCallback((name: string, isMulti: boolean) => {
    setMultiFileMode((prev) => ({ ...prev, [name]: isMulti }));
  }, []);

  const getDefaultForField = (fieldName: string): number | undefined => {
    if (!modelDefaults) return undefined;
    const defaults = modelDefaults as Record<string, unknown>;
    return defaults[fieldName] as number | undefined;
  };

  const getLimitForField = (fieldName: string): { min?: number; max?: number } | undefined => {
    if (!modelLimits) return undefined;
    const limits = modelLimits as Record<string, unknown>;
    const min = limits[`min_${fieldName}`] as number | undefined;
    const max = limits[`max_${fieldName}`] as number | undefined;
    if (min === undefined && max === undefined) return undefined;
    return { min, max };
  };

  const modelSupportsField = useCallback((fieldName: string): boolean => {
    if (!modelFeatures) return true;
    const features = modelFeatures as Record<string, boolean | undefined>;
    const featureName = FIELD_TO_FEATURE_MAP[fieldName];
    if (!featureName) return true;
    return features[featureName] !== false;
  }, [modelFeatures]);

  const handleSetDefaults = useCallback(() => {
    const defaults = (modelDefaults || {}) as Record<string, unknown>;

    setValues((prev) => {
      const newValues = { ...prev };
      DEFAULTABLE_FIELDS.forEach((field) => {
        if (defaults[field] !== undefined && modelSupportsField(field)) {
          newValues[field] = defaults[field] as number;
        }
      });
      // Resolve names to slugs for TTS defaults
      if (defaults.lang !== undefined) {
        newValues['lang'] = resolveLangSlug(defaults.lang as string, selectedModel);
      }
      if (defaults.voice !== undefined) {
        const langSlug = (newValues['lang'] ?? '') as string;
        newValues['voice'] = resolveVoiceSlug(defaults.voice as string, langSlug, selectedModel);
      }
      if (defaults.format !== undefined) newValues['format'] = defaults.format as string;
      if (defaults.sample_rate !== undefined) newValues['sample_rate'] = defaults.sample_rate as number;
      return newValues;
    });

    setNullableDisabled((prev) => {
      const newDisabled = { ...prev };
      DEFAULTABLE_FIELDS.forEach((field) => {
        if (!modelSupportsField(field)) {
          newDisabled[field] = true;
        } else if (defaults[field] !== undefined) {
          newDisabled[field] = false;
        }
      });
      return newDisabled;
    });
  }, [modelDefaults, modelSupportsField, selectedModel, resolveLangSlug, resolveVoiceSlug]);

  // Get effective param with model limits/defaults applied
  const getEffectiveParam = useCallback((param: EndpointParam): EndpointParam => {
    if (param.type !== 'number' || !modelLimits) return param;

    const limits = modelLimits as Record<string, unknown>;
    const effective = { ...param };

    const min = limits[`min_${param.name}`] as number | undefined;
    const max = limits[`max_${param.name}`] as number | undefined;
    if (min !== undefined) effective.min = min;
    if (max !== undefined) effective.max = max;

    // Use resolution_step for width/height
    if ((param.name === 'width' || param.name === 'height') && limits['resolution_step'] !== undefined) {
      effective.step = limits['resolution_step'] as number;
    }

    // Apply model default as param default
    if (modelDefaults) {
      const defaults = modelDefaults as Record<string, unknown>;
      if (defaults[param.name] !== undefined) {
        effective.default = defaults[param.name] as number;
      }
    }

    return effective;
  }, [modelLimits, modelDefaults]);

  // Get dynamic select options from model data
  const getDynamicSelectOptions = useCallback((paramName: string): { value: string; label: string }[] | undefined => {
    if (paramName === 'model') {
      const inferenceType = endpoint.inferenceType ?? endpoint.id;
      const filteredModels = models.filter((m) => modelMatchesInferenceType(m, inferenceType));
      if (filteredModels.length > 0) {
        return filteredModels.map((m) => ({ value: m.slug, label: m.name }));
      }
      return undefined;
    }

    // Prompt-enhancement target model: filter by the selected `type` (the API
    // rejects a model that doesn't support the chosen inference type).
    if (paramName === 'model_slug') {
      const inf = enhancementInferenceType(values['type'] as string | undefined);
      const filtered = inf ? models.filter((m) => modelMatchesInferenceType(m, inf)) : [];
      return (filtered.length > 0 ? filtered : models).map((m) => ({ value: m.slug, label: m.name }));
    }

    if (!selectedModel) return undefined;

    if (paramName === 'lang' && selectedModel.languages) {
      return selectedModel.languages.map((l) => ({ value: l.slug, label: l.name }));
    }

    // Options published by the model itself, e.g. `info.limits.timestamp_levels`.
    const fromModel = endpoint.params.find((p) => p.name === paramName)?.optionsFromModel;
    if (fromModel) {
      const limits = (modelLimits ?? {}) as Record<string, unknown>;
      const list = limits[fromModel];
      if (Array.isArray(list) && list.length > 0) {
        return list.map((v) => {
          const value = String(v);
          return { value, label: value.charAt(0).toUpperCase() + value.slice(1) };
        });
      }
      return undefined;
    }

    if (paramName === 'voice' && selectedModel.languages) {
      const selectedLang = values['lang'] as string;
      // Also try matching by name (API defaults may use name instead of slug)
      const language = selectedModel.languages.find(
        (l) => l.slug === selectedLang || l.name === selectedLang
      );
      if (language) {
        return language.voices.map((v) => ({
          value: v.slug,
          label: `${v.name} (${v.gender === 'female' ? 'F' : 'M'})`,
        }));
      }
      // No language selected yet — return empty (defaults effect will set lang shortly)
      return [];
    }

    return undefined;
  }, [endpoint.id, endpoint.inferenceType, endpoint.params, models, selectedModel, modelLimits, values, enhancementInferenceType]);

  // Whether the selected model publishes a given capability. The key is looked up
  // in `info.features` first, then `info.limits`; an empty array counts as "not
  // supported" (the API validates the field against the published list).
  const modelPublishesCapability = useCallback((key: string): boolean => {
    const features = (modelFeatures ?? {}) as Record<string, unknown>;
    if (key in features) return features[key] === true;
    const limits = (modelLimits ?? {}) as Record<string, unknown>;
    if (key in limits) {
      const value = limits[key];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }
    return false;
  }, [modelFeatures, modelLimits]);

  // Check if a field should be visible: model capability gate first, then the
  // value-based visibleWhen condition (an array of conditions means OR).
  const isFieldVisible = useCallback((param: EndpointParam): boolean => {
    if (param.visibleFromModel && !modelPublishesCapability(param.visibleFromModel)) {
      return false;
    }
    if (!param.visibleWhen) return true;

    const conditions = Array.isArray(param.visibleWhen) ? param.visibleWhen : [param.visibleWhen];
    return conditions.some((condition) => {
      const currentValue = values[condition.field];
      if (condition.matchEmpty && (currentValue === null || currentValue === undefined || currentValue === '')) {
        return true;
      }
      // Booleans are stored as real booleans; compare on their string form so a
      // condition can be written as values: ['true'].
      return condition.values.includes(String(currentValue));
    });
  }, [values, modelPublishesCapability]);

  const buildFilteredValues = useCallback((): Record<string, JsonValue> => {
    const filteredValues: Record<string, JsonValue> = {};
    Object.entries(values).forEach(([key, value]) => {
      // Exclude hidden fields from payload (value-gated or model-capability-gated)
      const param = endpoint.params.find(p => p.name === key);
      if (param && !isFieldVisible(param)) return;

      if (value !== null) {
        // Split into array if arrayMode is on for this field
        if (arrayMode[key] && typeof value === 'string') {
          filteredValues[key] = value.split('\n').map(s => s.trim()).filter(Boolean);
        } else if (param?.valueType === 'number' && typeof value === 'string' && value !== '') {
          // Convert string select values to numbers when valueType requires it
          filteredValues[key] = Number(value);
        } else {
          filteredValues[key] = value;
        }
      } else {
        // For disabled nullable fields, send model default or param default
        // Try model default first, then param default
        if (modelDefaults) {
          const defaults = modelDefaults as Record<string, unknown>;
          if (defaults[key] !== undefined && defaults[key] !== null) {
            filteredValues[key] = defaults[key] as JsonValue;
            return;
          }
        }
        if (param?.default !== undefined && param.default !== null) {
          filteredValues[key] = param.default;
        }
      }
    });
    return filteredValues;
  }, [values, endpoint.params, modelDefaults, arrayMode, isFieldVisible]);

  // Find the first uploaded image file (used as the reference image for
  // enhancement types that require one, e.g. images.edits / videos.animations).
  const findFirstImageFile = (): File | null => {
    for (const value of Object.values(files)) {
      const arr = Array.isArray(value) ? value : [value];
      const img = arr.find((f) => f instanceof File && f.type.startsWith('image/'));
      if (img) return img as File;
    }
    return null;
  };

  // Enhance the prompt/caption in place via the unified prompt-enhancement endpoint.
  const handleBoost = async (fieldName: string) => {
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
    if (negativeValue.length >= 3) {
      formData.append('negative_prompt', negativeValue);
    }

    if (ENHANCEMENT_TYPES_REQUIRING_IMAGE.includes(enhancementType)) {
      const image = findFirstImageFile();
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
      const enhancedNegative =
        data.rawResponse?.negative_prompt ?? data.rawResponse?.data?.negative_prompt;
      if (enhanced) {
        handleChange(fieldName, enhanced);
      }
      if (enhancedNegative && endpoint.params.some((p) => p.name === 'negative_prompt')) {
        handleChange('negative_prompt', enhancedNegative);
      }
      // Refresh the jobs panel so the new enhancement job (and its cost) shows up.
      onPriceCheck?.();
      showSuccess('Prompt enhanced');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to enhance prompt');
    } finally {
      setIsBoosting(false);
    }
  };

  const handleCheckPrice = async () => {
    if (!endpoint.hasPriceCalc) return;

    setIsCheckingPrice(true);
    setPriceResult(null);

    try {
      const filteredValues = buildFilteredValues();

      let res: Response;

      // Mirror the main request: multipart endpoints (with or without files) send
      // FormData so the price endpoint validates the same payload it will receive.
      // Sending JSON with "[File: …]" placeholders fails with 422.
      if (endpoint.contentType === 'multipart') {
        const formData = new FormData();
        formData.append('_endpointId', endpoint.id);
        formData.append('_priceCalc', 'true');
        // The /price endpoints do not take `enhance_prompt` — the proxy strips it
        // and quotes the boost separately, so the number includes the boost fee.
        Object.entries(inlineBoostPayload('multipart')).forEach(([key, value]) => {
          formData.append(key, String(value));
        });

        Object.entries(filteredValues).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            formData.append(key, String(value));
          }
        });

        Object.entries(files).forEach(([key, fileOrFiles]) => {
          const param = endpoint.params.find((p) => p.name === key);
          if (param && !isFieldVisible(param)) return;
          if (Array.isArray(fileOrFiles)) {
            fileOrFiles.forEach((file) => formData.append(key, file));
          } else {
            formData.append(key, fileOrFiles);
          }
        });

        res = await fetch('/api/proxy', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...filteredValues,
            ...inlineBoostPayload('json'),
            _endpointId: endpoint.id,
            _priceCalc: true,
          }),
        });
      }

      const data = await res.json();

      if (!data.success) {
        setPriceResult({ credits: 0, error: data.error || 'Failed to calculate' });
        return;
      }

      // Most price endpoints return { data: { price } }; prompt-enhancement returns top-level { price }.
      // With the inline boost on, the proxy quotes the boost separately under
      // `_tester` — it is charged on its own, so show it as an add-on rather
      // than folding it into the inference price.
      const price = data.rawResponse?.data?.price ?? data.rawResponse?.price ?? 0;
      const tester = data.rawResponse?._tester as
        | { boost_price?: number; total_price?: number }
        | undefined;
      setPriceResult({ credits: price, boostCredits: tester?.boost_price || undefined });
    } catch (err) {
      setPriceResult({ credits: 0, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setIsCheckingPrice(false);
      // The proxy logs the price check as a job (success or failure), so pull it
      // into the jobs list either way.
      onPriceCheck?.();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const filteredValues = buildFilteredValues();

    if (endpoint.contentType === 'multipart') {
      const formData = new FormData();
      formData.append('_endpointId', endpoint.id);
      Object.entries(inlineBoostPayload('multipart')).forEach(([key, value]) => {
        formData.append(key, String(value));
      });

      Object.entries(filteredValues).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });

      Object.entries(files).forEach(([key, fileOrFiles]) => {
        const param = endpoint.params.find((p) => p.name === key);
        // Skip hidden file fields
        if (param && !isFieldVisible(param)) return;
        const isMultiMode = param?.multiFieldName && multiFileMode[key];
        const fieldName = isMultiMode && param?.multiFieldName ? param.multiFieldName : key;

        if (Array.isArray(fileOrFiles)) {
          fileOrFiles.forEach((file) => {
            formData.append(fieldName, file);
          });
        } else {
          formData.append(fieldName, fileOrFiles);
        }
      });

      onSubmit({ ...filteredValues, ...inlineBoostPayload('multipart') }, formData);
    } else {
      onSubmit({
        ...filteredValues,
        ...inlineBoostPayload('json'),
        _endpointId: endpoint.id,
      });
    }
  };

  // Categorize params for layout (excluding hidden fields)
  const { promptParams, fileParams, selectParams, booleanParams, compactParams, otherParams } = useMemo(
    () => {
      const skip = isRequestStatusEndpoint ? ['request_id'] : [];
      const visibleParams = endpoint.params.filter((p) => isFieldVisible(p));
      return categorizeParams(visibleParams, skip);
    },
    [endpoint.params, isRequestStatusEndpoint, isFieldVisible]
  );

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
        <h3 className="text-sm font-medium text-[var(--text-emphasis)]">{endpoint.name}</h3>
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--surface-2)] rounded text-[var(--muted)]">
          {endpoint.method}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-faint)]">{endpoint.path}</span>
        {endpoint.isAsync && (
          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">async</span>
        )}
        <div className="flex-1" />

        {priceResult && (
          <span className={`text-xs font-mono ${priceResult.error ? 'text-red-400' : 'text-green-400'}`}>
            {priceResult.error ? priceResult.error : `~$${priceResult.credits}`}
            {!priceResult.error && priceResult.boostCredits !== undefined && (
              <span
                className="text-purple-300 ml-1"
                title="Prompt boost is billed separately from the inference"
              >
                + boost ${formatCost(priceResult.boostCredits)}
              </span>
            )}
          </span>
        )}

        {endpoint.hasPriceCalc && (
          <button
            type="button"
            onClick={handleCheckPrice}
            disabled={isCheckingPrice || isSubmitting}
            className="bg-[var(--border-strong)] hover:bg-[var(--muted)] disabled:bg-[var(--surface-2)] disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isCheckingPrice ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <CircleDollarSign className="w-3 h-3" />
                Check Price
              </>
            )}
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Play className="w-2.5 h-2.5 fill-current" />
              Execute
            </>
          )}
        </button>
      </div>

      {/* Form Content - 3 Column Layout */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden min-h-0">
        {/* Left: Prompts & Files */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 overflow-y-auto">
          {isRequestStatusEndpoint && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-secondary)]">
                Request ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={String(values['request_id'] ?? '')}
                onChange={(e) => handleChange('request_id', e.target.value)}
                placeholder="c08a339c-73e5-4d67-a4d5-231302fbff9a"
                className="w-full rounded px-3 py-2 text-sm font-mono bg-[var(--surface)] border border-[var(--border)] focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {promptParams.map((param) => (
            // The primary prompt gets twice the slack of any secondary text
            // field, so dragging the form taller mostly grows the prompt.
            <div
              key={param.name}
              className={`flex flex-col min-h-0 ${
                param.name === 'prompt' || param.name === 'caption' ? 'flex-[2]' : 'flex-1'
              }`}
            >
              <div className="flex items-center gap-1 mb-1 flex-shrink-0">
                <label className="flex items-baseline gap-1 text-xs text-[var(--text-secondary)]">
                  {param.label}
                  {param.required && <span className="text-red-500">*</span>}
                </label>
                {param.name === 'prompt' && (
                  <button
                    type="button"
                    onClick={() => handleChange(param.name, getRandomPrompt())}
                    className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded transition-colors flex-shrink-0"
                    title="Random prompt"
                  >
                    <Dices className="w-3.5 h-3.5" />
                  </button>
                )}
                {canBoost && param.name === enhanceableField && selectedModelSlug && (
                  <button
                    type="button"
                    onClick={() => handleBoost(param.name)}
                    disabled={isBoosting}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 disabled:opacity-50 transition-colors flex-shrink-0"
                    title="Enhance this prompt for the selected model"
                  >
                    {isBoosting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Boost
                  </button>
                )}
                {canInlineBoost && param.name === 'prompt' && (
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
                      onChange={(e) => toggleInlineBoost(e.target.checked)}
                      className="w-3 h-3 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-purple-600 cursor-pointer"
                    />
                    Boost in request
                  </label>
                )}
                {param.supportsArray && (
                  <button
                    type="button"
                    onClick={() => setArrayMode(prev => ({ ...prev, [param.name]: !prev[param.name] }))}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ml-auto ${
                      arrayMode[param.name]
                        ? 'bg-blue-600 text-white'
                        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-emphasis)]'
                    }`}
                  >
                    {arrayMode[param.name] ? 'Array mode' : 'Single'}
                  </button>
                )}
              </div>
              <PromptTextarea
                value={String(values[param.name] ?? '')}
                onChange={(value) => handleChange(param.name, value)}
                placeholder={arrayMode[param.name] ? 'One item per line...' : param.placeholder}
                storageKey={`deapi-prompt-height:${param.name}`}
              />
            </div>
          ))}

          {fileParams.length > 0 && (
            <div className="flex gap-2 flex-wrap flex-shrink-0">
              {fileParams.map((param) => (
                <div key={param.name} className="flex-1 min-w-[180px]">
                  <label className="flex items-baseline gap-1 text-xs text-[var(--text-secondary)] mb-1">
                    {param.label}
                    {param.required && <span className="text-red-500">*</span>}
                  </label>
                  <FileUploadField
                    name={param.name}
                    label={param.label}
                    required={param.required}
                    accept={param.accept}
                    multiFieldName={param.multiFieldName}
                    files={files[param.name]}
                    isMultiMode={!!(param.multiFieldName && multiFileMode[param.name])}
                    previews={imagePreviews[param.name] || []}
                    onFileChange={handleFileChange}
                    onRemoveFile={removeFile}
                    onModeChange={handleModeChange}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center: Params with defaults/limits, plus toggles */}
        {(compactParams.length > 0 || booleanParams.length > 0) && (
          <div className="w-44 flex-shrink-0 space-y-2 overflow-y-auto border-l border-r border-[var(--border)] px-3">
            <div className="space-y-2">
              {compactParams.map((param) => {
                const effective = getEffectiveParam(param);
                const defaultVal = getDefaultForField(param.name);
                const limit = getLimitForField(param.name);
                return (
                  <div key={param.name}>
                    <div className="flex items-baseline justify-between gap-1 mb-0.5">
                      <label className="text-[10px] text-[var(--muted)]">
                        {param.label}
                        {param.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      {(defaultVal !== undefined || limit) && (
                        <span className="text-[8px] font-mono text-[var(--text-faint)]">
                          {limit && `${limit.min ?? '?'}-${limit.max ?? '?'}`}
                          {defaultVal !== undefined && (
                            <span className="text-green-600 ml-1">def:{defaultVal}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <FormField
                      param={effective}
                      value={values[param.name]}
                      compact
                      isNullableDisabled={nullableDisabled[param.name]}
                      selectOptions={getDynamicSelectOptions(param.name)}
                      onValueChange={handleChange}
                      onNullableToggle={toggleNullable}
                    />
                  </div>
                );
              })}
            </div>

            {booleanParams.length > 0 && (
              <div className="space-y-2 pt-1">
                {booleanParams.map((param) => (
                  <div key={param.name}>
                    <label
                      className="block text-[10px] text-[var(--muted)] mb-0.5"
                      title={param.description}
                    >
                      {param.label}
                    </label>
                    <FormField
                      param={param}
                      value={values[param.name]}
                      compact
                      isNullableDisabled={nullableDisabled[param.name]}
                      onValueChange={handleChange}
                      onNullableToggle={toggleNullable}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right: Model & other settings */}
        <div className="w-48 flex-shrink-0 space-y-2 overflow-y-auto">
          {selectParams.map((param) => (
            <div key={param.name}>
              <label className="flex items-baseline gap-1 text-[10px] text-[var(--muted)] mb-1">
                {param.label}
                {param.required && <span className="text-red-500">*</span>}
              </label>
              <FormField
                param={getEffectiveParam(param)}
                value={values[param.name]}
                compact
                isNullableDisabled={nullableDisabled[param.name]}
                modelsLoading={modelsLoading}
                selectOptions={getDynamicSelectOptions(param.name)}
                onValueChange={handleChange}
                onNullableToggle={toggleNullable}
              />
              {param.name === 'model' && (
                <>
                  {selectedModel && (
                    <button
                      type="button"
                      onClick={handleSetDefaults}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1 mt-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-emphasis)] bg-[var(--surface-2)] hover:bg-[var(--border-strong)] rounded transition-colors"
                      title="Fill with model defaults and disable unsupported fields"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Set defaults
                    </button>
                  )}
                  <ModelInfo model={selectedModel} isLoading={modelsLoading && !selectedModel} />
                </>
              )}
            </div>
          ))}

          {otherParams.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-1 text-[10px] text-[var(--muted)] cursor-pointer hover:text-[var(--text-secondary)] py-1">
                <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
                More options ({otherParams.length})
              </summary>
              <div className="mt-2 space-y-2">
                {otherParams.map((param) => (
                  <div key={param.name}>
                    <label className="flex items-baseline gap-1 text-[10px] text-[var(--muted)] mb-1">
                      {param.label}
                    </label>
                    <FormField
                      param={getEffectiveParam(param)}
                      value={values[param.name]}
                      compact
                      isNullableDisabled={nullableDisabled[param.name]}
                      selectOptions={getDynamicSelectOptions(param.name)}
                      onValueChange={handleChange}
                      onNullableToggle={toggleNullable}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {endpoint.params.length === 0 && (
        <div className="flex-1 flex items-center justify-center -mt-12">
          <p className="text-sm text-[var(--muted)]">No parameters required</p>
        </div>
      )}
    </form>
  );
}
