import { EndpointParam } from '@/lib/types';

export interface PriceFileEntry {
  field: string;
  file: File;
}

export interface PriceFilePayload {
  // Files the /price call still uploads, under the field name they arrived with.
  files: PriceFileEntry[];
  // Count fields to send instead of files (e.g. `{ ref_images_count: 4 }`).
  counts: Record<string, number>;
  // Field names (as sent, e.g. `ref_images[]`) whose files are NOT uploaded.
  dropped: string[];
}

/**
 * Reshape a multipart request's files for its /price call.
 *
 * Most /price endpoints validate the same payload as the request they quote,
 * files included. Reference lists are the exception: the quote takes how many
 * files there are (`ref_images_count`) rather than the files — the count is
 * what moves the price — and a reference field with no surcharge is left out.
 * Files are matched to their param by name or by the array spelling they are
 * sent under (`ref_images[]`).
 */
export function buildPriceFilePayload(
  params: EndpointParam[],
  entries: PriceFileEntry[]
): PriceFilePayload {
  const files: PriceFileEntry[] = [];
  const counts: Record<string, number> = {};
  const dropped = new Set<string>();

  for (const entry of entries) {
    const param = params.find((p) => p.name === entry.field || p.multiFieldName === entry.field);
    if (param?.priceCountField) {
      counts[param.priceCountField] = (counts[param.priceCountField] ?? 0) + 1;
      dropped.add(entry.field);
    } else if (param?.priceOmit) {
      dropped.add(entry.field);
    } else {
      files.push(entry);
    }
  }

  return { files, counts, dropped: [...dropped] };
}
