// Prompt enhancement ("prompt booster") shared definitions.
//
// deAPI v2 exposes a single unified endpoint POST /prompts/enhancements that
// rewrites a prompt for a target model. The target inference type is passed as
// `type` in v2 dot notation (the resource path with "/" → "."), and the target
// model as `model_slug`. The model selects the enhancement guide.

// Allowed `type` values (v2 dot notation). Verified against the live API —
// an unknown value returns 422 "The selected type is invalid."
export const ENHANCEMENT_TYPES = [
  'images.generations',
  'images.edits',
  'images.upscales',
  'images.background-removals',
  'images.ocr',
  'videos.generations',
  'videos.animations',
  'videos.upscales',
  'videos.background-removals',
  'videos.transcriptions',
  'audio.speech',
  'audio.music',
  'audio.transcriptions',
  'embeddings',
] as const;

// Types that require a reference `image` in the enhancement request.
export const ENHANCEMENT_TYPES_REQUIRING_IMAGE = ['images.edits', 'videos.animations'];

// Select options for the standalone Prompt Enhancement form.
export const ENHANCEMENT_TYPE_OPTIONS: { value: string; label: string }[] = ENHANCEMENT_TYPES.map(
  (t) => ({ value: t, label: t })
);

/**
 * Map an endpoint's API path (e.g. "/images/generations") to its enhancement
 * `type` in dot notation, or null if the endpoint is not enhancement-supported.
 */
export function enhancementTypeForPath(path: string): string | null {
  const dotted = path.replace(/^\//, '').replace(/\//g, '.');
  return (ENHANCEMENT_TYPES as readonly string[]).includes(dotted) ? dotted : null;
}

// ── Inline prompt booster (enhance_prompt) ──────────────────────────────────
//
// Besides the standalone POST /prompts/enhancements call, deAPI v2 accepts an
// `enhance_prompt` boolean on a handful of generation endpoints. When true the
// boost runs as an async pre-step of the job itself: the job status then reports
// `prompt_boosted` and a `prompt_boost` object with the original and rewritten
// prompts, and the boost fee is billed on the job.
//
// Verified against the v2 OpenAPI spec — only these four request bodies carry
// the field (Txt2Img, Img2Img, Txt2Video, Img2Video). The API answers 422 when
// the selected model has no prompt-booster guide configured.
export const INLINE_BOOST_PATHS = [
  '/images/generations',
  '/images/edits',
  '/videos/generations',
  '/videos/animations',
] as const;

/** Whether an endpoint path accepts the inline `enhance_prompt` flag. */
export function supportsInlineBoost(path: string): boolean {
  return (INLINE_BOOST_PATHS as readonly string[]).includes(path);
}

/** Field name of the inline boost flag in the deAPI request body. */
export const INLINE_BOOST_FIELD = 'enhance_prompt';
