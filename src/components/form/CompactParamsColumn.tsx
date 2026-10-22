'use client';

import { EndpointParam } from '@/lib/types';
import { FieldBindings } from '@/lib/form-utils';
import { FormField } from '@/components/form/FormField';

interface CompactParamsColumnProps {
  compactParams: EndpointParam[];
  booleanParams: EndpointParam[];
  bindings: FieldBindings;
  // The model's default and min-max for a field, shown next to its label.
  fieldDefault: (name: string) => number | undefined;
  fieldLimit: (name: string) => { min?: number; max?: number } | undefined;
}

/** Center column: the numeric params the model sets limits/defaults for, then the toggles. */
export function CompactParamsColumn({
  compactParams,
  booleanParams,
  bindings,
  fieldDefault,
  fieldLimit,
}: CompactParamsColumnProps) {
  const { values, nullableDisabled, effectiveParam, selectOptions, onValueChange, onNullableToggle } = bindings;

  return (
    <div className="w-44 flex-shrink-0 space-y-2 overflow-y-auto border-l border-r border-[var(--border)] px-3">
      <div className="space-y-2">
        {compactParams.map((param) => {
          const defaultVal = fieldDefault(param.name);
          const limit = fieldLimit(param.name);
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
                    {defaultVal !== undefined && <span className="text-green-600 ml-1">def:{defaultVal}</span>}
                  </span>
                )}
              </div>
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
          );
        })}
      </div>

      {booleanParams.length > 0 && (
        <div className="space-y-2 pt-1">
          {booleanParams.map((param) => (
            <div key={param.name}>
              <label className="block text-[10px] text-[var(--muted)] mb-0.5" title={param.description}>
                {param.label}
              </label>
              <FormField
                param={param}
                value={values[param.name]}
                compact
                isNullableDisabled={nullableDisabled[param.name]}
                onValueChange={onValueChange}
                onNullableToggle={onNullableToggle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
