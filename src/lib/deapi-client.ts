import { loadConfig } from './config';

export interface DeApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rawRequest: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  rawResponse: unknown;
  statusCode: number;
}

export interface SubmitJobResponse {
  data: {
    request_id: string;
  };
}

export interface JobResultResponse {
  data: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_url?: string;
    result?: unknown;
    error?: string;
    cost_credits?: number;
  };
}

// Build full URL for endpoint
function buildUrl(path: string, queryParams?: Record<string, string>): string {
  const config = loadConfig();
  let url = config.apiUrl.replace(/\/$/, '') + path;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += '?' + params.toString();
  }

  return url;
}

// Get authorization headers
function getAuthHeaders(): Record<string, string> {
  const config = loadConfig();
  return {
    'Authorization': `Bearer ${config.apiToken}`,
  };
}

// POST request with JSON body
export async function postJson<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<DeApiResponse<T>> {
  const url = buildUrl(path);
  const headers = {
    ...getAuthHeaders(),
    'Content-Type': 'application/json',
  };

  const rawRequest = {
    method: 'POST',
    url,
    headers,
    body,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: rawResponse.error || rawResponse.message || `HTTP ${response.status}`,
        rawRequest,
        rawResponse,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data: rawResponse as T,
      rawRequest,
      rawResponse,
      statusCode: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      rawRequest,
      rawResponse: null,
      statusCode: 0,
    };
  }
}

// POST request with multipart/form-data
export async function postMultipart<T = unknown>(
  path: string,
  formData: FormData
): Promise<DeApiResponse<T>> {
  const url = buildUrl(path);
  const headers = getAuthHeaders();
  // Don't set Content-Type for FormData - browser will set it with boundary

  const rawRequest = {
    method: 'POST',
    url,
    headers,
    body: '[FormData]', // Can't serialize FormData to JSON
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: rawResponse.error || rawResponse.message || `HTTP ${response.status}`,
        rawRequest,
        rawResponse,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data: rawResponse as T,
      rawRequest,
      rawResponse,
      statusCode: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      rawRequest,
      rawResponse: null,
      statusCode: 0,
    };
  }
}

// GET request
export async function get<T = unknown>(
  path: string,
  queryParams?: Record<string, string>
): Promise<DeApiResponse<T>> {
  const url = buildUrl(path, queryParams);
  const headers = {
    ...getAuthHeaders(),
    'Accept': 'application/json',
  };

  const rawRequest = {
    method: 'GET',
    url,
    headers,
    body: null,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: rawResponse.error || rawResponse.message || `HTTP ${response.status}`,
        rawRequest,
        rawResponse,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data: rawResponse as T,
      rawRequest,
      rawResponse,
      statusCode: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      rawRequest,
      rawResponse: null,
      statusCode: 0,
    };
  }
}

// Poll job result by request_id
export async function getJobResult(requestId: string): Promise<DeApiResponse<JobResultResponse>> {
  return get<JobResultResponse>(`/result/${requestId}`);
}

// Get available models
export async function getModels(): Promise<DeApiResponse> {
  return get('/models');
}

// Get account balance
export async function getBalance(): Promise<DeApiResponse> {
  return get('/balance');
}
