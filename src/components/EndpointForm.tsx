'use client';

import { useState, useEffect, useCallback } from 'react';
import { EndpointDefinition, EndpointParam, JsonValue } from '@/lib/types';
import { useModelsContext } from '@/components/ModelsContext';
import { ModelInfo } from '@/components/ModelInfo';

interface EndpointFormProps {
  endpoint: EndpointDefinition;
  onSubmit: (params: Record<string, JsonValue>, formData?: FormData) => void;
  onPriceCheck?: () => void;
  isSubmitting: boolean;
}

export function EndpointForm({ endpoint, onSubmit, onPriceCheck, isSubmitting }: EndpointFormProps) {
  const [values, setValues] = useState<Record<string, JsonValue>>({});
  const [files, setFiles] = useState<Record<string, File | File[]>>({});
  const [nullableDisabled, setNullableDisabled] = useState<Record<string, boolean>>({});
  const [multiFileMode, setMultiFileMode] = useState<Record<string, boolean>>({});
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [priceResult, setPriceResult] = useState<{ credits: number; error?: string } | null>(null);
  const { models, isLoading: modelsLoading, getModelBySlug } = useModelsContext();

  // Get selected model info
  const selectedModelSlug = values['model'] as string | undefined;
  const selectedModel = selectedModelSlug ? getModelBySlug(selectedModelSlug) : undefined;

  useEffect(() => {
    const defaults: Record<string, JsonValue> = {};
    const nullableDefaults: Record<string, boolean> = {};
    const multiFileModeDefaults: Record<string, boolean> = {};
    endpoint.params.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
      // Nullable fields start disabled (null) by default
      if (param.nullable) {
        nullableDefaults[param.name] = param.default === null;
      }
      // Multi file mode starts as false (single file mode)
      if (param.multiFieldName) {
        multiFileModeDefaults[param.name] = false;
      }
    });
    setValues(defaults);
    setFiles({});
    setNullableDisabled(nullableDefaults);
    setMultiFileMode(multiFileModeDefaults);
    setPriceResult(null);
  }, [endpoint.id, endpoint.params]);

  // Reset model selection when dynamic models change (e.g., profile switch)
  useEffect(() => {
    if (models.length === 0) return;

    const modelParam = endpoint.params.find(p => p.name === 'model');
    if (!modelParam) return;

    const currentModel = values['model'] as string | undefined;
    if (!currentModel) return;

    // Check if current model exists in the new model list for this inference type
    const inferenceType = endpoint.id;
    const filteredModels = models.filter(m => m.inference_types.includes(inferenceType));
    const modelExists = filteredModels.some(m => m.slug === currentModel);

    // If current model doesn't exist, select first available or clear
    if (!modelExists) {
      if (filteredModels.length > 0) {
        setValues(prev => ({ ...prev, model: filteredModels[0].slug }));
      } else {
        setValues(prev => ({ ...prev, model: '' }));
      }
    }
  }, [models, endpoint.id, endpoint.params]);

  const handleChange = useCallback((name: string, value: JsonValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback((name: string, file: File | File[] | null) => {
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

  const toggleNullable = useCallback((name: string, disabled: boolean) => {
    setNullableDisabled((prev) => ({ ...prev, [name]: disabled }));
    if (disabled) {
      setValues((prev) => ({ ...prev, [name]: null }));
    }
  }, []);

  const handleCheckPrice = async () => {
    if (!endpoint.hasPriceCalc) return;

    setIsCheckingPrice(true);
    setPriceResult(null);

    try {
      // Filter out disabled nullable fields
      const filteredValues: Record<string, JsonValue> = {};
      Object.entries(values).forEach(([key, value]) => {
        if (value !== null) {
          filteredValues[key] = value;
        }
      });

      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...filteredValues,
          _endpointId: endpoint.id,
          _priceCalc: true,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setPriceResult({ credits: 0, error: data.error || 'Failed to calculate' });
        return;
      }

      // Extract price from rawResponse
      const price = data.rawResponse?.data?.price || 0;
      setPriceResult({ credits: price });

      // Refresh jobs panel
      onPriceCheck?.();
    } catch (err) {
      setPriceResult({ credits: 0, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setIsCheckingPrice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out disabled nullable fields (null values)
    const filteredValues: Record<string, JsonValue> = {};
    Object.entries(values).forEach(([key, value]) => {
      // Skip null values (from disabled nullable fields)
      if (value !== null) {
        filteredValues[key] = value;
      }
    });

    if (endpoint.contentType === 'multipart') {
      const formData = new FormData();
      formData.append('_endpointId', endpoint.id);

      Object.entries(filteredValues).forEach(([key, value]) => {
        // Skip undefined and empty strings
        if (value !== undefined && value !== '') {
          formData.append(key, String(value));
        }
      });

      Object.entries(files).forEach(([key, fileOrFiles]) => {
        // Check if this field has multi mode and get the correct field name
        const param = endpoint.params.find(p => p.name === key);
        const isMultiMode = param?.multiFieldName && multiFileMode[key];
        const fieldName = (isMultiMode && param?.multiFieldName) ? param.multiFieldName : key;

        if (Array.isArray(fileOrFiles)) {
          // Multiple files - append each with same key
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
        const isNullableDisabled = param.nullable && nullableDisabled[param.name];
        return (
          <div className="flex items-center gap-2">
            {param.nullable && (
              <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" title={isNullableDisabled ? "Enable field" : "Disable field (set to null)"}>
                <input
                  type="checkbox"
                  checked={!isNullableDisabled}
                  onChange={(e) => toggleNullable(param.name, !e.target.checked)}
                  className="w-3 h-3 rounded bg-zinc-800 border-zinc-700 text-blue-600 cursor-pointer"
                />
              </label>
            )}
            <input
              type="number"
              value={isNullableDisabled ? '' : (value !== undefined && value !== null ? String(value) : '')}
              onChange={(e) => handleChange(param.name, e.target.value ? Number(e.target.value) : null)}
              placeholder={isNullableDisabled ? 'disabled' : param.placeholder}
              min={param.min}
              max={param.max}
              step={param.step}
              className={`${baseClass} font-mono flex-1 ${isNullableDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              required={param.required && !param.nullable}
              disabled={isNullableDisabled}
            />
          </div>
        );

      case 'select':
        const isSelectDisabled = param.nullable && nullableDisabled[param.name];

        // For model field, use dynamic models from API filtered by inference type
        let selectOptions = param.options || [];
        if (param.name === 'model') {
          // Map endpoint id to inference type (most are the same, e.g., txt2img -> txt2img)
          const inferenceType = endpoint.id;
          const filteredModels = models.filter(m =>
            m.inference_types.includes(inferenceType)
          );

          if (filteredModels.length > 0) {
            selectOptions = filteredModels.map(m => ({
              value: m.slug,
              label: m.name,
            }));
          }
          // If no dynamic models, fall back to static options from registry
        }

        return (
          <div className="flex items-center gap-2">
            {param.nullable && (
              <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" title={isSelectDisabled ? "Enable field" : "Disable field (don't send)"}>
                <input
                  type="checkbox"
                  checked={!isSelectDisabled}
                  onChange={(e) => toggleNullable(param.name, !e.target.checked)}
                  className="w-3 h-3 rounded bg-zinc-800 border-zinc-700 text-blue-600 cursor-pointer"
                />
              </label>
            )}
            <select
              value={isSelectDisabled ? '' : String(value ?? '')}
              onChange={(e) => handleChange(param.name, e.target.value)}
              className={`${baseClass} flex-1 ${isSelectDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              required={param.required && !param.nullable}
              disabled={isSelectDisabled || (param.name === 'model' && modelsLoading)}
            >
              <option value="">{param.name === 'model' && modelsLoading ? 'Loading models...' : 'Select...'}</option>
              {selectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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
        const currentFiles = files[param.name];
        const isMultiMode = !!(param.multiFieldName && multiFileMode[param.name]);
        const fileArray = currentFiles ? (Array.isArray(currentFiles) ? currentFiles : [currentFiles]) : [];
        const fileCount = fileArray.length;
        const fileLabel = fileCount === 0
          ? (isMultiMode ? 'Choose file(s)...' : 'Choose file...')
          : fileCount === 1
            ? fileArray[0].name
            : `${fileCount} files selected`;

        return (
          <div className="flex flex-col gap-1">
            {/* Mode switch for fields with multiFieldName */}
            {param.multiFieldName && (
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setMultiFileMode(prev => ({ ...prev, [param.name]: false }));
                    // Clear files when switching mode
                    handleFileChange(param.name, null);
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    !isMultiMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  Single ({param.name})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMultiFileMode(prev => ({ ...prev, [param.name]: true }));
                    // Clear files when switching mode
                    handleFileChange(param.name, null);
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    isMultiMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  Multiple ({param.multiFieldName})
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded cursor-pointer hover:border-zinc-600 transition-colors">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500 flex-shrink-0">
                <path d="M8 12V4M4 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 12v2H2v-2" strokeLinecap="round" />
              </svg>
              <span className="text-xs text-zinc-400 truncate flex-1">
                {fileLabel}
              </span>
              {isMultiMode && fileCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  {fileCount}
                </span>
              )}
              <input
                type="file"
                accept={param.accept}
                multiple={isMultiMode}
                onChange={(e) => {
                  const selectedFiles = e.target.files;
                  if (!selectedFiles || selectedFiles.length === 0) {
                    handleFileChange(param.name, null);
                  } else if (isMultiMode) {
                    handleFileChange(param.name, Array.from(selectedFiles));
                  } else {
                    handleFileChange(param.name, selectedFiles[0]);
                  }
                }}
                className="hidden"
                required={param.required && fileCount === 0}
              />
            </label>
            {isMultiMode && fileCount > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {fileArray.map((file, idx) => (
                  <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded truncate max-w-[150px]" title={file.name}>
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>
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
        <div className="flex-1" />

        {/* Price result display */}
        {priceResult && (
          <span className={`text-xs font-mono ${priceResult.error ? 'text-red-400' : 'text-green-400'}`}>
            {priceResult.error ? priceResult.error : `~$${priceResult.credits}`}
          </span>
        )}

        {/* Check Price button */}
        {endpoint.hasPriceCalc && (
          <button
            type="button"
            onClick={handleCheckPrice}
            disabled={isCheckingPrice || isSubmitting}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isCheckingPrice ? (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                  <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
                </svg>
                Checking...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4v4M6 6.5c0-1 .7-1.5 2-1.5s2 .5 2 1.5-.7 1.5-2 1.5v2" strokeLinecap="round" />
                </svg>
                Check Price
              </>
            )}
          </button>
        )}

        {/* Execute button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed rounded px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
              </svg>
              Submitting...
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 1l8 5-8 5V1z" />
              </svg>
              Execute
            </>
          )}
        </button>
      </div>

      {/* Form Content - Horizontal Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
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
              {/* Show model info for model select */}
              {param.name === 'model' && (
                <ModelInfo model={selectedModel} isLoading={modelsLoading && !selectedModel} />
              )}
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

      {/* No params message */}
      {endpoint.params.length === 0 && (
        <div className="flex-1 flex items-center justify-center -mt-12">
          <p className="text-sm text-zinc-500">No parameters required</p>
        </div>
      )}
    </form>
  );
}
