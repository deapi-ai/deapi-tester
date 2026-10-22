'use client';

import { ChevronRight, RotateCcw } from 'lucide-react';
import { DeApiModel, EndpointParam } from '@/lib/types';
import { FieldBindings } from '@/lib/form-utils';
import { FormField } from '@/components/form/FormField';
import { ModelInfo } from '@/components/ModelInfo';

interface SettingsColumnProps {
  selectParams: EndpointParam[];
  otherParams: EndpointParam[];
  bindings: FieldBindings;
  selectedModel: DeApiModel | undefined;
  modelsLoading: boolean;
  onSetDefaults: () => void;
}

/** Right column: the model and other selects, model info, and the "More options" fold. */
export function SettingsColumn({
  selectParams,
  otherParams,
  bindings,
  selectedModel,
  modelsLoading,
  onSetDefaults,
}: SettingsColumnProps) {
  const { values, nullableDisabled, effectiveParam, selectOptions, onValueChange, onNullableToggle } = bindings;

  return (
    <div className="w-48 flex-shrink-0 space-y-2 overflow-y-auto">
      {selectParams.map((param) => (
        <div key={param.name}>
          <label className="flex items-baseline gap-1 text-[10px] text-[var(--muted)] mb-1">
            {param.label}
            {param.required && <span className="text-red-500">*</span>}
          </label>
          <FormField
            param={effectiveParam(param)}
            value={values[param.name]}
            compact
            isNullableDisabled={nullableDisabled[param.name]}
            modelsLoading={modelsLoading}
            selectOptions={selectOptions(param.name)}
            onValueChange={onValueChange}
            onNullableToggle={onNullableToggle}
          />
          {param.name === 'model' && (
            <>
              {selectedModel && (
                <button
                  type="button"
                  onClick={onSetDefaults}
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
                  param={effectiveParam(param)}
                  value={values[param.name]}
                  compact
                  isNullableDisabled={nullableDisabled[param.name]}
                  selectOptions={selectOptions(param.name)}
                  onValueChange={onValueChange}
                  onNullableToggle={onNullableToggle}
                />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
