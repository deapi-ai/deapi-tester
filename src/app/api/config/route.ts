import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/config';
import { AppConfig } from '@/lib/types';

// GET /api/config - Load current configuration
export async function GET() {
  try {
    const config = loadConfig();
    // Don't send full token to frontend - mask it
    const maskedConfig = {
      ...config,
      apiToken: config.apiToken ? '***' + config.apiToken.slice(-4) : '',
      hasToken: !!config.apiToken,
    };
    return NextResponse.json(maskedConfig);
  } catch (error) {
    console.error('[deapi-tester] GET /api/config error:', error);
    return NextResponse.json(
      { error: 'Failed to load configuration' },
      { status: 500 }
    );
  }
}

// PUT /api/config - Update configuration
export async function PUT(request: Request) {
  try {
    const body = await request.json() as Partial<AppConfig>;

    // Validate input
    if (body.apiUrl !== undefined && typeof body.apiUrl !== 'string') {
      return NextResponse.json(
        { error: 'apiUrl must be a string' },
        { status: 400 }
      );
    }

    if (body.apiToken !== undefined && typeof body.apiToken !== 'string') {
      return NextResponse.json(
        { error: 'apiToken must be a string' },
        { status: 400 }
      );
    }

    if (body.outputDir !== undefined && typeof body.outputDir !== 'string') {
      return NextResponse.json(
        { error: 'outputDir must be a string' },
        { status: 400 }
      );
    }

    const newConfig = saveConfig(body);

    // Return masked config
    const maskedConfig = {
      ...newConfig,
      apiToken: newConfig.apiToken ? '***' + newConfig.apiToken.slice(-4) : '',
      hasToken: !!newConfig.apiToken,
    };

    return NextResponse.json(maskedConfig);
  } catch (error) {
    console.error('[deapi-tester] PUT /api/config error:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}
