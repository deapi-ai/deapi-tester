import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

// Force dynamic to prevent caching - config can change
export const dynamic = 'force-dynamic';

// deAPI paginates /models: default 25 per page, `limit` is capped at 50 server-side.
// Fetch every page so the models cache is always complete.
const PAGE_LIMIT = 50;
const MAX_PAGES = 20;

interface ModelsPage {
  data?: unknown[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

// GET /api/models - Proxy to deAPI /models endpoint
export async function GET() {
  try {
    const config = loadConfig();

    if (!config.apiToken) {
      return NextResponse.json(
        { error: 'API token not configured' },
        { status: 401 }
      );
    }

    const baseUrl = `${config.apiUrl.replace(/\/$/, '')}/models`;
    const models: unknown[] = [];
    let lastMeta: ModelsPage['meta'];
    let page = 1;
    let lastPage = 1;

    while (page <= lastPage && page <= MAX_PAGES) {
      const url = `${baseUrl}?limit=${PAGE_LIMIT}&page=${page}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: data.error || data.message || `HTTP ${response.status}` },
          { status: response.status }
        );
      }

      const pageData = data as ModelsPage;
      models.push(...(pageData.data ?? []));
      lastMeta = pageData.meta;
      lastPage = pageData.meta?.last_page ?? 1;
      page += 1;
    }

    if (page > MAX_PAGES && page <= lastPage) {
      console.warn(`[deapi-tester] /models pagination stopped at ${MAX_PAGES} pages (last_page=${lastPage})`);
    }

    return NextResponse.json({ data: models, meta: lastMeta }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[deapi-tester] GET /api/models error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
