import { DeApiModel, EndpointDefinition, EndpointParam, JsonValue } from '@/lib/types';
import { getEndpointByApiPath } from '@/lib/endpoint-registry';
import { DEFAULTABLE_FIELDS, FIELD_TO_FEATURE_MAP, modelMatchesInferenceType } from '@/lib/form-utils';

/*
 * Everything the form derives from the selected model's /models data: limits,
 * defaults, capabilities and select options. Pure functions — the hooks wrap
 * them in memoization. Nothing here is hardcoded per model.
 */

type Dict = Record<string, unknown>;

export interface SelectOption {
  value: string;
  label: string;
}

export interface ModelInfoParts {
  defaults?: Dict;
  limits?: Dict;
  features?: Dict;
}

// `info` is an empty array when the API has nothing for a model.
export function getModelInfoParts(model: DeApiModel | undefined): ModelInfoParts {
  if (!model?.info || Array.isArray(model.info)) return {};
  return {
    defaults: model.info.defaults as Dict | undefined,
    limits: model.info.limits as Dict | undefined,
    features: model.info.features as Dict | undefined,
  };
}

// Lang/voice defaults come back as names, the selects hold slugs.
export function resolveLangSlug(value: string, model: DeApiModel | undefined): string {
  if (!model?.languages) return value;
  const match = model.languages.find((l) => l.slug === value || l.name === value);
  return match ? match.slug : value;
}

export function resolveVoiceSlug(value: string, langSlug: string, model: DeApiModel | undefined): string {
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
}

// A field is unsupported only when the model explicitly turns its feature off.
export function modelSupportsField(fieldName: string, features: Dict | undefined): boolean {
  if (!features) return true;
  const featureName = FIELD_TO_FEATURE_MAP[fieldName];
  if (!featureName) return true;
  return features[featureName] !== false;
}

/** Fill the form values with the model's defaults (skipping unsupported fields). */
export function withModelDefaultValues(
  prev: Record<string, JsonValue>,
  model: DeApiModel | undefined
): Record<string, JsonValue> {
  const { defaults = {}, features } = getModelInfoParts(model);
  const next = { ...prev };
  DEFAULTABLE_FIELDS.forEach((field) => {
    if (defaults[field] !== undefined && modelSupportsField(field, features)) {
      next[field] = defaults[field] as number;
    }
  });
  // negative_prompt defaults are skipped on purpose — the API returns placeholder
  // text like "Negative prompt", which is not a useful value.
  if (defaults.lang !== undefined) {
    next['lang'] = resolveLangSlug(defaults.lang as string, model);
  }
  if (defaults.voice !== undefined) {
    const langSlug = (next['lang'] ?? '') as string;
    next['voice'] = resolveVoiceSlug(defaults.voice as string, langSlug, model);
  }
  if (defaults.format !== undefined) next['format'] = defaults.format as string;
  if (defaults.sample_rate !== undefined) next['sample_rate'] = defaults.sample_rate as number;
  return next;
}

/** Disable fields the model does not support, enable the ones it has a default for. */
export function withModelDefaultDisabled(
  prev: Record<string, boolean>,
  model: DeApiModel | undefined
): Record<string, boolean> {
  const { defaults = {}, features } = getModelInfoParts(model);
  const next = { ...prev };
  DEFAULTABLE_FIELDS.forEach((field) => {
    if (!modelSupportsField(field, features)) {
      next[field] = true;
    } else if (defaults[field] !== undefined) {
      next[field] = false;
    }
  });
  return next;
}

/** Keep model-driven selects (e.g. ts_level) on a value the model actually offers. */
export function withValidModelOptions(
  prev: Record<string, JsonValue>,
  params: EndpointParam[],
  limits: Dict | undefined
): Record<string, JsonValue> {
  const source = limits ?? {};
  let changed = false;
  const next = { ...prev };
  params.forEach((param) => {
    if (!param.optionsFromModel) return;
    const list = source[param.optionsFromModel];
    if (!Array.isArray(list) || list.length === 0) return;
    const allowed = list.map((v) => String(v));
    if (!allowed.includes(String(next[param.name] ?? ''))) {
      next[param.name] = allowed[0];
      changed = true;
    }
  });
  return changed ? next : prev;
}

export function getFieldDefault(fieldName: string, defaults: Dict | undefined): number | undefined {
  return defaults ? (defaults[fieldName] as number | undefined) : undefined;
}

export function getFieldLimit(
  fieldName: string,
  limits: Dict | undefined
): { min?: number; max?: number } | undefined {
  if (!limits) return undefined;
  const min = limits[`min_${fieldName}`] as number | undefined;
  const max = limits[`max_${fieldName}`] as number | undefined;
  if (min === undefined && max === undefined) return undefined;
  return { min, max };
}

