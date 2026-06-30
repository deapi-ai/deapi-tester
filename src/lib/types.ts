// Form parameter types
export type ParamType = 'text' | 'textarea' | 'number' | 'select' | 'file' | 'boolean' | 'json' | 'lora-array';

export interface EndpointParam {
  name: string;
  label: string;
  type: ParamType;
  required: boolean;
  default?: string | number | boolean | null;
  placeholder?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];  // for select
  accept?: string;  // for file (e.g. "image/*")
  nullable?: boolean;  // allows field to be disabled/set to null via toggle
  multiple?: boolean;  // for file: allows multiple file selection (array)
  multiFieldName?: string;  // for file with multiple: alternative field name when in multi mode (e.g. "images")
  isPathParam?: boolean;  // for params that go in URL path (e.g. /request-status/{request_id})
  supportsArray?: boolean;  // allows toggling between single value and array of values (one per line)
  visibleWhen?: { field: string; values: string[]; matchEmpty?: boolean };  // conditional visibility based on another field's value
  valueType?: 'number';  // for select fields: convert string value to number in payload
}

export interface EndpointDefinition {
  id: string;
  name: string;
  group: EndpointGroup;
  method: 'GET' | 'POST';
  path: string;                    // e.g. "/images/generations"
  description: string;
  contentType: 'json' | 'multipart';
  isAsync: boolean;                // returns request_id for polling
  hasPriceCalc: boolean;           // has price-calculation endpoint
  priceCalcPath?: string;          // e.g. "/images/generations/price"
  inferenceType?: string;          // maps to model inference_types when different from id (e.g. "vid_upscale" for id "vid-upscale")
  params: EndpointParam[];
}

export type EndpointGroup =
  | 'image-generation'
  | 'video-generation'
  | 'audio-generation'
  | 'music-generation'
  | 'transcription'
  | 'ocr'
  | 'image-utils'
  | 'embeddings'
  | 'prompt-enhancement'
  | 'utility';

export interface EndpointGroupMeta {
  id: EndpointGroup;
  label: string;
  icon: string;        // emoji or lucide icon name
  description: string;
}

// Generic JSON type for API responses
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// An uploaded file persisted to disk (content-addressed), so a multipart
// request can be duplicated with its files intact. Stored on the Job.
export interface UploadedFile {
  field: string;        // form field name as sent (e.g. "image", "images[]", "ref_audio")
  fileName: string;     // original file name
  storedName: string;   // on-disk name: "<sha256>.<ext>" (dedup key for ref-counting)
  mimeType: string;
  size: number;         // bytes
}

// Job / history
export interface Job {
  id: string;                      // uuid
  requestId: string;               // deAPI request_id
  endpointId: string;              // from registry
  params: Record<string, JsonValue>; // sent parameters
  rawRequest: {                    // raw HTTP request
    method: string;
    url: string;
    headers: Record<string, string>;
    body: JsonValue;
  };
  rawResponse?: JsonValue;         // raw HTTP response from deAPI
  rawResponseHeaders?: Record<string, string>; // response HTTP headers from deAPI (submit response)
  uploadedFiles?: UploadedFile[];  // persisted multipart uploads (for duplicate)
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  resultUrl?: string;              // result URL from deAPI
  localPath?: string;              // path to downloaded file
  error?: string;
  createdAt: string;               // ISO timestamp
  completedAt?: string;
  costCredits?: number;
}

// Configuration Profile (for multiple API keys/environments)
export interface ConfigProfile {
  id: string;                      // uuid
  name: string;                    // user-friendly name (e.g. "Production", "Dev")
  apiUrl: string;
  apiToken: string;
}

// Full configuration with multiple profiles
export interface AppConfigFull {
  activeProfileId: string;
  profiles: ConfigProfile[];
  outputDir: string;
  pollingIntervalMs: number;       // default 2000
  maxPollingAttempts: number;      // default 120 (4 minutes)
}

// Flat configuration (for backward compatibility with existing code)
export interface AppConfig {
  apiUrl: string;
  apiToken: string;
  outputDir: string;
  pollingIntervalMs?: number;      // default 2000
  maxPollingAttempts?: number;     // default 120 (4 minutes)
}

// Model data from deAPI /models endpoint
export interface ModelLora {
  display_name: string;
  name: string;
}

export interface ModelVoice {
  name: string;
  slug: string;
  gender: 'male' | 'female';
}

export interface ModelLanguage {
  name: string;
  slug: string;
  voices: ModelVoice[];
}

export interface ModelFeatures {
  supports_steps?: boolean;
  supports_guidance?: boolean;
  supports_negative_prompt?: boolean;
  supports_last_frame?: boolean;
  supports_custom_output_size?: boolean;
}

export interface ModelLimits {
  max_steps?: number;
  min_steps?: number;
  max_width?: number;
  min_width?: number;
  max_height?: number;
  min_height?: number;
  max_frames?: number;
  min_frames?: number;
  max_fps?: number;
  min_fps?: number;
  max_text?: number;
  min_text?: number;
  max_speed?: number;
  min_speed?: number;
  max_input_tokens?: number;
  max_total_tokens?: number;
  resolution_step?: number;
  available_ratios?: number[];
  max_input_images?: number;
  min_scale?: number;
  max_scale?: number;
  max_video_duration_seconds?: number;
}

export interface ModelDefaults {
  steps?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  prompt?: string;
  negative_prompt?: string;
  lang?: string;
  speed?: number;
  voice?: string;
  format?: string;
  sample_rate?: number;
}

export interface ModelInfo {
  limits?: ModelLimits;
  defaults?: ModelDefaults;
  features?: ModelFeatures;
}

export interface DeApiModel {
  name: string;
  slug: string;
  // v2 returns this as an object keyed by inference type; v1 returned a string array.
  inference_types: string[] | Record<string, unknown>;
  info: ModelInfo | [];
  loras?: ModelLora[];
  languages?: ModelLanguage[];
}
