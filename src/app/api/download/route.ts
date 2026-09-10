import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { updateJob, getJob } from '@/lib/storage';
import * as fs from 'fs';
import * as path from 'path';

// POST /api/download - Download result from URL to output directory
export async function POST(request: Request) {
  try {
    const { jobId, resultUrl } = await request.json();

    if (!resultUrl) {
      return NextResponse.json(
        { error: 'Missing resultUrl parameter' },
        { status: 400 }
      );
    }

    const config = loadConfig();

    // Ensure output directory exists
    const outputDir = path.resolve(process.cwd(), config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Fetch the file
    const response = await fetch(resultUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    // Determine file extension from Content-Type or URL
    const contentType = response.headers.get('content-type') || '';
    let ext = 'bin';

    // The extension decides what the asset library shows this file as, so every
    // media type deAPI returns needs one — an unrecognised result saved as .bin
    // never appears in a picker again.
    const extByContentType: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'video/x-matroska': 'mkv',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'application/json': 'json',
      'text/plain': 'txt',
    };

    const matched = Object.keys(extByContentType).find((type) => contentType.includes(type));
    if (matched) ext = extByContentType[matched];
    else {
      // Try to get extension from URL
      const urlPath = new URL(resultUrl).pathname;
      const urlExt = path.extname(urlPath).slice(1);
      if (urlExt) ext = urlExt;
    }

    // Generate filename. `endpointId` is the v2 API path ("images/generations"),
    // so its separators have to be flattened: joined raw they would name a
    // subdirectory that does not exist (ENOENT), and creating it would only hide
    // the file from the asset library, which lists the output folder itself.
    const job = jobId ? getJob(jobId) : null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const endpointId = (job?.endpointId || 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    const shortId = (job?.requestId || Math.random().toString(36).slice(2, 10)).slice(0, 8);
    const filename = `${endpointId || 'unknown'}_${timestamp}_${shortId}.${ext}`;
    const filePath = path.join(outputDir, filename);

    // Save file
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Update job with local path
    if (jobId && job) {
      updateJob(jobId, { localPath: filePath });
    }

    return NextResponse.json({
      success: true,
      filename,
      path: filePath,
      size: buffer.length,
    });

  } catch (error) {
    console.error('[deapi-tester] POST /api/download error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
