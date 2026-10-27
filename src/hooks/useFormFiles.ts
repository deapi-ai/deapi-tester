'use client';

import { useCallback, useState } from 'react';
import { EndpointParam, UploadedFile } from '@/lib/types';
import { FilePreview, generateFilePreview } from '@/lib/form-utils';
import { FormFiles } from '@/lib/form-payload';
import type { AddMode } from '@/components/form/FileUploadField';

function revokeAll(previews: Record<string, FilePreview[]>): void {
  Object.values(previews).flat().forEach((p) => URL.revokeObjectURL(p.url));
}

function dropKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * The files chosen in a form, their previews and each field's single/multi mode.
 *
 * Files and previews are always updated together and stay index-aligned — for
 * reference lists that index is the binding the prompt's <Picture N> tags
 * resolve against, so the two must never drift.
 */
export function useFormFiles() {
  const [files, setFiles] = useState<FormFiles>({});
  const [filePreviews, setFilePreviews] = useState<Record<string, FilePreview[]>>({});
  const [multiFileMode, setMultiFileMode] = useState<Record<string, boolean>>({});

  /** Clear every field and start each one in the given mode. */
  const resetFiles = useCallback((modes: Record<string, boolean>) => {
    setFiles({});
    setMultiFileMode(modes);
    setFilePreviews((prev) => {
      revokeAll(prev);
      return {};
    });
  }, []);

  /**
   * Put files into a field. `mode` is decided by the field, not by the shape of
   * what arrives: a multi-file field appends whatever it is handed (dialog,
   * drop or library) and a single-file field replaces. `null` clears the field.
   */
  const handleFileChange = useCallback(async (name: string, incoming: File[] | null, mode: AddMode) => {
    if (!incoming || incoming.length === 0) {
      setFilePreviews((prev) => {
        prev[name]?.forEach((p) => URL.revokeObjectURL(p.url));
        return dropKey(prev, name);
      });
      setFiles((prev) => dropKey(prev, name));
      return;
    }

    const isAppend = mode === 'append';
    // Replacing means the field ends up holding exactly one file, whatever was
    // handed over — so previews are built from the same list that is stored.
    const accepted = isAppend ? incoming : [incoming[0]];

    setFiles((prev) => {
      const existing = prev[name];
      const current = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
      // Multi fields stay arrays even at one file, so the array field name
      // (`ref_images[]`) keeps matching what is actually sent.
      return { ...prev, [name]: isAppend ? [...current, ...accepted] : accepted[0] };
    });

    const newPreviews = await Promise.all(accepted.map(generateFilePreview));
    setFilePreviews((prev) => {
      if (!isAppend) prev[name]?.forEach((p) => URL.revokeObjectURL(p.url));
      return { ...prev, [name]: isAppend ? [...(prev[name] || []), ...newPreviews] : newPreviews };
    });
  }, []);

  const removeFile = useCallback((name: string, index: number) => {
    setFiles((prev) => {
      const existing = prev[name];
      if (!existing) return prev;
      const remaining = (Array.isArray(existing) ? existing : [existing]).filter((_, i) => i !== index);
      if (remaining.length === 0) return dropKey(prev, name);
      // Keep an array field an array: dropping to a bare File would switch the
      // submitted field name from `ref_images[]` to `ref_images`.
      return { ...prev, [name]: Array.isArray(existing) ? remaining : remaining[0] };
    });

    setFilePreviews((prev) => {
      const current = prev[name];
      if (!current) return prev;
      if (current[index]) URL.revokeObjectURL(current[index].url);
      const remaining = current.filter((_, i) => i !== index);
      if (remaining.length === 0) return dropKey(prev, name);
      return { ...prev, [name]: remaining };
    });
  }, []);

  /**
   * Move a file to a different position in its field.
   *
   * ⛔ This rewrites the binding: position N in the list is what the prompt's
   * <Picture N> / <Video N> / <Audio N> tags resolve to, so files and previews
   * move as one.
   */
  const reorderFiles = useCallback((name: string, from: number, to: number) => {
    const move = <T,>(list: T[]): T[] => {
      if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    };

    setFiles((prev) => {
      const existing = prev[name];
      if (!Array.isArray(existing)) return prev;
      return { ...prev, [name]: move(existing) };
    });
    setFilePreviews((prev) => {
      const current = prev[name];
      if (!current) return prev;
      return { ...prev, [name]: move(current) };
    });
  }, []);

  const handleModeChange = useCallback((name: string, isMulti: boolean) => {
    setMultiFileMode((prev) => ({ ...prev, [name]: isMulti }));
  }, []);

  /**
   * Load a history job's persisted uploads back into the form, so a duplicated
   * request keeps its files. `isCurrent` is checked after each fetch: a newer
   * prefill that arrives mid-restore wins, and this one is abandoned.
   */
  const restoreUploadedFiles = useCallback(
    async (params: EndpointParam[], uploaded: UploadedFile[], isCurrent: () => boolean) => {
      const restoredFiles: FormFiles = {};
      const restoredPreviews: Record<string, FilePreview[]> = {};
      const restoredMultiMode: Record<string, boolean> = {};

      for (const param of params.filter((p) => p.type === 'file')) {
        const matches = uploaded.filter(
          (u) => u.field === param.name || (!!param.multiFieldName && u.field === param.multiFieldName)
        );
        if (matches.length === 0) continue;

        const isMulti =
          matches.length > 1 || (!!param.multiFieldName && matches.some((m) => m.field === param.multiFieldName));

        const fetched: File[] = [];
        for (const m of matches) {
          try {
            const res = await fetch(`/api/uploads/${encodeURIComponent(m.storedName)}`);
            if (!res.ok) continue;
            const blob = await res.blob();
            fetched.push(new File([blob], m.fileName, { type: m.mimeType }));
          } catch {
            // skip files that can't be restored
          }
        }
        if (fetched.length === 0) continue;
        if (!isCurrent()) return;

        restoredFiles[param.name] = isMulti ? fetched : fetched[0];
        if (isMulti && param.multiFieldName) restoredMultiMode[param.name] = true;
        restoredPreviews[param.name] = await Promise.all(fetched.map(generateFilePreview));
      }

      if (!isCurrent()) return;
      if (Object.keys(restoredFiles).length > 0) setFiles(restoredFiles);
      if (Object.keys(restoredPreviews).length > 0) {
        setFilePreviews((prev) => ({ ...prev, ...restoredPreviews }));
      }
      if (Object.keys(restoredMultiMode).length > 0) {
        setMultiFileMode((prev) => ({ ...prev, ...restoredMultiMode }));
      }
    },
    []
  );

  return {
    files,
    filePreviews,
    multiFileMode,
    resetFiles,
    handleFileChange,
    removeFile,
    reorderFiles,
    handleModeChange,
    restoreUploadedFiles,
  };
}
