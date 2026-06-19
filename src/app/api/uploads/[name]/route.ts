import { NextResponse } from 'next/server';
import { getUploadPath } from '@/lib/upload-storage';
import * as fs from 'fs';

// GET /api/uploads/[name] - Serve a persisted upload by its stored name.
// Used to restore files into the form when duplicating a multipart request.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const decoded = decodeURIComponent(name);

    const filePath = getUploadPath(decoded);
    if (!filePath) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    // Content-Type is intentionally generic; the client rebuilds the File with the
    // correct mimeType from the job's uploadedFiles metadata.
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[deapi-tester] GET /api/uploads/[name] error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
