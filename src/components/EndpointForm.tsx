'use client';

import { useState, useEffect, useCallback } from 'react';
import { EndpointDefinition, EndpointParam, JsonValue } from '@/lib/types';

interface EndpointFormProps {
  endpoint: EndpointDefinition;
  onSubmit: (params: Record<string, JsonValue>, formData?: FormData) => void;
  isSubmitting: boolean;
}

export function EndpointForm({ endpoint, onSubmit, isSubmitting }: EndpointFormProps) {
  const [values, setValues] = useState<Record<string, JsonValue>>({});
  const [files, setFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    const defaults: Record<string, JsonValue> = {};
    endpoint.params.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    });
    setValues(defaults);
    setFiles({});
  }, [endpoint.id, endpoint.params]);

  const handleChange = useCallback((name: string, value: JsonValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback((name: string, file: File | null) => {
    if (file) {
      setFiles((prev) => ({ ...prev, [name]: file }));
    } else {
      setFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[name];
        return newFiles;
      });
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (endpoint.contentType === 'multipart') {
      const formData = new FormData();
      formData.append('_endpointId', endpoint.id);

      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, String(value));
        }
      });

      Object.entries(files).forEach(([key, file]) => {
        formData.append(key, file);
      });

      onSubmit(values, formData);
    } else {
      onSubmit({ ...values, _endpointId: endpoint.id });
    }
  };

  const renderField = (param: EndpointParam, compact = false) => {
    const value = values[param.name];
    const baseClass = compact
      ? "w-full rounded px-2 py-1 text-xs"
      : "w-full rounded px-2 py-1.5 text-sm";

    switch (param.type) {
      case 'text':
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => handleChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            className={baseClass}
            required={param.required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => handleChange(param.name, e.target.value)}
            placeholder={param.placeholder}
            rows={2}
            className={`${baseClass} resize-y min-h-[50px]`}
            required={param.required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleChange(param.name, e.target.value ? Number(e.target.value) : null)}
            placeholder={param.placeholder}
            min={param.min}
            max={param.max}
            step={param.step}
            className={`${baseClass} font-mono`}
            required={param.required}
          />
        );

      case 'select':
        return (
          <select
            value={String(value ?? '')}
            onChange={(e) => handleChange(param.name, e.target.value)}
            className={baseClass}
            required={param.required}
          >
            <option value="">Select...</option>
            {param.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleChange(param.name, e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-700 text-blue-600"
            />
            <span className="text-xs text-zinc-400">Enable</span>
          </label>
        );

      case 'file':
        return (
          <label className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded cursor-pointer hover:border-zinc-600 transition-colors">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500 flex-shrink-0">
              <path d="M8 12V4M4 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 12v2H2v-2" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-zinc-400 truncate flex-1">
              {files[param.name] ? files[param.name].name : 'Choose file...'}
            </span>
            <input
              type="file"
              accept={param.accept}
              onChange={(e) => handleFileChange(param.name, e.target.files?.[0] || null)}
              className="hidden"
              required={param.required}
            />
          </label>
        );

      case 'lora-array':
      case 'json':
        return (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => handleChange(param.name, e.target.value)}
            placeholder={param.type === 'lora-array' ? '[{"name": "...", "weight": 0.8}]' : '{}'}
            rows={2}
            className={`${baseClass} font-mono resize-y`}
            required={param.required}
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => handleChange(param.name, e.target.value)}
            className={baseClass}
          />
        );
    }
  };

  // Categorize params
  const compactFields = ['width', 'height', 'steps', 'seed', 'guidance', 'frames', 'fps', 'speed', 'cfg_scale', 'num_inference_steps'];
  const promptParams: EndpointParam[] = [];
  const fileParams: EndpointParam[] = [];
  const selectParams: EndpointParam[] = [];
  const compactParams: EndpointParam[] = [];
  const otherParams: EndpointParam[] = [];

  endpoint.params.forEach(param => {
    if (param.name === 'prompt' || param.name === 'negative_prompt' || param.type === 'textarea') {
      promptParams.push(param);
    } else if (param.type === 'file') {
      fileParams.push(param);
    } else if (param.type === 'select' || param.name === 'model') {
      selectParams.push(param);
    } else if (param.type === 'number' && compactFields.includes(param.name)) {
      compactParams.push(param);
    } else {
      otherParams.push(param);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
        <h3 className="text-sm font-medium text-zinc-200">{endpoint.name}</h3>
        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">{endpoint.method}</span>
        <span className="text-[10px] font-mono text-zinc-600">{endpoint.path}</span>
        {endpoint.isAsync && (
          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">async</span>
        )}
      </div>

      {/* Form Content - Horizontal Layout */}
      <div className="flex-1 flex gap-4 p-4 pb-2 overflow-hidden min-h-0">
        {/* Left: Prompts & Files */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          {promptParams.map((param) => (
            <div key={param.name} className="flex flex-col min-h-0">
              <label className="flex items-baseline gap-1 text-xs text-zinc-400 mb-1 flex-shrink-0">
                {param.label}
                {param.required && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={String(values[param.name] ?? '')}
                onChange={(e) => handleChange(param.name, e.target.value)}
                placeholder={param.placeholder}
                className="w-full rounded px-2 py-1.5 text-sm resize-none min-h-[60px] flex-1"
                required={param.required}
              />
            </div>
          ))}

          {fileParams.length > 0 && (
            <div className="flex gap-2 flex-wrap flex-shrink-0">
              {fileParams.map((param) => (
                <div key={param.name} className="flex-1 min-w-[200px]">
                  <label className="flex items-baseline gap-1 text-xs text-zinc-400 mb-1">
                    {param.label}
                    {param.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderField(param)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Settings */}
        <div className="w-56 flex-shrink-0 space-y-2 overflow-y-auto">
          {/* Model/Select params */}
          {selectParams.map((param) => (
            <div key={param.name}>
              <label className="flex items-baseline gap-1 text-[10px] text-zinc-500 mb-1">
                {param.label}
                {param.required && <span className="text-red-500">*</span>}
              </label>
              {renderField(param, true)}
            </div>
          ))}

          {/* Compact number fields */}
          {compactParams.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {compactParams.map((param) => (
                <div key={param.name}>
                  <label className="flex items-baseline gap-1 text-[10px] text-zinc-500 mb-1">
                    {param.label}
                    {param.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderField(param, true)}
                </div>
              ))}
            </div>
          )}

          {/* Other params */}
          {otherParams.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-400 py-1">
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="currentColor"
                  className="transition-transform group-open:rotate-90"
                >
                  <path d="M2 0l4 4-4 4" />
                </svg>
                More options ({otherParams.length})
              </summary>
              <div className="mt-2 space-y-2">
                {otherParams.map((param) => (
                  <div key={param.name}>
                    <label className="flex items-baseline gap-1 text-[10px] text-zinc-500 mb-1">
                      {param.label}
                    </label>
                    {renderField(param, true)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Footer with Execute button - always visible */}
      <div className="flex-shrink-0 px-4 pb-3 pt-1 border-t border-[var(--border-dim)]">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
              </svg>
              Submitting...
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 1l8 5-8 5V1z" />
              </svg>
              Execute
            </>
          )}
        </button>
      </div>

      {/* No params message */}
      {endpoint.params.length === 0 && (
        <div className="flex-1 flex items-center justify-center -mt-12">
          <p className="text-sm text-zinc-500">No parameters required</p>
        </div>
      )}
    </form>
  );
}
