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

    if (contentType.includes('image/png')) ext = 'png';
    else if (contentType.includes('image/jpeg')) ext = 'jpg';
    else if (contentType.includes('image/webp')) ext = 'webp';
    else if (contentType.includes('video/mp4')) ext = 'mp4';
    else if (contentType.includes('audio/mpeg')) ext = 'mp3';
    else if (contentType.includes('audio/wav')) ext = 'wav';
    else if (contentType.includes('application/json')) ext = 'json';
    else if (contentType.includes('text/plain')) ext = 'txt';
    else {
      // Try to get extension from URL
      const urlPath = new URL(resultUrl).pathname;
      const urlExt = path.extname(urlPath).slice(1);
      if (urlExt) ext = urlExt;
    }

    // Generate filename
    const job = jobId ? getJob(jobId) : null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const endpointId = job?.endpointId || 'unknown';
    const shortId = (job?.requestId || Math.random().toString(36).slice(2, 10)).slice(0, 8);
    const filename = `${endpointId}_${timestamp}_${shortId}.${ext}`;
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
