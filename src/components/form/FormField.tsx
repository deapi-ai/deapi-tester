'use client';

import { Dices } from 'lucide-react';
import { EndpointParam, JsonValue } from '@/lib/types';
import { useSettings } from '../SettingsContext';

interface FormFieldProps {
  param: EndpointParam;
  value: JsonValue;
  compact?: boolean;
  isNullableDisabled?: boolean;
  modelsLoading?: boolean;
  selectOptions?: { value: string; label: string }[];
  onValueChange: (name: string, value: JsonValue) => void;
  onNullableToggle?: (name: string, disabled: boolean) => void;
}

export function FormField({
  param,
  value,
  compact = false,
  isNullableDisabled = false,
  modelsLoading = false,
  selectOptions,
  onValueChange,
  onNullableToggle,
}: FormFieldProps) {
  const { strictValidation } = useSettings();
  const baseClass = compact
    ? 'w-full rounded px-2 py-1 text-xs'
    : 'w-full rounded px-2 py-1.5 text-sm';

  const randomizeSeed = () => {
    const randomSeed = Math.floor(Math.random() * 2147483647);
    onValueChange(param.name, randomSeed);
    if (param.nullable && onNullableToggle) {
      onNullableToggle(param.name, false);
    }
  };

  switch (param.type) {
    case 'text':
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onValueChange(param.name, e.target.value)}
          placeholder={param.placeholder}
          className={baseClass}
        />
      );

    case 'textarea':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onValueChange(param.name, e.target.value)}
          placeholder={param.placeholder}
          rows={2}
          className={`${baseClass} resize-y min-h-[50px]`}
        />
      );

    case 'number': {
      const isSeedField = param.name === 'seed';
      return (
        <div className="flex items-center gap-1">
          {param.nullable && onNullableToggle && (
            <label
              className="flex items-center gap-1 cursor-pointer flex-shrink-0"
              title={isNullableDisabled ? 'Enable field' : 'Disable field (set to null)'}
            >
              <input
                type="checkbox"
                checked={!isNullableDisabled}
                onChange={(e) => onNullableToggle(param.name, !e.target.checked)}
                className="w-3 h-3 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600 cursor-pointer"
              />
            </label>
          )}
          <input
            type="number"
            value={isNullableDisabled ? '' : value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onValueChange(param.name, e.target.value ? Number(e.target.value) : null)}
            placeholder={isNullableDisabled ? 'disabled' : param.placeholder}
            min={strictValidation ? param.min : undefined}
            max={strictValidation ? param.max : undefined}
            step={param.step}
            className={`${baseClass} font-mono flex-1 ${isNullableDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={isNullableDisabled}
          />
          {isSeedField && (
            <button
              type="button"
              onClick={randomizeSeed}
              className="p-1 text-[var(--muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border-strong)] rounded transition-colors flex-shrink-0"
              title="Random seed"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }

    case 'select': {
      const options = selectOptions || param.options || [];
      return (
        <div className="flex items-center gap-2">
          {param.nullable && onNullableToggle && (
            <label
              className="flex items-center gap-1 cursor-pointer flex-shrink-0"
              title={isNullableDisabled ? 'Enable field' : "Disable field (don't send)"}
            >
              <input
                type="checkbox"
                checked={!isNullableDisabled}
                onChange={(e) => onNullableToggle(param.name, !e.target.checked)}
                className="w-3 h-3 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600 cursor-pointer"
              />
            </label>
          )}
          <select
            value={isNullableDisabled ? '' : String(value ?? '')}
            onChange={(e) => onValueChange(param.name, e.target.value)}
            className={`${baseClass} flex-1 ${isNullableDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={isNullableDisabled || (param.name === 'model' && modelsLoading)}
          >
            <option value="">
              {param.name === 'model' && modelsLoading ? 'Loading models...' : 'Select...'}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onValueChange(param.name, e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[var(--surface-2)] border-[var(--border-strong)] text-blue-600"
          />
          <span className="text-xs text-[var(--text-secondary)]">Enable</span>
        </label>
      );

    case 'lora-array':
    case 'json':
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onValueChange(param.name, e.target.value)}
          placeholder={param.type === 'lora-array' ? '[{"name": "...", "weight": 0.8}]' : '{}'}
          rows={2}
          className={`${baseClass} font-mono resize-y`}
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onValueChange(param.name, e.target.value)}
          className={baseClass}
        />
      );
  }
}
