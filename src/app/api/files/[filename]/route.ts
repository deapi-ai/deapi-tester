import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { mimeTypeFromName } from '@/lib/media-types';
import * as fs from 'fs';
import * as path from 'path';

// GET /api/files/[filename] - Serve a file from output directory
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const decoded = decodeURIComponent(filename);

    // Path traversal protection
    if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const config = loadConfig();
    const outputDir = path.resolve(process.cwd(), config.outputDir);
    const filePath = path.join(outputDir, decoded);

    // Ensure resolved path is still within outputDir
    if (!filePath.startsWith(outputDir + path.sep)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const contentType = mimeTypeFromName(decoded);
    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[deapi-tester] GET /api/files/[filename] error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
