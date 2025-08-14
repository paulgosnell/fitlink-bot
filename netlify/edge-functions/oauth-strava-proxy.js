export default async (request, context) => {
  const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
  const SUPABASE_ANON_KEY = context.env.SUPABASE_ANON_KEY;

  try {
    if (!SUPABASE_ANON_KEY) {
      return new Response('Missing SUPABASE_ANON_KEY', { status: 500 });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/oauth-strava/, '/oauth-strava');
    const targetUrl = `${SUPABASE_URL}/functions/v1${path}${url.search}`;

    const init = {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    const response = await fetch(targetUrl, init);
    const bodyText = await response.text();
    const contentType = response.headers.get('Content-Type') || 'text/html; charset=UTF-8';

    return new Response(bodyText, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    return new Response(`Proxy error: ${err?.message || 'unknown'}`, { status: 500 });
  }
};

export const config = {
  path: ['/oauth-strava', '/oauth-strava/*']
};


