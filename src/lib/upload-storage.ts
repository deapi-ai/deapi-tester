import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Job, UploadedFile } from './types';

// Content-addressed storage for multipart uploads.
// Files are stored as "<sha256>.<ext>" so identical content is stored once and
// shared across jobs. A file is only deleted when no remaining job references it.
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Save a file's bytes, deduplicated by content hash. Returns its metadata.
export function saveUploadedFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  field: string
): UploadedFile {
  ensureUploadsDir();
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const storedName = `${hash}${ext}`;
  const dest = path.join(UPLOADS_DIR, storedName);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, buffer);
  }
  return { field, fileName, storedName, mimeType, size: buffer.length };
}

// Resolve a stored upload to an absolute path, guarding against traversal.
// Returns null if the name is malformed or the file does not exist.
export function getUploadPath(storedName: string): string | null {
  const safe = path.basename(storedName);
  if (safe !== storedName) return null;
  if (!/^[a-f0-9]{64}(\.[a-z0-9]+)?$/i.test(safe)) return null;
  const full = path.join(UPLOADS_DIR, safe);
  return fs.existsSync(full) ? full : null;
}

// Delete files belonging to a removed job that no remaining job still references.
export function cleanupOrphanUploads(removedJob: Job, remainingJobs: Job[]): void {
  if (!removedJob.uploadedFiles?.length) return;

  const stillUsed = new Set<string>();
  remainingJobs.forEach((j) => j.uploadedFiles?.forEach((f) => stillUsed.add(f.storedName)));

  for (const file of removedJob.uploadedFiles) {
    if (stillUsed.has(file.storedName)) continue;
    try {
      const full = path.join(UPLOADS_DIR, path.basename(file.storedName));
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
      console.error('[deapi-tester] Failed to delete upload:', err);
    }
  }
}

// Remove the entire uploads directory (used when clearing all history).
export function deleteAllUploads(): void {
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[deapi-tester] Failed to clear uploads:', err);
  }
}
