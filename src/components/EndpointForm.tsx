'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Upload, Loader2, CircleDollarSign, Play, ChevronRight } from 'lucide-react';
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
  const [imagePreviews, setImagePreviews] = useState<Record<string, { url: string; width: number; height: number; format: string; size: number }[]>>({});
  const [isCheckingPrice, setIsCheckingPrice] = useState(false);
  const [priceResult, setPriceResult] = useState<{ credits: number; error?: string } | null>(null);
  const { models, isLoading: modelsLoading, getModelBySlug } = useModelsContext();

  // Check if this is the request-status endpoint
  const isRequestStatusEndpoint = endpoint.id === 'request-status';

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
    // Cleanup old preview URLs
    setImagePreviews(prev => {
      Object.values(prev).flat().forEach(p => URL.revokeObjectURL(p.url));
      return {};
    });
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
    // Cleanup old preview URLs
    setImagePreviews((prev) => {
      const oldPreviews = prev[name];
      if (oldPreviews) {
        oldPreviews.forEach(p => URL.revokeObjectURL(p.url));
      }
      const newPreviews = { ...prev };
      delete newPreviews[name];
      return newPreviews;
    });

    if (file) {
      setFiles((prev) => ({ ...prev, [name]: file }));

      // Generate previews for image files
      const fileArray = Array.isArray(file) ? file : [file];
      const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        const previewPromises = imageFiles.map(f => {
          return new Promise<{ url: string; width: number; height: number; format: string; size: number }>((resolve) => {
            const url = URL.createObjectURL(f);
            const img = new Image();
            img.onload = () => {
              resolve({
                url,
                width: img.naturalWidth,
                height: img.naturalHeight,
                format: f.name.split('.').pop()?.toUpperCase() || f.type.split('/')[1]?.toUpperCase() || 'IMG',
                size: f.size,
              });
            };
            img.onerror = () => {
              resolve({
                url,
                width: 0,
                height: 0,
                format: f.name.split('.').pop()?.toUpperCase() || 'IMG',
                size: f.size,
              });
            };
            img.src = url;
          });
        });

        Promise.all(previewPromises).then(previews => {
          setImagePreviews(prev => ({ ...prev, [name]: previews }));
        });
      }
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

  const removeFile = useCallback((name: string, index: number) => {
    const currentFiles = files[name];
    if (!currentFiles) return;

    const fileArray = Array.isArray(currentFiles) ? currentFiles : [currentFiles];

    // If only one file, clear everything
    if (fileArray.length <= 1) {
      handleFileChange(name, null);
      return;
    }

    // Remove file at index
    const newFiles = fileArray.filter((_, i) => i !== index);
    setFiles(prev => ({ ...prev, [name]: newFiles }));

    // Remove preview at index and revoke URL
    setImagePreviews(prev => {
      const prevPreviews = prev[name] || [];
      if (prevPreviews[index]) {
        URL.revokeObjectURL(prevPreviews[index].url);
      }
      return {
        ...prev,
        [name]: prevPreviews.filter((_, i) => i !== index),
      };
    });
  }, [files, handleFileChange]);

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
        const previews = imagePreviews[param.name] || [];

        const formatFileSize = (bytes: number) => {
          if (bytes < 1024) return `${bytes}B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        };

        return (
          <div className="flex flex-col gap-2">
            {/* Mode switch for fields with multiFieldName */}
            {param.multiFieldName && (
              <div className="flex items-center gap-2">
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

            {/* Image previews */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeFile(param.name, idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Remove"
                    >
<X className="w-2.5 h-2.5 text-white" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt=""
                      className="h-20 w-auto rounded border border-[var(--border)] object-contain bg-zinc-900"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[9px] font-mono text-zinc-300 rounded-b">
                      {preview.format} · {preview.width}×{preview.height} · {formatFileSize(preview.size)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded cursor-pointer hover:border-zinc-600 transition-colors">
<Upload className="w-3 h-3 text-zinc-500 flex-shrink-0" />
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
    // Skip request_id for request-status endpoint (it's shown in left panel)
    if (isRequestStatusEndpoint && param.name === 'request_id') {
      return;
    }
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

        {/* Execute button */}
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

      {/* Form Content - Horizontal Layout */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        {/* Left: Prompts & Files (or Result for request-status) */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          {/* Request Status - show request_id input prominently */}
          {isRequestStatusEndpoint && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">
                Request ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={String(values['request_id'] ?? '')}
                onChange={(e) => handleChange('request_id', e.target.value)}
                placeholder="c08a339c-73e5-4d67-a4d5-231302fbff9a"
                className="w-full rounded px-3 py-2 text-sm font-mono bg-zinc-900 border border-[var(--border)] focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          )}

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
        <div className="w-48 flex-shrink-0 space-y-2 overflow-y-auto">
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
                <ChevronRight className="w-2 h-2 transition-transform group-open:rotate-90" />
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
