import { EndpointDefinition, EndpointParam, JsonValue } from '@/lib/types';

/*
 * Turns form state into what the proxy receives. The request and its price
 * check are built by the same code so /price validates the payload it quotes.
 */

export type FormFiles = Record<string, File | File[]>;

interface FilteredValuesOptions {
  params: EndpointParam[];
  isVisible: (param: EndpointParam) => boolean;
  arrayMode: Record<string, boolean>;
  modelDefaults: Record<string, unknown> | undefined;
}

/**
 * Form values as they go to the API: hidden fields dropped, array-mode text
 * split into lines, numeric selects as numbers. A disabled nullable field sends
 * the model default (or the param default) — the API rejects some of them empty.
 */
export function buildFilteredValues(
  values: Record<string, JsonValue>,
  { params, isVisible, arrayMode, modelDefaults }: FilteredValuesOptions
): Record<string, JsonValue> {
  const filtered: Record<string, JsonValue> = {};
  Object.entries(values).forEach(([key, value]) => {
    const param = params.find((p) => p.name === key);
    if (param && !isVisible(param)) return;

    if (value !== null) {
      if (arrayMode[key] && typeof value === 'string') {
        filtered[key] = value.split('\n').map((s) => s.trim()).filter(Boolean);
      } else if (param?.valueType === 'number' && typeof value === 'string' && value !== '') {
        filtered[key] = Number(value);
      } else {
        filtered[key] = value;
      }
      return;
    }

    if (modelDefaults && modelDefaults[key] !== undefined && modelDefaults[key] !== null) {
      filtered[key] = modelDefaults[key] as JsonValue;
      return;
    }
    if (param?.default !== undefined && param.default !== null) {
      filtered[key] = param.default;
    }
  });
  return filtered;
}

interface AppendFilesOptions {
  params: EndpointParam[];
  isVisible: (param: EndpointParam) => boolean;
  multiFileMode: Record<string, boolean>;
}

/**
 * Append the chosen files to a multipart body.
 *
 * A field in multi mode goes out under its array name (`ref_images[]`), which
 * is what makes the server build a dense array. A repeated plain key keeps only
 * the last file — a price quoted for one reference image, or a 422. Order within
 * a field is preserved: it is what the prompt's tags bind to.
 */
export function appendFiles(
  formData: FormData,
  files: FormFiles,
  { params, isVisible, multiFileMode }: AppendFilesOptions
): void {
  Object.entries(files).forEach(([key, fileOrFiles]) => {
    const param = params.find((p) => p.name === key);
    if (param && !isVisible(param)) return;
    const fieldName = param?.multiFieldName && multiFileMode[key] ? param.multiFieldName : key;

    if (Array.isArray(fileOrFiles)) {
      fileOrFiles.forEach((file) => formData.append(fieldName, file));
    } else {
      formData.append(fieldName, fileOrFiles);
    }
  });
}

export interface ProxyRequest {
  // What the job is logged with; for JSON endpoints also the request body.
  params: Record<string, JsonValue>;
  // Set for multipart endpoints — the body sent to the proxy.
  formData?: FormData;
}

interface BuildRequestOptions {
  endpoint: EndpointDefinition;
  values: Record<string, JsonValue>;
  // Inline boost flag, spelled for the content type (see useInlineBoost).
  boostPayload: (contentType: 'json' | 'multipart') => Record<string, JsonValue>;
  appendFiles: (formData: FormData) => void;
  priceCalc: boolean;
}

/**
 * Build the proxy request for an endpoint. Multipart endpoints always send
 * FormData (with or without files) — a price check sent as JSON with
 * "[File: …]" placeholders fails with 422.
 */
export function buildProxyRequest({
  endpoint,
  values,
  boostPayload,
  appendFiles: addFiles,
  priceCalc,
}: BuildRequestOptions): ProxyRequest {
  if (endpoint.contentType !== 'multipart') {
    return {
      params: {
        ...values,
        ...boostPayload('json'),
        _endpointId: endpoint.id,
        ...(priceCalc ? { _priceCalc: true } : {}),
      },
    };
  }

  const boost = boostPayload('multipart');
  const formData = new FormData();
  formData.append('_endpointId', endpoint.id);
  if (priceCalc) formData.append('_priceCalc', 'true');
  // /price does not take `enhance_prompt` — the proxy strips it and quotes the
  // boost separately, so the estimate includes the boost fee.
  Object.entries(boost).forEach(([key, value]) => formData.append(key, String(value)));
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') formData.append(key, String(value));
  });
  addFiles(formData);

  return { params: { ...values, ...boost }, formData };
}

export interface FileSection {
  title: string | null;
  note?: string;
  params: EndpointParam[];
}

/**
 * File fields grouped into the sections the registry declares, in registry
 * order. Endpoints that declare none keep a single ungrouped row. Sections
 * exist because some endpoints take two mutually exclusive sets of files, and
 * one flat row of five uploads reads as one shape you are meant to fill in.
 */
export function groupFileSections(fileParams: EndpointParam[]): FileSection[] {
  const sections: FileSection[] = [];
  fileParams.forEach((param) => {
    const title = param.section ?? null;
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.params.push(param);
    } else {
      sections.push({ title, note: param.sectionNote, params: [param] });
    }
  });
  return sections;
}
