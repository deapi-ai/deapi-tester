import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { addJob, generateJobId, updateJob } from '@/lib/storage';
import { getEndpointById } from '@/lib/endpoint-registry';
import { Job, JsonValue } from '@/lib/types';

// POST /api/proxy - Proxy request to deAPI
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let endpointId: string;
    let params: Record<string, JsonValue>;
    let formData: FormData | null = null;

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
        }
      });
    } else {
      const body = await request.json();
      endpointId = body._endpointId;
      params = { ...body };
      delete params._endpointId;
    }

    // Validate endpoint
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) {
      return NextResponse.json(
        { error: `Unknown endpoint: ${endpointId}` },
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

    // Build request
    const url = config.apiUrl.replace(/\/$/, '') + endpoint.path;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiToken}`,
    };

    let fetchOptions: RequestInit;
    let bodyForLog: JsonValue;

    if (endpoint.contentType === 'multipart' && formData) {
      // Remove our internal field
      formData.delete('_endpointId');
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

    // Fetch estimated price if endpoint supports price calculation
    let estimatedPrice: number | undefined;
    if (endpoint.hasPriceCalc && endpoint.priceCalcPath) {
      try {
        const priceUrl = config.apiUrl.replace(/\/$/, '') + endpoint.priceCalcPath;
        console.log('[deapi-tester] Fetching price from:', priceUrl);
        const priceResponse = await fetch(priceUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });
        const priceData = await priceResponse.json();
        console.log('[deapi-tester] Price response:', priceResponse.status, priceData);
        if (priceResponse.ok && priceData.data?.price !== undefined) {
          estimatedPrice = priceData.data.price;
        }
      } catch (priceErr) {
        console.error('[deapi-tester] Price calculation failed:', priceErr);
      }
    }

    // Create job entry before making request
    const jobId = generateJobId();
    const job: Job = {
      id: jobId,
      requestId: '', // Will be updated after response
      endpointId,
      params,
      rawRequest: {
        method: endpoint.method,
        url: finalUrl,
        headers: { ...headers, Authorization: 'Bearer ***' }, // Mask token in logs
        body: bodyForLog,
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      costCredits: estimatedPrice,
    };
    addJob(job);

    // Make request to deAPI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(finalUrl, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawResponse = await response.json();

    // Update job with response
    if (!response.ok) {
      updateJob(jobId, {
        rawResponse,
        status: 'failed',
        error: rawResponse.error || rawResponse.message || `HTTP ${response.status}`,
        completedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: false,
        jobId,
        error: rawResponse.error || rawResponse.message || `HTTP ${response.status}`,
        rawRequest: job.rawRequest,
        rawResponse,
      }, { status: response.status });
    }

    // For async endpoints, extract request_id
    if (endpoint.isAsync && rawResponse.data?.request_id) {
      updateJob(jobId, {
        requestId: rawResponse.data.request_id,
        rawResponse,
        status: 'processing',
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

    // For sync endpoints, mark as completed
    // Only update costCredits if API returns it, otherwise keep the estimated price
    const syncUpdateData: Record<string, unknown> = {
      rawResponse,
      status: 'completed',
      completedAt: new Date().toISOString(),
      resultUrl: rawResponse.data?.result_url,
    };
    if (rawResponse.data?.cost_credits !== undefined) {
      syncUpdateData.costCredits = rawResponse.data.cost_credits;
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
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
