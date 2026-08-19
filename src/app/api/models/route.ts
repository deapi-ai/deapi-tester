import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { fetchAllPages } from '@/lib/pagination';

// Force dynamic to prevent caching - config can change
export const dynamic = 'force-dynamic';

// GET /api/models - Proxy to deAPI /models endpoint.
// Walks every page (see lib/pagination) so the models cache is always complete —
// deAPI caps `limit` at 50, so a single request can never hold them all.
export async function GET() {
  try {
    const config = loadConfig();

    if (!config.apiToken) {
      return NextResponse.json(
        { error: 'API token not configured' },
        { status: 401 }
      );
    }

    const result = await fetchAllPages(
      `${config.apiUrl.replace(/\/$/, '')}/models`,
      config.apiToken
    );

    if (!result.ok) {
      const { error, message } = result.body;
      return NextResponse.json(
        {
          error:
            (typeof error === 'string' && error) ||
            (typeof message === 'string' && message) ||
            `HTTP ${result.status}`,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({ data: result.data, meta: result.meta }, {
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
