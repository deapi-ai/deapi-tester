/**
 * Formatting utilities for dates, times, and file sizes
 */

import { getEndpointByApiPath } from './endpoint-registry';
import { Job, JsonValue } from './types';

/**
 * Format ISO date string to HH:MM:SS time
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Format ISO date string to relative time (e.g., "5m ago")
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

/**
 * Format bytes to human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format cost/credits for display
 */
export function formatCost(cost: number): string {
  if (cost !== 0 && Math.abs(cost) < 0.000001) {
    return cost.toFixed(10).replace(/\.?0+$/, '');
  }
  return String(cost);
}

// Progress arrives from deAPI as a number or a string like "45.50" / "100.00".
// Render it as a whole percent in the UI — the exact value stays visible in the
// Raw panel. Returns null when there is no usable numeric value.
export function formatProgress(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

// Result file extensions by media type (URL may carry a query string, e.g. signed S3 links).
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|mkv|ogv)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|flac|ogg|m4a|aac|opus|weba)(\?|#|$)/i;

/**
 * Determine the result media type for a job.
 *
 * `endpointId` is stored as the deAPI path (e.g. "images/generations",
 * "audio/transcriptions"), which differs from the registry id, so we cannot
 * substring-match v1-style ids. Instead we:
 *   1. Infer from the result file's extension (most reliable when we have a URL).
 *   2. Fall back to the endpoint definition's group, which is stable regardless
 *      of v1/v2 path naming.
 */
export function getResultType(
  endpointId: string,
  resultUrl?: string | null
): 'image' | 'video' | 'audio' | 'other' {
  if (resultUrl) {
    if (IMAGE_EXT.test(resultUrl)) return 'image';
    if (VIDEO_EXT.test(resultUrl)) return 'video';
    if (AUDIO_EXT.test(resultUrl)) return 'audio';
  }

  switch (getEndpointByApiPath(endpointId)?.group) {
    case 'image-generation':
    case 'image-utils':
      return 'image';
    case 'video-generation':
      return 'video';
    case 'audio-generation':
    case 'music-generation':
      return 'audio';
    default:
      // transcription, ocr, embeddings, utility, or unknown → non-media (text/json)
      return 'other';
  }
}

/**
 * Extract a copyable text output from a job when the result is text rather than
 * a media file. Returns null when there is no text result.
 *  - Prompt enhancement returns a top-level { prompt, negative_prompt }.
 *  - OCR / transcription put the text in data.result (v2 job schema: result =
 *    "Generate text (e.g. transcription)"); media jobs leave it null and use
 *    result_url instead.
 */
export function getResultText(job: Job): string | null {
  const rr = job.rawResponse;
  if (!rr || typeof rr !== 'object' || Array.isArray(rr)) return null;
  const r = rr as Record<string, JsonValue>;

  // Prompt enhancement: top-level { prompt, negative_prompt }
  if (typeof r.prompt === 'string' && r.prompt.trim()) return r.prompt;

  const data =
    r.data && typeof r.data === 'object' && !Array.isArray(r.data)
      ? (r.data as Record<string, JsonValue>)
      : undefined;
  if (data) {
    if (typeof data.result === 'string' && data.result.trim()) return data.result;
    if (typeof data.text === 'string' && data.text.trim()) return data.text;
    if (typeof data.prompt === 'string' && data.prompt.trim()) return data.prompt;
  }
  return null;
}
