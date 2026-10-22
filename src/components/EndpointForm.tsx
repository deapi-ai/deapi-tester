'use client';

import { useMemo } from 'react';
import { EndpointDefinition, JsonValue } from '@/lib/types';
import { useModelsContext } from '@/components/ModelsContext';
import { FormPrefill, useEndpointFormState } from '@/hooks/useEndpointFormState';
import { useModelParams } from '@/hooks/useModelParams';
import { useInlineBoost } from '@/hooks/useInlineBoost';
import { usePromptBoost } from '@/hooks/usePromptBoost';
import { usePriceCheck } from '@/hooks/usePriceCheck';
import { categorizeParams, FieldBindings } from '@/lib/form-utils';
import { appendFiles, buildFilteredValues, buildProxyRequest, groupFileSections, ProxyRequest } from '@/lib/form-payload';
import { FormHeader } from '@/components/form/FormHeader';
import { PromptField } from '@/components/form/PromptField';
import { FileSections } from '@/components/form/FileSections';
import { CompactParamsColumn } from '@/components/form/CompactParamsColumn';
import { SettingsColumn } from '@/components/form/SettingsColumn';

interface EndpointFormProps {
  endpoint: EndpointDefinition;
  prefill?: FormPrefill | null;
  onSubmit: (params: Record<string, JsonValue>, formData?: FormData) => void;
  // Called after a price check or prompt boost — both are logged as jobs.
  onPriceCheck?: () => void;
  isSubmitting: boolean;
}

/**
 * Dynamic form for one endpoint: structure from the registry, limits, defaults
 * and options from the selected model. State lives in useEndpointFormState;
 * this component wires it to the layout and builds the request.
 */
export function EndpointForm({ endpoint, prefill, onSubmit, onPriceCheck, isSubmitting }: EndpointFormProps) {
  const { models, isLoading: modelsLoading } = useModelsContext();
  const form = useEndpointFormState(endpoint, prefill);
  const { values, nullableDisabled, arrayMode, files, multiFileMode, selectedModel, selectedModelSlug } = form;
  const model = useModelParams(endpoint, models, selectedModel, values);
  const { isFieldVisible, modelDefaults } = model;
  const { canInlineBoost, inlineBoost, toggleInlineBoost, inlineBoostPayload } = useInlineBoost(endpoint);
  const promptBoost = usePromptBoost({
    endpoint,
    values,
    files,
    selectedModelSlug,
    onChange: form.handleChange,
    onDone: onPriceCheck,
  });

  const isRequestStatusEndpoint = endpoint.id === 'request-status';

  // The request and its price check are built by the same code, so /price
  // validates exactly the payload Execute would send.
  const buildRequest = (priceCalc: boolean): ProxyRequest =>
    buildProxyRequest({
      endpoint,
      values: buildFilteredValues(values, {
        params: endpoint.params,
        isVisible: isFieldVisible,
        arrayMode,
        modelDefaults,
      }),
      boostPayload: inlineBoostPayload,
      appendFiles: (formData) =>
        appendFiles(formData, files, { params: endpoint.params, isVisible: isFieldVisible, multiFileMode }),
      priceCalc,
    });

  const price = usePriceCheck({
    endpoint,
    buildRequest: () => buildRequest(true),
    resetKey: `${endpoint.id}:${prefill?.nonce ?? ''}`,
    onDone: onPriceCheck,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { params, formData } = buildRequest(false);
    onSubmit(params, formData);
  };

  // Categorize params for layout (excluding hidden fields)
  const { promptParams, fileParams, selectParams, booleanParams, compactParams, otherParams } = useMemo(() => {
    const skip = isRequestStatusEndpoint ? ['request_id'] : [];
    return categorizeParams(endpoint.params.filter(isFieldVisible), skip);
  }, [endpoint.params, isRequestStatusEndpoint, isFieldVisible]);

  const fileSections = useMemo(() => groupFileSections(fileParams), [fileParams]);

  const bindings: FieldBindings = {
    values,
    nullableDisabled,
    effectiveParam: model.effectiveParam,
    selectOptions: model.selectOptions,
    onValueChange: form.handleChange,
    onNullableToggle: form.toggleNullable,
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      <FormHeader
        endpoint={endpoint}
        priceResult={price.priceResult}
        isCheckingPrice={price.isCheckingPrice}
        isSubmitting={isSubmitting}
        onCheckPrice={price.checkPrice}
      />

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
                onChange={(e) => form.handleChange('request_id', e.target.value)}
                placeholder="c08a339c-73e5-4d67-a4d5-231302fbff9a"
                className="w-full rounded px-3 py-2 text-sm font-mono bg-[var(--surface)] border border-[var(--border)] focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {promptParams.map((param) => (
            <PromptField
              key={param.name}
              param={param}
              value={String(values[param.name] ?? '')}
              onChange={(value) => form.handleChange(param.name, value)}
              isArrayMode={!!arrayMode[param.name]}
              onToggleArrayMode={() => form.toggleArrayMode(param.name)}
              onBoost={
                promptBoost.canBoost && param.name === promptBoost.enhanceableField && selectedModelSlug
                  ? () => promptBoost.boost(param.name)
                  : undefined
              }
              isBoosting={promptBoost.isBoosting}
              onInlineBoostChange={canInlineBoost && param.name === 'prompt' ? toggleInlineBoost : undefined}
              inlineBoost={inlineBoost}
            />
          ))}

          <FileSections
            sections={fileSections}
            files={files}
            filePreviews={form.filePreviews}
            multiFileMode={multiFileMode}
            maxFiles={model.maxFiles}
            onFileChange={form.handleFileChange}
            onRemoveFile={form.removeFile}
            onReorderFiles={form.reorderFiles}
            onModeChange={form.handleModeChange}
          />
        </div>

        {/* Center: Params with defaults/limits, plus toggles */}
        {(compactParams.length > 0 || booleanParams.length > 0) && (
          <CompactParamsColumn
            compactParams={compactParams}
            booleanParams={booleanParams}
            bindings={bindings}
            fieldDefault={model.fieldDefault}
            fieldLimit={model.fieldLimit}
          />
        )}

        {/* Right: Model & other settings */}
        <SettingsColumn
          selectParams={selectParams}
          otherParams={otherParams}
          bindings={bindings}
          selectedModel={selectedModel}
          modelsLoading={modelsLoading}
          onSetDefaults={form.applyModelDefaults}
        />
      </div>

      {endpoint.params.length === 0 && (
        <div className="flex-1 flex items-center justify-center -mt-12">
          <p className="text-sm text-[var(--muted)]">No parameters required</p>
        </div>
      )}
    </form>
  );
}
