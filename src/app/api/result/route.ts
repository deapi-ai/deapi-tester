import { NextResponse } from 'next/server';

// Transcription results are text/JSON files on (often internal or presigned)
// storage that the browser cannot fetch directly, so the preview goes through
// the server like every other deAPI call. Capped so a huge transcript can never
// blow up the UI.
const MAX_BYTES = 4 * 1024 * 1024;

// GET /api/result?url=... — fetch a text/JSON result file for in-app preview.
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) URLs are supported' }, { status: 400 });
  }

  try {
    const response = await fetch(target, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch result: HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const truncated = buffer.length > MAX_BYTES;

    return NextResponse.json({
      contentType: response.headers.get('content-type') || '',
      size: buffer.length,
      truncated,
      text: buffer.subarray(0, MAX_BYTES).toString('utf-8'),
    });
  } catch (error) {
    console.error('[deapi-tester] GET /api/result error:', error);
    // fetch() reports connection problems as a bare "fetch failed"; name the host
    // so an unreachable result URL (e.g. an internal storage hostname that only
    // resolves inside the API's network) is obvious rather than mysterious.
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : null;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `${message} (${target.host})${cause ? ` — ${cause}` : ''}` },
      { status: 502 }
    );
  }
}
