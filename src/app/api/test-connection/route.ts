import { NextResponse } from 'next/server';
import { loadFullConfig } from '@/lib/config';

// POST /api/test-connection - Verify a profile's API URL + token reach a live
// deAPI by hitting /models. Used by the settings drawer BEFORE saving a profile,
// so a typo'd URL or a bad/missing token is caught (and can be confirmed) up
// front instead of only surfacing later as a failed models/balance load.
//
// Body: { apiUrl, apiToken?, profileId? }. The token is resolved server-side:
// an explicit non-empty apiToken wins; otherwise the stored token for profileId
// is used — the browser only ever sees a masked token, so when editing an
// existing profile without retyping the token it must fall back to the stored
// one. The token is never echoed back.
//
// Always responds HTTP 200; the connection result is the JSON body's `ok` field.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiUrl: string = typeof body.apiUrl === 'string' ? body.apiUrl.trim() : '';
    const providedToken: string = typeof body.apiToken === 'string' ? body.apiToken : '';
    const profileId: string | undefined =
      typeof body.profileId === 'string' ? body.profileId : undefined;

    if (!apiUrl) {
      return NextResponse.json({ ok: false, status: 0, error: 'API URL is required' });
    }

    // Resolve the token to test with (explicit token wins, else stored profile token).
    let token = providedToken.trim();
    if (!token && profileId) {
      const cfg = loadFullConfig();
      token = cfg.profiles.find((p) => p.id === profileId)?.apiToken || '';
    }
    if (!token) {
      return NextResponse.json({ ok: false, status: 0, error: 'No API token to test with' });
    }

    const url = apiUrl.replace(/\/$/, '') + '/models';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : 'Request failed';
      return NextResponse.json({ ok: false, status: 0, error: `Cannot reach API: ${message}` });
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      // The body may be non-JSON (e.g. an HTML 404 page); extract a message best-effort.
      const text = await res.text();
      let apiError: string | undefined;
      try {
        const json = JSON.parse(text);
        apiError = json?.error || json?.message;
      } catch {
        apiError = undefined;
      }
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: apiError || `HTTP ${res.status}`,
      });
    }

    return NextResponse.json({ ok: true, status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, status: 0, error: message });
  }
}
