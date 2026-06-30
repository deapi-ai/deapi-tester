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
