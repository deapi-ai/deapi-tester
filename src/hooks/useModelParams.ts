'use client';

import { useCallback } from 'react';
import { DeApiModel, EndpointDefinition, EndpointParam, JsonValue } from '@/lib/types';
import {
  SelectOption,
  getEffectiveParam,
  getFieldDefault,
  getFieldLimit,
  getMaxFiles,
  getModelInfoParts,
  getSelectOptions,
  isParamVisible,
} from '@/lib/model-params';

/**
 * Per-field lookups against the selected model's /models data, bound to the
 * current form values. Thin memoized wrappers over `lib/model-params`.
 */
export function useModelParams(
  endpoint: EndpointDefinition,
  models: DeApiModel[],
  selectedModel: DeApiModel | undefined,
  values: Record<string, JsonValue>
) {
  const { defaults, limits, features } = getModelInfoParts(selectedModel);

  const isFieldVisible = useCallback(
    (param: EndpointParam): boolean => isParamVisible(param, values, features, limits),
    [values, features, limits]
  );

  const effectiveParam = useCallback(
    (param: EndpointParam): EndpointParam => getEffectiveParam(param, limits, defaults),
    [limits, defaults]
  );

  const selectOptions = useCallback(
    (paramName: string): SelectOption[] | undefined =>
      getSelectOptions(paramName, { endpoint, models, selectedModel, limits, values }),
    [endpoint, models, selectedModel, limits, values]
  );

  const maxFiles = useCallback((param: EndpointParam) => getMaxFiles(param, limits), [limits]);
  const fieldDefault = useCallback((name: string) => getFieldDefault(name, defaults), [defaults]);
  const fieldLimit = useCallback((name: string) => getFieldLimit(name, limits), [limits]);

  return {
    modelDefaults: defaults,
    isFieldVisible,
    effectiveParam,
    selectOptions,
    maxFiles,
    fieldDefault,
    fieldLimit,
  };
}
