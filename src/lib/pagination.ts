// Shared pagination walker for deAPI list endpoints.
//
// deAPI paginates Laravel-style: responses carry `meta.current_page` /
// `meta.last_page`, and the query accepts `page` + `limit`. Two quirks, both
// verified against the live API:
//   - `per_page` is accepted but SILENTLY IGNORED — only `limit` has an effect.
//   - `limit` is capped at 50 server-side (limit=100 still returns per_page=50),
//     so collecting more than 50 items ALWAYS requires walking pages.
export const PAGE_LIMIT = 50;
export const MAX_PAGES = 20;

export interface PaginationMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  [key: string]: unknown;
}

interface PaginatedPage {
  data?: unknown[];
  meta?: PaginationMeta;
}

export type FetchAllPagesResult =
  | {
      ok: true;
      data: unknown[];
      meta?: PaginationMeta;
      pagesFetched: number;
      truncated: boolean;
    }
  | { ok: false; status: number; body: Record<string, unknown> };

interface FetchAllPagesOptions {
  // Extra query params carried onto every page request. `page` and `limit` are
  // always set by this function and cannot be overridden.
  query?: Record<string, string>;
  signal?: AbortSignal;
}

// Walk every page of a paginated deAPI GET endpoint and concatenate the items.
// Stops early (with `truncated: true`) at MAX_PAGES so a bad `last_page` can
// never spin forever. Any non-OK / non-JSON page aborts the walk and is
// returned verbatim so the caller can surface the real API error.
export async function fetchAllPages(
  baseUrl: string,
  token: string,
  options?: FetchAllPagesOptions
): Promise<FetchAllPagesResult> {
  const data: unknown[] = [];
  let meta: PaginationMeta | undefined;
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage && page <= MAX_PAGES) {
    const query = new URLSearchParams(options?.query);
    query.set('limit', String(PAGE_LIMIT));
    query.set('page', String(page));

    const response = await fetch(`${baseUrl}?${query.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      signal: options?.signal,
    });

    // Parse defensively — a gateway can answer with an HTML error page, and
    // response.json() would throw a cryptic "Unexpected token '<'".
    const text = await response.text();
    let body: unknown;
    let parsed = true;
    try {
      body = JSON.parse(text);
    } catch {
      parsed = false;
      body = {
        error: `Non-JSON response from API (HTTP ${response.status})`,
        status: response.status,
        body: text.slice(0, 4000),
      };
    }

    if (!response.ok || !parsed) {
      return {
        ok: false,
        // A 200 that isn't JSON is an upstream fault, not a client error.
        status: response.ok ? 502 : response.status,
        body: body as Record<string, unknown>,
      };
    }

    const pageBody = body as PaginatedPage;
    data.push(...(pageBody.data ?? []));
    meta = pageBody.meta;
    lastPage = pageBody.meta?.last_page ?? 1;
    page += 1;
  }

  const truncated = page > MAX_PAGES && page <= lastPage;
  if (truncated) {
    console.warn(
      `[deapi-tester] pagination stopped at ${MAX_PAGES} pages (last_page=${lastPage}) for ${baseUrl}`
    );
  }

  return { ok: true, data, meta, pagesFetched: page - 1, truncated };
}
