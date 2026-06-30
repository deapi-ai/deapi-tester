import { getActiveProfile, resolveWsAuthUrl } from '@/lib/config';

// POST /api/ws-auth - Private-channel auth proxy for the Pusher/soketi client.
//
// The browser never has the API token, so it cannot call deAPI's
// /broadcasting/auth directly. pusher-js POSTs { socket_id, channel_name } here
// (form-encoded by default); we inject the active profile's Bearer token,
// forward to the profile's broadcasting/auth URL, and return the { auth }
// signature verbatim.
export async function POST(request: Request) {
  try {
    const profile = getActiveProfile();

    if (!profile || !profile.apiToken) {
      return new Response(JSON.stringify({ error: 'API token not configured' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // pusher-js (transport: 'ajax') sends application/x-www-form-urlencoded;
    // accept JSON too just in case.
    let socketId = '';
    let channelName = '';
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      socketId = body.socket_id;
      channelName = body.channel_name;
    } else {
      const form = await request.formData();
      socketId = String(form.get('socket_id') || '');
      channelName = String(form.get('channel_name') || '');
    }

    if (!socketId || !channelName) {
      return new Response(
        JSON.stringify({ error: 'socket_id and channel_name are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authUrl = resolveWsAuthUrl(profile);
    if (!authUrl) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve broadcasting auth URL for this profile' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const upstream = await fetch(authUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      console.error(
        `[deapi-tester] ws-auth failed (${upstream.status}) for ${channelName}:`,
        text.slice(0, 500)
      );
      return new Response(
        JSON.stringify({ error: `Broadcasting auth failed (${upstream.status})` }),
        { status: upstream.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pass the { auth: "key:signature" } payload straight back to pusher-js.
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[deapi-tester] ws-auth error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
