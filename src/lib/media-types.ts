// Media kinds the form and the asset library share.
// A file field's `accept` decides which library tab it opens and which tile
// shape its chosen files get; the API routes use the same extension sets to
// decide what to list and what Content-Type to serve.

export type MediaKind = 'image' | 'video' | 'audio' | 'other';

export const MEDIA_EXTENSIONS: Record<Exclude<MediaKind, 'other'>, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'],
  video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'],
  audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus'],
};

export const MEDIA_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/opus',
};

/** Media kind of a file name, by extension. */
export function mediaKindFromName(name: string): MediaKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  for (const [kind, extensions] of Object.entries(MEDIA_EXTENSIONS)) {
    if (extensions.includes(ext)) return kind as MediaKind;
  }
  return 'other';
}

/** Media kind of a MIME type, falling back to the file name when it is generic. */
export function mediaKindFromFile(file: { type: string; name: string }): MediaKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return mediaKindFromName(file.name);
}

/**
 * Media kind a file input accepts, e.g. "image/*" or "audio/*,.mp3".
 * Mixed accepts resolve to the first kind mentioned; unknown ones to 'other'.
 */
export function mediaKindFromAccept(accept?: string): MediaKind {
  if (!accept) return 'other';
  const lower = accept.toLowerCase();
  const positions: [MediaKind, number][] = [
    ['image', lower.indexOf('image/')],
    ['video', lower.indexOf('video/')],
    ['audio', lower.indexOf('audio/')],
  ];
  const found = positions.filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  if (found.length > 0) return found[0][0];

  // Extension-only accepts (".mp4,.mov")
  for (const token of lower.split(',')) {
    const trimmed = token.trim();
    if (trimmed.startsWith('.')) {
      const kind = mediaKindFromName(`x${trimmed}`);
      if (kind !== 'other') return kind;
    }
  }
  return 'other';
}

/** MIME type for a file name, for serving library files back to the browser. */
export function mimeTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MEDIA_MIME_TYPES[ext] ?? 'application/octet-stream';
}

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  other: 'Files',
};
