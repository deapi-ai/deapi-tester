/**
 * Shared constants for job status colors and icons
 */

// Status colors for background/dot indicators (Tailwind classes)
export const STATUS_BG_COLORS: Record<string, string> = {
  sending: 'bg-violet-500',
  pending: 'bg-yellow-500',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  done: 'bg-green-500',
  failed: 'bg-red-500',
  error: 'bg-red-500',
  cancelled: 'bg-zinc-500',
  timeout: 'bg-orange-500',
};

// Status colors for text (Tailwind classes)
export const STATUS_TEXT_COLORS: Record<string, string> = {
  idle: 'text-zinc-500',
  sending: 'text-violet-400',
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  polling: 'text-blue-400',
  completed: 'text-green-400',
  done: 'text-green-400',
  failed: 'text-red-400',
  error: 'text-red-400',
  cancelled: 'text-zinc-500',
  timeout: 'text-orange-400',
};

// Status emoji icons
export const STATUS_ICONS: Record<string, string> = {
  idle: '⏸️',
  sending: '📤',
  pending: '⏳',
  processing: '🔄',
  polling: '🔄',
  completed: '✅',
  done: '✅',
  failed: '❌',
  error: '⚠️',
  cancelled: '🚫',
  timeout: '⏰',
};

// Compact field names for form layout
export const COMPACT_FORM_FIELDS = [
  'width',
  'height',
  'steps',
  'seed',
  'guidance',
  'frames',
  'fps',
  'speed',
  'cfg_scale',
  'num_inference_steps',
  'mode',
  'lang',
  'voice',
  'format',
  'sample_rate',
  // txt2music
  'duration',
  'bpm',
  'inference_steps',
  'guidance_scale',
];
