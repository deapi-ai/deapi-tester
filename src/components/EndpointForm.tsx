'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, CircleDollarSign, Play, ChevronRight, RotateCcw, Dices } from 'lucide-react';
import { EndpointDefinition, EndpointParam, JsonValue, DeApiModel } from '@/lib/types';
import { useModelsContext } from '@/components/ModelsContext';
import { ModelInfo } from '@/components/ModelInfo';
import { FormField } from '@/components/form/FormField';
import { FileUploadField } from '@/components/form/FileUploadField';
import {
  categorizeParams,
  generateImagePreview,
  FIELD_TO_FEATURE_MAP,
  DEFAULTABLE_FIELDS,
} from '@/lib/form-utils';
import { getRandomPrompt } from '@/lib/sample-prompts';

interface ImagePreview {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

interface FormPrefill {
  params: Record<string, JsonValue>;
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
  const [priceResult, setPriceResult] = useState<{ credits: number; error?: string } | null>(null);
  const { models, isLoading: modelsLoading, getModelBySlug } = useModelsContext();

  const isRequestStatusEndpoint = endpoint.id === 'request-status';
  const selectedModelSlug = values['model'] as string | undefined;
  const selectedModel = selectedModelSlug ? getModelBySlug(selectedModelSlug) : undefined;
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
    const filteredModels = models.filter((m) => m.inference_types.includes(inferenceType));

    setValues((prev) => {
      const currentModel = prev['model'] as string | undefined;
      if (!currentModel || !filteredModels.some((m) => m.slug === currentModel)) {
        const newModel = filteredModels.length > 0 ? filteredModels[0].slug : '';
        return { ...prev, model: newModel };
      }
      return prev;
    });
  }, [models, endpoint.id, endpoint.inferenceType, endpoint.params]);

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
    // Mark the prefilled model as "already applied" so the auto-default effect does not
    // overwrite the restored numeric fields (steps/width/height/etc.).
    prevModelSlugRef.current = (newValues['model'] as string | undefined) ?? undefined;
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
      const filteredModels = models.filter((m) => m.inference_types.includes(inferenceType));
      if (filteredModels.length > 0) {
        return filteredModels.map((m) => ({ value: m.slug, label: m.name }));
      }
      return undefined;
    }

    if (!selectedModel) return undefined;

    if (paramName === 'lang' && selectedModel.languages) {
      return selectedModel.languages.map((l) => ({ value: l.slug, label: l.name }));
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
  }, [endpoint.id, endpoint.inferenceType, models, selectedModel, values]);

  // Check if a field should be visible based on visibleWhen condition
  const isFieldVisible = useCallback((param: EndpointParam): boolean => {
    if (!param.visibleWhen) return true;
    const currentValue = values[param.visibleWhen.field];
    if (param.visibleWhen.matchEmpty && (currentValue === null || currentValue === undefined || currentValue === '')) {
      return true;
    }
    return param.visibleWhen.values.includes(currentValue as string);
  }, [values]);

  const buildFilteredValues = useCallback((): Record<string, JsonValue> => {
    const filteredValues: Record<string, JsonValue> = {};
    Object.entries(values).forEach(([key, value]) => {
      // Exclude hidden fields from payload
      const param = endpoint.params.find(p => p.name === key);
      if (param?.visibleWhen && !isFieldVisible(param)) return;

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

  const handleCheckPrice = async () => {
    if (!endpoint.hasPriceCalc) return;

    setIsCheckingPrice(true);
    setPriceResult(null);

    try {
      const filteredValues = buildFilteredValues();

      let res: Response;

      // For multipart endpoints with files, send as FormData (includes files for price calc)
      const hasFiles = Object.keys(files).length > 0;
      if (endpoint.contentType === 'multipart' && hasFiles) {
        const formData = new FormData();
        formData.append('_endpointId', endpoint.id);
        formData.append('_priceCalc', 'true');

        Object.entries(filteredValues).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            formData.append(key, String(value));
          }
        });

        Object.entries(files).forEach(([key, fileOrFiles]) => {
          const param = endpoint.params.find((p) => p.name === key);
          if (param?.visibleWhen && !isFieldVisible(param)) return;
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

      const price = data.rawResponse?.data?.price || 0;
      setPriceResult({ credits: price });
      onPriceCheck?.();
    } catch (err) {
      setPriceResult({ credits: 0, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setIsCheckingPrice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const filteredValues = buildFilteredValues();

    if (endpoint.contentType === 'multipart') {
      const formData = new FormData();
      formData.append('_endpointId', endpoint.id);

      Object.entries(filteredValues).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });

      Object.entries(files).forEach(([key, fileOrFiles]) => {
        const param = endpoint.params.find((p) => p.name === key);
        // Skip hidden file fields
        if (param?.visibleWhen && !isFieldVisible(param)) return;
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

      onSubmit(filteredValues, formData);
    } else {
      onSubmit({ ...filteredValues, _endpointId: endpoint.id });
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
            <div key={param.name} className="flex flex-col min-h-0">
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
              <textarea
                value={String(values[param.name] ?? '')}
                onChange={(e) => handleChange(param.name, e.target.value)}
                placeholder={arrayMode[param.name] ? 'One item per line...' : param.placeholder}
                className="w-full rounded px-2 py-1.5 text-sm resize-none min-h-[50px] flex-1"
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

        {/* Center: Params with defaults/limits */}
        {compactParams.length > 0 && (
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

          {booleanParams.map((param) => (
            <div key={param.name}>
              <label className="flex items-baseline gap-1 text-[10px] text-[var(--muted)] mb-1">
                {param.label}
              </label>
              <FormField
                param={getEffectiveParam(param)}
                value={values[param.name]}
                compact
                isNullableDisabled={nullableDisabled[param.name]}
                onValueChange={handleChange}
                onNullableToggle={toggleNullable}
              />
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
