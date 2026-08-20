import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { addJob, generateJobId, updateJob } from '@/lib/storage';
import { saveUploadedFile } from '@/lib/upload-storage';
import { getEndpointById } from '@/lib/endpoint-registry';
import { fetchAllPages, PAGE_LIMIT } from '@/lib/pagination';
import {
  INLINE_BOOST_FIELD,
  enhancementTypeForPath,
  supportsInlineBoost,
} from '@/lib/prompt-enhancement';
import { Job, JsonValue, UploadedFile } from '@/lib/types';

// Price of the inline prompt boost (`enhance_prompt`), quoted by the same
// endpoint the standalone booster uses. The generation /price endpoints do not
// accept `enhance_prompt` and the job's own `price` covers the inference only,
// so the boost fee is quoted here and reported alongside the estimate.
async function fetchInlineBoostPrice(
  apiUrl: string,
  apiToken: string,
  args: {
    type: string;
    modelSlug: string;
    prompt: string;
    negativePrompt?: string;
    image?: File;
  }
): Promise<number | undefined> {
  try {
    const form = new FormData();
    form.append('type', args.type);
    form.append('model_slug', args.modelSlug);
    form.append('prompt', args.prompt);
    if (args.negativePrompt && args.negativePrompt.length >= 3) {
      form.append('negative_prompt', args.negativePrompt);
    }
    if (args.image) form.append('image', args.image);

    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/prompts/enhancements/price`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    });
    const text = await res.text();
    let data: { price?: number; data?: { price?: number } } | null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    console.log('[deapi-tester] Boost price response:', res.status, data ?? text.slice(0, 300));
    const price = data?.price ?? data?.data?.price;
    return res.ok && typeof price === 'number' ? price : undefined;
  } catch (err) {
    console.error('[deapi-tester] Boost price calculation failed:', err);
    return undefined;
  }
}

// POST /api/proxy - Proxy request to deAPI
export async function POST(request: Request) {
  // Track a persisted job so the outer catch can mark it failed instead of
  // leaving a pre-created 'sending' stub stuck forever on an unexpected error.
  let persistedJobId: string | undefined;
  try {
    const contentType = request.headers.get('content-type') || '';
    let endpointId: string;
    let params: Record<string, JsonValue>;
    let formData: FormData | null = null;
    const fileEntries: { field: string; file: File }[] = [];

    // Parse request based on content type
    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      endpointId = formData.get('_endpointId') as string;
      params = {};

      // Convert FormData to params object (excluding files for logging)
      formData.forEach((value, key) => {
        if (key !== '_endpointId' && !(value instanceof File)) {
          params[key] = value;
        } else if (value instanceof File) {
          params[key] = `[File: ${value.name}]`;
          fileEntries.push({ field: key, file: value });
        }
      });
    } else {
      const body = await request.json();
      endpointId = body._endpointId;
      params = { ...body };
      delete params._endpointId;
    }

    // Check if this is a price-only request
    const isPriceCalc = params._priceCalc === true || params._priceCalc === 'true';
    delete params._priceCalc;

    // Optional tester job id: when the client pre-created a 'sending' stub, reuse
    // it so the job updates in place instead of creating a duplicate row.
    const providedJobId = typeof params._jobId === 'string' ? params._jobId : undefined;
    delete params._jobId;

    // Tester-only control: walk every page of a paginated GET and merge the
    // results into one response. deAPI caps `limit` at 50, so this is the only
    // way to see more than 50 items at once. Deleted from params so it is never
    // forwarded to the API as a query param.
    const fetchAllRequested = params._fetchAll === true || params._fetchAll === 'true';
    delete params._fetchAll;

    // Validate endpoint
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) {
      return NextResponse.json(
        { error: `Unknown endpoint: ${endpointId}` },
        { status: 400 }
      );
    }

    // Inline prompt booster: `enhance_prompt` travels with the generation
    // request itself. The /price endpoints do not accept it, so it is stripped
    // from every price payload and the boost fee is quoted separately (below).
    const boostFlag = params[INLINE_BOOST_FIELD];
    const boostRequested =
      supportsInlineBoost(endpoint.path) &&
      (boostFlag === true || boostFlag === 'true' || boostFlag === '1' || boostFlag === 1);
    if (isPriceCalc && boostFlag !== undefined) {
      delete params[INLINE_BOOST_FIELD];
      formData?.delete(INLINE_BOOST_FIELD);
    }

    // For price calculation, check if endpoint supports it
    if (isPriceCalc && (!endpoint.hasPriceCalc || !endpoint.priceCalcPath)) {
      return NextResponse.json(
        { error: 'Endpoint does not support price calculation' },
        { status: 400 }
      );
    }

    // Load config
    const config = loadConfig();
    if (!config.apiToken) {
      return NextResponse.json(
        { error: 'API token not configured. Please set your token in settings.' },
        { status: 401 }
      );
    }

    // Build request - use priceCalcPath if price calculation mode
    let targetPath = isPriceCalc ? endpoint.priceCalcPath! : endpoint.path;

    // Handle path parameters (e.g. /request-status/{request_id})
    const pathParams: Record<string, JsonValue> = {};
    targetPath = targetPath.replace(/\{(\w+)\}/g, (_, paramName) => {
      const value = params[paramName];
      if (value !== undefined && value !== null) {
        pathParams[paramName] = value;
        delete params[paramName]; // Remove from params so it doesn't go in query/body
      }
      return value !== undefined && value !== null ? String(value) : '';
    });

    const url = config.apiUrl.replace(/\/$/, '') + targetPath;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
    };

    let fetchOptions: RequestInit;
    let bodyForLog: JsonValue;

    if (endpoint.contentType === 'multipart' && formData) {
      // Remove our internal fields
      formData.delete('_endpointId');
      formData.delete('_priceCalc');
      formData.delete('_jobId');
      fetchOptions = {
        method: endpoint.method,
        headers,
        body: formData,
      };
      // Build readable FormData representation for logging
      const formDataLog: Record<string, JsonValue> = {};
      formData.forEach((value, key) => {
        if (value instanceof File) {
          // For files, show name and size
          const fileInfo = `[File: ${value.name}, ${(value.size / 1024).toFixed(1)}KB]`;
          // Handle multiple files with same key
          if (formDataLog[key]) {
            if (Array.isArray(formDataLog[key])) {
              (formDataLog[key] as string[]).push(fileInfo);
            } else {
              formDataLog[key] = [formDataLog[key] as string, fileInfo];
            }
          } else {
            formDataLog[key] = fileInfo;
          }
        } else {
          formDataLog[key] = value;
        }
      });
      bodyForLog = { _type: 'multipart/form-data', ...formDataLog };
    } else {
      headers['Content-Type'] = 'application/json';
      fetchOptions = {
        method: endpoint.method,
        headers,
        body: endpoint.method === 'POST' ? JSON.stringify(params) : undefined,
      };
      bodyForLog = params;
    }

    // Only paginate GETs — the flag is meaningless for a POST body, and a price
    // pre-calculation is a single POST regardless.
    const shouldFetchAllPages = fetchAllRequested && endpoint.method === 'GET' && !isPriceCalc;

    // Add query params for GET requests
    let finalUrl = url;
    if (endpoint.method === 'GET' && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });
      finalUrl = url + '?' + queryParams.toString();
    }

    // In "fetch all pages" mode the walker owns page/limit. Log the first page
    // it will actually request; `_tester.pages_fetched` on the response records
    // how many followed.
    const pagedQuery: Record<string, string> = {};
    if (shouldFetchAllPages) {
      Object.entries(params).forEach(([key, value]) => {
        if (key === 'page' || key === 'limit') return;
        if (value !== undefined && value !== null && value !== '') {
          pagedQuery[key] = String(value);
        }
      });
      const firstPage = new URLSearchParams(pagedQuery);
      firstPage.set('limit', String(PAGE_LIMIT));
      firstPage.set('page', '1');
      finalUrl = `${url}?${firstPage.toString()}`;
    }

    // Fetch estimated price if endpoint supports price calculation (skip if this IS a price calc request)
    let estimatedPrice: number | undefined;
    let estimateBreakdown: { base?: number; boost?: number } | undefined;
    if (!isPriceCalc && endpoint.hasPriceCalc && endpoint.priceCalcPath) {
      try {
        const priceUrl = config.apiUrl.replace(/\/$/, '') + endpoint.priceCalcPath;
        console.log('[deapi-tester] Fetching price from:', priceUrl);

        let priceResponse: Response;
        if (endpoint.contentType === 'multipart') {
          // The price endpoint validates the SAME payload as the main request,
          // including uploaded file(s). Sending JSON with "[File: …]" placeholder
          // strings fails with 422 ("The image field must be a file."), so mirror
          // the real multipart payload (fields + actual files). Build a fresh
          // FormData (the original is reused for the main request below) and let
          // fetch set the multipart boundary — do not set Content-Type manually.
          const priceForm = new FormData();
          for (const [key, value] of Object.entries(params)) {
            if (fileEntries.some((f) => f.field === key)) continue; // skip file placeholders
            if (key === INLINE_BOOST_FIELD) continue; // not part of the /price contract
            if (value !== undefined && value !== null) {
              priceForm.append(key, String(value));
            }
          }
          for (const { field, file } of fileEntries) {
            priceForm.append(field, file);
          }
          priceResponse = await fetch(priceUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${config.apiToken}` },
            body: priceForm,
          });
        } else {
          const priceParams = { ...params };
          delete priceParams[INLINE_BOOST_FIELD]; // not part of the /price contract
          priceResponse = await fetch(priceUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(priceParams),
          });
        }

        // Parse defensively — a non-JSON price response (e.g. HTML error page)
        // should not crash the whole request, just skip the estimate.
        const priceText = await priceResponse.text();
        let priceData;
        try {
          priceData = JSON.parse(priceText);
        } catch {
          priceData = null;
        }
        console.log(
          '[deapi-tester] Price response:',
          priceResponse.status,
          priceData ?? priceText.slice(0, 300)
        );
        // Most price endpoints return { data: { price } }; prompt-enhancement
        // returns a top-level { price }.
        const price = priceData?.data?.price ?? priceData?.price;
        if (priceResponse.ok && price !== undefined) {
          estimatedPrice = price;
        }
      } catch (priceErr) {
        console.error('[deapi-tester] Price calculation failed:', priceErr);
      }
    }

    // The inline boost is charged separately from the inference: the job's
    // reported `price` covers the inference only (verified against the live
    // API). So quote the boost on the side and keep it out of the estimate the
    // final price is compared against, rather than folding it in.
    if (!isPriceCalc && boostRequested) {
      const boostType = enhancementTypeForPath(endpoint.path);
      const modelSlug = typeof params.model === 'string' ? params.model : undefined;
      const promptText = typeof params.prompt === 'string' ? params.prompt : undefined;
      if (boostType && modelSlug && promptText) {
        const boostPrice = await fetchInlineBoostPrice(config.apiUrl, config.apiToken, {
          type: boostType,
          modelSlug,
          prompt: promptText,
          negativePrompt:
            typeof params.negative_prompt === 'string' ? params.negative_prompt : undefined,
          image: fileEntries.find((f) => f.file.type.startsWith('image/'))?.file,
        });
        if (boostPrice !== undefined) {
          estimateBreakdown = { base: estimatedPrice, boost: boostPrice };
        }
      }
    }

    // Persist uploaded files (content-addressed) so the request can be duplicated
    // later with its files intact — price checks included, since they are logged
    // as jobs too. Reading a File's bytes does not consume it, so formData is
    // still sent to deAPI below.
    let uploadedFiles: UploadedFile[] | undefined;
    if (fileEntries.length > 0) {
      uploadedFiles = [];
      for (const { field, file } of fileEntries) {
        const buffer = Buffer.from(await file.arrayBuffer());
        uploadedFiles.push(saveUploadedFile(buffer, file.name, file.type, field));
      }
    }

    // Create or reuse the job entry before making the request. When the client
    // pre-created a 'sending' stub (providedJobId), update it in place so the row
    // transitions sending -> pending without duplicating. Price-only checks are
    // logged the same way (flagged with isPriceCheck) so the /price endpoints can
    // be exercised — and their request/response inspected — from the jobs list.
    const jobId = providedJobId || generateJobId();
    // Store the actual API path (without leading slash) as endpointId
    const jobEndpointId = targetPath.replace(/^\//, '');
    const job: Job = {
      id: jobId,
      requestId: '', // Will be updated after response
      endpointId: jobEndpointId,
      params: { ...pathParams, ...params }, // Include path params in logged params
      rawRequest: {
        method: endpoint.method,
        url: finalUrl,
        headers: { ...headers, Authorization: 'Bearer ***' }, // Mask token in logs
        body: bodyForLog,
      },
      uploadedFiles,
      status: 'pending',
      createdAt: new Date().toISOString(),
      costCredits: estimatedPrice,
      estimateBreakdown,
      isPriceCheck: isPriceCalc || undefined,
    };
    if (providedJobId) {
      // Preserve the stub's original createdAt (set when the user clicked Execute).
      const jobUpdate: Partial<Job> = { ...job };
      delete jobUpdate.createdAt;
      const updated = updateJob(jobId, jobUpdate);
      // Stub missing (e.g. cleared before the proxy ran) — fall back to creating it.
      if (!updated) addJob(job);
    } else {
      addJob(job);
    }
    persistedJobId = jobId;

    // Make request to deAPI
    const controller = new AbortController();
    // The page walker makes up to MAX_PAGES sequential requests, so it gets a
    // larger budget than a single call.
    const timeoutId = setTimeout(() => controller.abort(), shouldFetchAllPages ? 60000 : 30000);

    let rawResponse;
    const rawResponseHeaders: Record<string, string> = {};
    let responseOk: boolean;
    let responseStatus: number;

    if (shouldFetchAllPages) {
      const paged = await fetchAllPages(url, config.apiToken, {
        query: pagedQuery,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      responseOk = paged.ok;
      if (paged.ok) {
        responseStatus = 200;
        rawResponse = {
          data: paged.data,
          meta: paged.meta,
          // Marker so the inspector never reads this as a verbatim API
          // response — it is N page responses merged by the tester. `meta` is
          // carried over from the LAST page, hence current_page === last_page.
          _tester: {
            merged_pages: true,
            pages_fetched: paged.pagesFetched,
            items: paged.data.length,
            truncated: paged.truncated,
          },
        };
      } else {
        responseStatus = paged.status;
        rawResponse = paged.body;
      }
    } else {
      const response = await fetch(finalUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      responseOk = response.ok;
      responseStatus = response.status;

      // deAPI (or a gateway/proxy in front of it) can return a non-JSON body on
      // errors — an HTML 500/502 page, a plain string. response.json() would throw
      // a cryptic "Unexpected token '<'". Read the body as text and parse
      // defensively so we surface the real HTTP status + a body snippet instead.
      const responseText = await response.text();
      try {
        rawResponse = JSON.parse(responseText);
      } catch {
        rawResponse = {
          error: `Non-JSON response from API (HTTP ${response.status})`,
          status: response.status,
          body: responseText.slice(0, 4000),
        };
      }

      // Capture response headers so the UI can optionally display them
      response.headers.forEach((value, key) => {
        rawResponseHeaders[key] = value;
      });
    }

    // Update job with response
    if (!responseOk) {
      updateJob(jobId, {
        rawResponse,
        rawResponseHeaders,
        status: 'failed',
        error: rawResponse.error || rawResponse.message || `HTTP ${responseStatus}`,
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: false,
        jobId,
        error: rawResponse.error || rawResponse.message || `HTTP ${responseStatus}`,
        rawRequest: job.rawRequest,
        rawResponse,
      }, { status: responseStatus });
    }

    // For async endpoints, extract request_id. A price check never gets one (the
    // /price endpoints answer synchronously), so it always falls through to the
    // sync completion path below.
    if (!isPriceCalc && endpoint.isAsync && rawResponse.data?.request_id) {
      // A request_id means the job was accepted and QUEUED — not yet being
      // computed. Mark it 'pending' (waiting in queue), not 'processing'; the
      // WebSocket / reconciliation poll flips it to 'processing' once a worker
      // actually starts, then to completed/failed. This avoids the misleading
      // "processing" flash (and the processing -> pending regression) right after
      // submit.
      updateJob(jobId, {
        requestId: rawResponse.data.request_id,
        rawResponse,
        rawResponseHeaders,
        status: 'pending',
      });

      return NextResponse.json({
        success: true,
        jobId,
        requestId: rawResponse.data.request_id,
        isAsync: true,
        rawRequest: job.rawRequest,
        rawResponse,
      });
    }

    // Price-only check with the inline boost enabled: the /price endpoint quotes
    // the inference alone, so quote the boost as well and expose base/boost/total
    // under `_tester`. The API payload itself stays verbatim.
    let priceCheckBoost: number | undefined;
    if (isPriceCalc && boostRequested && responseOk) {
      const basePrice = rawResponse?.data?.price ?? rawResponse?.price;
      const boostType = enhancementTypeForPath(endpoint.path);
      const modelSlug = typeof params.model === 'string' ? params.model : undefined;
      const promptText = typeof params.prompt === 'string' ? params.prompt : undefined;
      if (boostType && modelSlug && promptText) {
        const boostPrice = await fetchInlineBoostPrice(config.apiUrl, config.apiToken, {
          type: boostType,
          modelSlug,
          prompt: promptText,
          negativePrompt:
            typeof params.negative_prompt === 'string' ? params.negative_prompt : undefined,
          image: fileEntries.find((f) => f.file.type.startsWith('image/'))?.file,
        });
        if (boostPrice !== undefined) {
          priceCheckBoost = boostPrice;
          rawResponse._tester = {
            ...(rawResponse._tester || {}),
            base_price: basePrice,
            boost_price: boostPrice,
            total_price: (typeof basePrice === 'number' ? basePrice : 0) + boostPrice,
          };
        }
      }
    }

    // For sync endpoints, mark as completed
    // Only update costCredits if API returns it, otherwise keep the estimated price
    const syncUpdateData: Record<string, unknown> = {
      rawResponse,
      rawResponseHeaders,
      status: 'completed',
      completedAt: new Date().toISOString(),
      resultUrl: rawResponse.data?.result_url,
    };
    // Check for cost_credits (regular response), price (price-calculation), or balance (balance check)
    if (rawResponse.data?.cost_credits !== undefined) {
      syncUpdateData.costCredits = rawResponse.data.cost_credits;
    } else if (rawResponse.data?.price !== undefined) {
      syncUpdateData.costCredits = rawResponse.data.price;
    } else if (rawResponse.data?.balance !== undefined) {
      syncUpdateData.costCredits = rawResponse.data.balance;
    }
    // A price check's answer IS its price — there is no estimate/final pair to
    // reconcile, so record the quote as the job's price (and the separately
    // billed boost fee alongside it, when the check asked for one).
    if (isPriceCalc) {
      const quoted = rawResponse.data?.price ?? rawResponse.price;
      if (typeof quoted === 'number') {
        syncUpdateData.finalPrice = {
          amount: quoted,
          isEstimated: (rawResponse.data?.is_estimated ?? rawResponse.is_estimated) === true,
        };
        if (priceCheckBoost !== undefined) {
          syncUpdateData.estimateBreakdown = { base: quoted, boost: priceCheckBoost };
        }
      }
    }
    updateJob(jobId, syncUpdateData);

    return NextResponse.json({
      success: true,
      jobId,
      isAsync: false,
      rawRequest: job.rawRequest,
      rawResponse,
    });

  } catch (error) {
    console.error('[deapi-tester] POST /api/proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Don't leave a pre-created job stuck (e.g. in 'sending'/'pending') when the
    // request throws before a response was recorded — mark it failed so the UI
    // reflects the error instead of spinning forever.
    if (persistedJobId) {
      updateJob(persistedJobId, {
        status: 'failed',
        error: errorMessage,
        completedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
