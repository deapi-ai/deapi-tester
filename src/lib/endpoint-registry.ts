import { EndpointDefinition, EndpointGroupMeta, EndpointParam } from './types';

// ============================================================
// ENDPOINT GROUPS
// ============================================================
export const ENDPOINT_GROUPS: EndpointGroupMeta[] = [
  {
    id: 'image-generation',
    label: 'Image Generation',
    icon: '🖼️',
    description: 'Text-to-Image, Image-to-Image',
  },
  {
    id: 'video-generation',
    label: 'Video Generation',
    icon: '🎬',
    description: 'Text-to-Video, Image-to-Video',
  },
  {
    id: 'audio-generation',
    label: 'Audio / TTS',
    icon: '🔊',
    description: 'Text-to-Speech',
  },
  {
    id: 'transcription',
    label: 'Transcription',
    icon: '📝',
    description: 'Video/Audio to Text (Whisper)',
  },
  {
    id: 'ocr',
    label: 'OCR',
    icon: '👁️',
    description: 'Image to Text extraction',
  },
  {
    id: 'image-utils',
    label: 'Image Utils',
    icon: '🔧',
    description: 'Background removal, upscaling',
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    icon: '🧮',
    description: 'Text to vector embeddings',
  },
  {
    id: 'utility',
    label: 'Utility',
    icon: '⚙️',
    description: 'Balance, models, job results',
  },
];

// ============================================================
// SHARED PARAM BUILDERS (DRY helpers)
// ============================================================

const promptParam = (required = true): EndpointParam => ({
  name: 'prompt',
  label: 'Prompt',
  type: 'textarea',
  required,
  placeholder: 'Describe what you want to generate...',
  description: 'Text description of desired output',
});

const negativePromptParam = (): EndpointParam => ({
  name: 'negative_prompt',
  label: 'Negative Prompt',
  type: 'textarea',
  required: false,
  placeholder: 'What to avoid in the output...',
  description: 'Text describing what to exclude',
});

const modelSelectParam = (options: { value: string; label: string }[]): EndpointParam => ({
  name: 'model',
  label: 'Model',
  type: 'select',
  required: true,
  options,
  description: 'AI model to use for generation',
});

const seedParam = (defaultVal?: number): EndpointParam => ({
  name: 'seed',
  label: 'Seed',
  type: 'number',
  required: false,
  nullable: true,
  default: defaultVal ?? Math.floor(Math.random() * 1000000),
  placeholder: 'Random seed for reproducibility',
  description: 'Seed for reproducible results',
});

const stepsParam = (defaultVal = 20): EndpointParam => ({
  name: 'steps',
  label: 'Steps',
  type: 'number',
  required: false,
  nullable: true,
  default: defaultVal,
  min: 1,
  max: 100,
  description: 'Inference steps. Higher = better quality, slower.',
});

const guidanceParam = (defaultVal = 7.5): EndpointParam => ({
  name: 'guidance',
  label: 'Guidance Scale',
  type: 'number',
  required: false,
  nullable: true,
  default: defaultVal,
  min: 0,
  max: 30,
  step: 0.5,
  description: 'How closely to follow the prompt. Higher = more literal.',
});

const dimensionParams = (defaultW = 1024, defaultH = 1024): EndpointParam[] => [
  {
    name: 'width',
    label: 'Width',
    type: 'number',
    required: false,
    nullable: true,
    default: defaultW,
    min: 64,
    max: 2048,
    step: 64,
    description: 'Output width in pixels (max 2048)',
  },
  {
    name: 'height',
    label: 'Height',
    type: 'number',
    required: false,
    nullable: true,
    default: defaultH,
    min: 64,
    max: 2048,
    step: 64,
    description: 'Output height in pixels (max 2048)',
  },
];

const lorasParam = (): EndpointParam => ({
  name: 'loras',
  label: 'LoRA Adapters',
  type: 'lora-array',
  required: false,
  description: 'Array of LoRA adapters [{name, weight}]. Leave empty if not using.',
});

// ============================================================
// ENDPOINT DEFINITIONS
// ============================================================

