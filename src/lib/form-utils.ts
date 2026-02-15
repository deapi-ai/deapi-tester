import { EndpointParam } from '@/lib/types';
import { COMPACT_FORM_FIELDS } from '@/lib/constants';

export interface CategorizedParams {
  promptParams: EndpointParam[];
  fileParams: EndpointParam[];
  selectParams: EndpointParam[];
  booleanParams: EndpointParam[];
  compactParams: EndpointParam[];
  otherParams: EndpointParam[];
}

/**
 * Categorize endpoint params for form layout
 */
export function categorizeParams(
  params: EndpointParam[],
  skipParams: string[] = []
): CategorizedParams {
  const promptParams: EndpointParam[] = [];
  const fileParams: EndpointParam[] = [];
  const selectParams: EndpointParam[] = [];
  const booleanParams: EndpointParam[] = [];
  const compactParams: EndpointParam[] = [];
  const otherParams: EndpointParam[] = [];

  params.forEach((param) => {
    if (skipParams.includes(param.name)) {
      return;
    }
    if (param.name === 'prompt' || param.name === 'negative_prompt' || param.type === 'textarea' || param.name === 'video_url' || param.name === 'audio_url') {
      promptParams.push(param);
    } else if (param.type === 'file') {
      fileParams.push(param);
    } else if (COMPACT_FORM_FIELDS.includes(param.name)) {
      compactParams.push(param);
    } else if (param.type === 'select' || param.name === 'model') {
      selectParams.push(param);
    } else if (param.type === 'boolean') {
      booleanParams.push(param);
    } else {
      otherParams.push(param);
    }
  });

  return { promptParams, fileParams, selectParams, booleanParams, compactParams, otherParams };
}

/**
 * Map field names to model feature names
 */
export const FIELD_TO_FEATURE_MAP: Record<string, string> = {
  steps: 'supports_steps',
  guidance: 'supports_guidance',
  negative_prompt: 'supports_negative_prompt',
  width: 'supports_custom_output_size',
  height: 'supports_custom_output_size',
};

/**
 * Fallback values for unsupported fields when model provides no default.
 * guidance=0: API requires guidance but unsupported models need 0.
 * steps=8: some distilled models require fixed steps (e.g. LTX2 needs exactly 8).
 */
export const UNSUPPORTED_FIELD_FALLBACKS: Record<string, number> = {
  guidance: 1,
  steps: 8,
};

/**
 * Fields that can have model defaults
 */
export const DEFAULTABLE_FIELDS = [
  'width',
  'height',
  'steps',
  'frames',
  'fps',
  'speed',
  'guidance',
  'cfg_scale',
  'num_inference_steps',
  'seed',
];

/**
 * Generate image preview data from file
 */
export function generateImagePreview(
  file: File
): Promise<{ url: string; width: number; height: number; format: string; size: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: file.name.split('.').pop()?.toUpperCase() || file.type.split('/')[1]?.toUpperCase() || 'IMG',
        size: file.size,
      });
    };
    img.onerror = () => {
      resolve({
        url,
        width: 0,
        height: 0,
        format: file.name.split('.').pop()?.toUpperCase() || 'IMG',
        size: file.size,
      });
    };
    img.src = url;
  });
}