/** A number param with the model's min/max/step and default laid over it. */
export function getEffectiveParam(
  param: EndpointParam,
  limits: Dict | undefined,
  defaults: Dict | undefined
): EndpointParam {
  if (param.type !== 'number' || !limits) return param;

  const effective = { ...param };
  const min = limits[`min_${param.name}`] as number | undefined;
  const max = limits[`max_${param.name}`] as number | undefined;
  if (min !== undefined) effective.min = min;
  if (max !== undefined) effective.max = max;

  // Use resolution_step for width/height
  if ((param.name === 'width' || param.name === 'height') && limits['resolution_step'] !== undefined) {
    effective.step = limits['resolution_step'] as number;
  }

  if (defaults && defaults[param.name] !== undefined) {
    effective.default = defaults[param.name] as number;
  }
  return effective;
}

// How many files the model accepts in a field. Undefined when it says nothing —
// then the field is uncapped as far as this app knows and only the API can object.
export function getMaxFiles(param: EndpointParam, limits: Dict | undefined): number | undefined {
  if (!param.maxFilesFromModel) return undefined;
  const value = (limits ?? {})[param.maxFilesFromModel];
  return typeof value === 'number' ? value : undefined;
}

// Whether the model publishes a capability. The key is looked up in
// `info.features` first, then `info.limits`; an empty array counts as "not
// supported" (the API validates the field against the published list).
export function modelPublishesCapability(key: string, features: Dict | undefined, limits: Dict | undefined): boolean {
  const f = features ?? {};
  if (key in f) return f[key] === true;
  const l = limits ?? {};
  if (key in l) {
    const value = l[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }
  return false;
}

// Model capability gate first, then the value-based visibleWhen condition (an
// array of conditions means OR).
export function isParamVisible(
  param: EndpointParam,
  values: Record<string, JsonValue>,
  features: Dict | undefined,
  limits: Dict | undefined
): boolean {
  if (param.visibleFromModel && !modelPublishesCapability(param.visibleFromModel, features, limits)) {
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
}

// Map a prompt-enhancement `type` (dot notation, e.g. "images.generations") to
// the model inference_type used for filtering (e.g. "txt2img").
export function enhancementInferenceType(dotType: string | undefined): string | undefined {
  if (!dotType) return undefined;
  const ep = getEndpointByApiPath('/' + dotType.replace(/\./g, '/'));
  return ep?.inferenceType ?? ep?.id;
}

// Models the endpoint can run, matched on `endpoint.inferenceType ?? endpoint.id`.
export function modelsForInferenceType(models: DeApiModel[], inferenceType: string): DeApiModel[] {
  return models.filter((m) => modelMatchesInferenceType(m, inferenceType));
}

// The prompt-enhancement target model pool, filtered by the chosen `type` (the
// API rejects a model that does not support it). Falls back to every model.
export function modelsForEnhancementType(models: DeApiModel[], dotType: string | undefined): DeApiModel[] {
  const inf = enhancementInferenceType(dotType);
  const filtered = inf ? models.filter((m) => modelMatchesInferenceType(m, inf)) : [];
  return filtered.length > 0 ? filtered : models;
}

interface SelectOptionsContext {
  endpoint: EndpointDefinition;
  models: DeApiModel[];
  selectedModel: DeApiModel | undefined;
  limits: Dict | undefined;
  values: Record<string, JsonValue>;
}

/** Options for a select that come from /models rather than the registry. */
export function getSelectOptions(paramName: string, ctx: SelectOptionsContext): SelectOption[] | undefined {
  const { endpoint, models, selectedModel, limits, values } = ctx;

  if (paramName === 'model') {
    const filtered = modelsForInferenceType(models, endpoint.inferenceType ?? endpoint.id);
    return filtered.length > 0 ? filtered.map((m) => ({ value: m.slug, label: m.name })) : undefined;
  }

  if (paramName === 'model_slug') {
    return modelsForEnhancementType(models, values['type'] as string | undefined).map((m) => ({
      value: m.slug,
      label: m.name,
    }));
  }

  if (!selectedModel) return undefined;

  if (paramName === 'lang' && selectedModel.languages) {
    return selectedModel.languages.map((l) => ({ value: l.slug, label: l.name }));
  }

  // Options published by the model itself, e.g. `info.limits.timestamp_levels`.
  const fromModel = endpoint.params.find((p) => p.name === paramName)?.optionsFromModel;
  if (fromModel) {
    const list = (limits ?? {})[fromModel];
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
    // Also match by name (API defaults may use the name instead of the slug)
    const language = selectedModel.languages.find((l) => l.slug === selectedLang || l.name === selectedLang);
    if (language) {
      return language.voices.map((v) => ({
        value: v.slug,
        label: `${v.name} (${v.gender === 'female' ? 'F' : 'M'})`,
      }));
    }
    // No language selected yet — the defaults effect sets one shortly
    return [];
  }

  return undefined;
}