export const ENDPOINTS: EndpointDefinition[] = [
  // ── Image Generation ──────────────────────────────────────
  {
    id: 'txt2img',
    name: 'Text to Image',
    group: 'image-generation',
    method: 'POST',
    path: '/txt2img',
    description: 'Generate image from text prompt',
    contentType: 'json',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/txt2img/price-calculation',
    params: [
      promptParam(),
      negativePromptParam(),
      modelSelectParam([
        { value: 'Flux1schnell', label: 'Flux.1 Schnell' },
        { value: 'ZImageTurbo_INT8', label: 'Z-Image Turbo (INT8)' },
      ]),
      ...dimensionParams(),
      guidanceParam(),
      stepsParam(),
      seedParam(),
      lorasParam(),
    ],
  },

  {
    id: 'img2img',
    name: 'Image to Image',
    group: 'image-generation',
    method: 'POST',
    path: '/img2img',
    description: 'Edit/transform image using AI',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/img2img/price-calculation',
    params: [
      {
        name: 'image',
        label: 'Input Image',
        type: 'file',
        required: true,
        accept: 'image/*',
        multiple: true,
        multiFieldName: 'images[]',
        description: 'Single image (image) or multiple images (images[] array)',
      },
      promptParam(),
      modelSelectParam([
        { value: 'QwenImageEdit_Plus_NF4', label: 'Qwen Image Edit Plus (NF4)' },
      ]),
      {
        name: 'width',
        label: 'Width',
        type: 'number',
        required: false,
        nullable: true,
        default: null,
        min: 64,
        max: 2048,
        step: 64,
        description: 'Output width in pixels (optional - leave disabled for original size)',
      },
      {
        name: 'height',
        label: 'Height',
        type: 'number',
        required: false,
        nullable: true,
        default: null,
        min: 64,
        max: 2048,
        step: 64,
        description: 'Output height in pixels (optional - leave disabled for original size)',
      },
      guidanceParam(),
      stepsParam(),
      seedParam(),
      lorasParam(),
    ],
  },

  // ── Video Generation ──────────────────────────────────────
  {
    id: 'img2video',
    name: 'Image to Video',
    group: 'video-generation',
    method: 'POST',
    path: '/img2video',
    description: 'Animate static image into video',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/img2video/price-calculation',
    params: [
      {
        name: 'first_frame_image',
        label: 'First Frame Image',
        type: 'file',
        required: true,
        accept: 'image/*',
        description: 'Starting frame image',
      },
      {
        name: 'last_frame_image',
        label: 'Last Frame Image',
        type: 'file',
        required: false,
        accept: 'image/*',
        description: 'Optional ending frame image',
      },
      promptParam(),
      modelSelectParam([
        { value: 'Ltxv_13B_0_9_8_Distilled_FP8', label: 'LTX-Video 13B (Distilled FP8)' },
      ]),
      ...dimensionParams(768, 512),
      guidanceParam(3.0),
      stepsParam(30),
      {
        name: 'frames',
        label: 'Frames',
        type: 'number',
        required: false,
        nullable: true,
        default: 97,
        min: 1,
        max: 257,
        description: 'Number of frames to generate',
      },
      {
        name: 'fps',
        label: 'FPS',
        type: 'number',
        required: false,
        nullable: true,
        default: 30,
        min: 1,
        max: 60,
        description: 'Frames per second',
      },
      seedParam(),
    ],
  },

  {
    id: 'txt2video',
    name: 'Text to Video',
    group: 'video-generation',
    method: 'POST',
    path: '/txt2video',
    description: 'Generate video from text description',
    contentType: 'json',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/txt2video/price-calculation',
    params: [
      promptParam(),
      modelSelectParam([
        { value: 'Ltxv_13B_0_9_8_Distilled_FP8', label: 'LTX-Video 13B (Distilled FP8)' },
      ]),
      ...dimensionParams(768, 512),
      guidanceParam(3.0),
      stepsParam(30),
      {
        name: 'frames',
        label: 'Frames',
        type: 'number',
        required: false,
        nullable: true,
        default: 97,
        min: 1,
        max: 257,
      },
      {
        name: 'fps',
        label: 'FPS',
        type: 'number',
        required: false,
        nullable: true,
        default: 30,
        min: 1,
        max: 60,
      },
      seedParam(),
    ],
  },

  // ── Audio / TTS ───────────────────────────────────────────
  {
    id: 'txt2audio',
    name: 'Text to Speech',
    group: 'audio-generation',
    method: 'POST',
    path: '/txt2audio',
    description: 'Convert text to natural speech',
    contentType: 'json',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/txt2audio/price-calculation',
    params: [
      {
        name: 'text',
        label: 'Text',
        type: 'textarea',
        required: true,
        placeholder: 'Text to convert to speech...',
      },
      modelSelectParam([
        { value: 'Kokoro', label: 'Kokoro TTS' },
      ]),
      {
        name: 'voice',
        label: 'Voice',
        type: 'select',
        required: true,
        default: 'af_alloy',
        options: [
          { value: 'af_alloy', label: 'Alloy (Female)' },
          { value: 'af_aoede', label: 'Aoede (Female)' },
          { value: 'af_bella', label: 'Bella (Female)' },
          { value: 'af_heart', label: 'Heart (Female)' },
          { value: 'af_jessica', label: 'Jessica (Female)' },
          { value: 'af_kore', label: 'Kore (Female)' },
          { value: 'af_nicole', label: 'Nicole (Female)' },
          { value: 'af_nova', label: 'Nova (Female)' },
          { value: 'af_river', label: 'River (Female)' },
          { value: 'af_sarah', label: 'Sarah (Female)' },
          { value: 'af_sky', label: 'Sky (Female)' },
          { value: 'am_adam', label: 'Adam (Male)' },
          { value: 'am_echo', label: 'Echo (Male)' },
          { value: 'am_eric', label: 'Eric (Male)' },
          { value: 'am_fable', label: 'Fable (Male)' },
          { value: 'am_liam', label: 'Liam (Male)' },
          { value: 'am_michael', label: 'Michael (Male)' },
          { value: 'am_onyx', label: 'Onyx (Male)' },
        ],
        description: 'Voice to use for TTS',
      },
      {
        name: 'lang',
        label: 'Language',
        type: 'select',
        required: true,
        default: 'en-us',
        options: [
          { value: 'en-us', label: 'English (US)' },
          { value: 'en-gb', label: 'English (UK)' },
          { value: 'es', label: 'Spanish' },
          { value: 'fr', label: 'French' },
          { value: 'de', label: 'German' },
          { value: 'it', label: 'Italian' },
          { value: 'pt-br', label: 'Portuguese (BR)' },
          { value: 'ja', label: 'Japanese' },
          { value: 'ko', label: 'Korean' },
          { value: 'zh', label: 'Chinese' },
          { value: 'hi', label: 'Hindi' },
        ],
      },
      {
        name: 'speed',
        label: 'Speed',
        type: 'number',
        required: false,
        nullable: true,
        default: 1.0,
        min: 0.5,
        max: 2.0,
        step: 0.1,
      },
      {
        name: 'format',
        label: 'Format',
        type: 'select',
        required: false,
        nullable: true,
        default: 'mp3',
        options: [
          { value: 'mp3', label: 'MP3' },
          { value: 'wav', label: 'WAV' },
        ],
      },
      {
        name: 'sample_rate',
        label: 'Sample Rate',
        type: 'number',
        required: false,
        nullable: true,
        default: 24000,
        min: 8000,
        max: 48000,
        step: 1000,
      },
    ],
  },

  // ── Transcription ─────────────────────────────────────────
  {
    id: 'vid2txt',
    name: 'Video URL to Text',
    group: 'transcription',
    method: 'POST',
    path: '/vid2txt',
    description: 'Transcribe video from YouTube/X/Twitch URL',
    contentType: 'json',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/vid2txt/price-calculation',
    params: [
      {
        name: 'video_url',
        label: 'Video URL',
        type: 'text',
        required: true,
        placeholder: 'https://youtube.com/watch?v=...',
        description: 'YouTube, X, or Twitch video URL',
      },
      modelSelectParam([
        { value: 'WhisperLargeV3', label: 'Whisper Large V3' },
      ]),
      {
        name: 'include_ts',
        label: 'Include Timestamps',
        type: 'boolean',
        required: true,
        default: false,
      },
    ],
  },

  {
    id: 'videofile2txt',
    name: 'Video File to Text',
    group: 'transcription',
    method: 'POST',
    path: '/videofile2txt',
    description: 'Transcribe uploaded video file',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/videofile2txt/price-calculation',
    params: [
      {
        name: 'video',
        label: 'Video File',
        type: 'file',
        required: true,
        accept: 'video/*',
      },
      {
        name: 'include_ts',
        label: 'Include Timestamps',
        type: 'boolean',
        required: true,
        default: false,
      },
      modelSelectParam([
        { value: 'WhisperLargeV3', label: 'Whisper Large V3' },
      ]),
    ],
  },

  {
    id: 'aud2txt',
    name: 'Audio URL to Text',
    group: 'transcription',
    method: 'POST',
    path: '/aud2txt',
    description: 'Transcribe audio (including X Spaces)',
    contentType: 'json',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/aud2txt/price-calculation',
    params: [
      {
        name: 'audio_url',
        label: 'Audio URL',
        type: 'text',
        required: true,
        placeholder: 'https://...',
        description: 'Audio URL or X Spaces URL',
      },
      modelSelectParam([
        { value: 'WhisperLargeV3', label: 'Whisper Large V3' },
      ]),
      {
        name: 'include_ts',
        label: 'Include Timestamps',
        type: 'boolean',
        required: true,
        default: false,
      },
    ],
  },

  {
    id: 'audiofile2txt',
    name: 'Audio File to Text',
    group: 'transcription',
    method: 'POST',
    path: '/audiofile2txt',
    description: 'Transcribe uploaded audio file',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/audiofile2txt/price-calculation',
    params: [
      {
        name: 'audio',
        label: 'Audio File',
        type: 'file',
        required: true,
        accept: 'audio/*',
      },
      {
        name: 'include_ts',
        label: 'Include Timestamps',
        type: 'boolean',
        required: true,
        default: false,
      },
      modelSelectParam([
        { value: 'WhisperLargeV3', label: 'Whisper Large V3' },
      ]),
    ],
  },

  // ── OCR ───────────────────────────────────────────────────
  {
    id: 'img2txt',
    name: 'Image to Text (OCR)',
    group: 'ocr',
    method: 'POST',
    path: '/img2txt',
    description: 'Extract text from images',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/img2txt/price-calculation',
    params: [
      {
        name: 'image',
        label: 'Image',
        type: 'file',
        required: true,
        accept: 'image/*',
      },
      modelSelectParam([
        { value: 'Nanonets_Ocr_S_F16', label: 'Nanonets OCR S (F16)' },
      ]),
      {
        name: 'language',
        label: 'Language',
        type: 'text',
        required: false,
        placeholder: 'auto',
        description: 'OCR language hint',
      },
    ],
  },

  // ── Image Utils ───────────────────────────────────────────
  {
    id: 'img-rmbg',
    name: 'Remove Background',
    group: 'image-utils',
    method: 'POST',
    path: '/img-rmbg',
    description: 'Remove image background',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/img-rmbg/price-calculation',
    params: [
      {
        name: 'image',
        label: 'Image',
        type: 'file',
        required: true,
        accept: 'image/*',
      },
      modelSelectParam([
        { value: 'Rmbg_1_4', label: 'RMBG 1.4' },
      ]),
    ],
  },

  {
    id: 'img-upscale',
    name: 'Upscale Image',
    group: 'image-utils',
    method: 'POST',
    path: '/img-upscale',
    description: 'Upscale image resolution (coming soon)',
    contentType: 'multipart',
    isAsync: true,
    hasPriceCalc: false,
    params: [
      {
        name: 'image',
        label: 'Image',
        type: 'file',
        required: true,
        accept: 'image/*',
      },
    ],
  },

  // ── Embeddings ────────────────────────────────────────────
  {
    id: 'txt2embedding',
    name: 'Text to Embedding',
    group: 'embeddings',
    method: 'POST',
    path: '/txt2embedding',
    description: 'Generate vector embeddings for RAG',
    contentType: 'json',
    isAsync: true,
    hasPriceCalc: true,
    priceCalcPath: '/txt2embedding/price-calculation',
    params: [
      {
        name: 'input',
        label: 'Input Text',
        type: 'textarea',
        required: true,
        placeholder: 'Text to embed...',
      },
      modelSelectParam([
        { value: 'bge-m3', label: 'BGE M3' },
      ]),
    ],
  },

  // ── Utility ───────────────────────────────────────────────
  {
    id: 'models',
    name: 'List Models',
    group: 'utility',
    method: 'GET',
    path: '/models',
    description: 'Get all available models with specifications',
    contentType: 'json',
    isAsync: false,
    hasPriceCalc: false,
    params: [],
  },

  {
    id: 'balance',
    name: 'Check Balance',
    group: 'utility',
    method: 'GET',
    path: '/balance',
    description: 'Check account credit balance',
    contentType: 'json',
    isAsync: false,
    hasPriceCalc: false,
    params: [],
  },

  {
    id: 'request-status',
    name: 'Get Job Result',
    group: 'utility',
    method: 'GET',
    path: '/request-status/{request_id}',
    description: 'Retrieve job status and results by request_id',
    contentType: 'json',
    isAsync: false,
    hasPriceCalc: false,
    params: [
      {
        name: 'request_id',
        label: 'Request ID',
        type: 'text',
        required: true,
        isPathParam: true,
        placeholder: 'c08a339c-73e5-4d67-a4d5-231302fbff9a',
        description: 'The request_id returned when job was submitted',
      },
    ],
  },
];

// Helper: get endpoints by group
export function getEndpointsByGroup(group: string): EndpointDefinition[] {
  return ENDPOINTS.filter(e => e.group === group);
}

// Helper: get endpoint by ID
export function getEndpointById(id: string): EndpointDefinition | undefined {
  return ENDPOINTS.find(e => e.id === id);
}
