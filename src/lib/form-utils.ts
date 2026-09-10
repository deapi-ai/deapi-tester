import { EndpointParam } from '@/lib/types';
import { COMPACT_FORM_FIELDS } from '@/lib/constants';
import { MediaKind, mediaKindFromFile } from '@/lib/media-types';

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
    if (param.name === 'prompt' || param.name === 'negative_prompt' || param.type === 'textarea' || param.name === 'source_url') {
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
 * Check whether a model supports a given inference type.
 * deAPI v2 returns `inference_types` as an object keyed by type; v1 returned a
 * string array. This handles both shapes so model dropdowns stay populated.
 */
export function modelMatchesInferenceType(
  model: { inference_types: string[] | Record<string, unknown> },
  inferenceType: string
): boolean {
  const types = model.inference_types;
  if (Array.isArray(types)) return types.includes(inferenceType);
  if (types && typeof types === 'object') return inferenceType in types;
  return false;
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
 * Preview metadata for one chosen file, kept 1:1 with the field's file list so
 * a tile, its index badge and the file it stands for can never drift apart.
 */
export interface FilePreview {
  url: string;        // object URL, revoked when the file leaves the field
  kind: MediaKind;
  name: string;
  size: number;
  format: string;     // extension, uppercased
  width?: number;     // image/video only
  height?: number;    // image/video only
  duration?: number;  // video/audio only, seconds
}

// A file the browser cannot decode (an exotic codec, a mislabelled extension)
// never fires loadedmetadata, so the probe resolves on whatever it has by then.
const PROBE_TIMEOUT_MS = 5000;

function extensionOf(file: File): string {
  return (
    file.name.split('.').pop()?.toUpperCase() ||
    file.type.split('/')[1]?.toUpperCase() ||
    'FILE'
  );
}

/**
 * Build preview metadata for a file: dimensions for images and videos, duration
 * for videos and audio, and always an object URL the tile can render from.
 */
export function generateFilePreview(file: File): Promise<FilePreview> {
  const url = URL.createObjectURL(file);
  const kind = mediaKindFromFile(file);
  const base: FilePreview = { url, kind, name: file.name, size: file.size, format: extensionOf(file) };

  if (kind === 'other') return Promise.resolve(base);

  return new Promise<FilePreview>((resolve) => {
    let settled = false;
    const finish = (extra: Partial<FilePreview>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...base, ...extra });
    };
    const timer = setTimeout(() => finish({}), PROBE_TIMEOUT_MS);

    if (kind === 'image') {
      const img = new Image();
      img.onload = () => finish({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => finish({});
      img.src = url;
      return;
    }

    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : undefined;
      finish(
        kind === 'video'
          ? {
              duration,
              width: (el as HTMLVideoElement).videoWidth,
              height: (el as HTMLVideoElement).videoHeight,
            }
          : { duration }
      );
    };
    el.onerror = () => finish({});
    el.src = url;
  });
}
