import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

// GET /api/balance - Proxy to deAPI /balance endpoint
export async function GET() {
  try {
    const config = loadConfig();

    if (!config.apiToken) {
      return NextResponse.json(
        { error: 'API token not configured' },
        { status: 401 }
      );
    }

    const url = `${config.apiUrl.replace(/\/$/, '')}/balance`;
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

    return NextResponse.json(data);
  } catch (error) {
    console.error('[deapi-tester] GET /api/balance error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
