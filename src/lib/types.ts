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
}

export interface EndpointDefinition {
  id: string;
  name: string;
  group: EndpointGroup;
  method: 'GET' | 'POST';
  path: string;                    // e.g. "/txt2img"
  description: string;
  contentType: 'json' | 'multipart';
  isAsync: boolean;                // returns request_id for polling
  hasPriceCalc: boolean;           // has price-calculation endpoint
  priceCalcPath?: string;          // e.g. "/txt2img/price-calculation"
  params: EndpointParam[];
}

export type EndpointGroup =
  | 'image-generation'
  | 'video-generation'
  | 'audio-generation'
  | 'transcription'
  | 'ocr'
  | 'image-utils'
  | 'embeddings'
  | 'utility';

export interface EndpointGroupMeta {
  id: EndpointGroup;
  label: string;
  icon: string;        // emoji or lucide icon name
  description: string;
}

// Generic JSON type for API responses
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  resultUrl?: string;              // result URL from deAPI
  localPath?: string;              // path to downloaded file
  error?: string;
  createdAt: string;               // ISO timestamp
  completedAt?: string;
  costCredits?: number;
}

// Configuration
export interface AppConfig {
  apiUrl: string;
  apiToken: string;
  outputDir: string;
  pollingIntervalMs?: number;      // default 2000
  maxPollingAttempts?: number;     // default 120 (4 minutes)
}
