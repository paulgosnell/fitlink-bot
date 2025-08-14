export default async (request, context) => {
  const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
  const SUPABASE_ANON_KEY = context.env.VITE_SUPABASE_ANON_KEY || context.env.SUPABASE_ANON_KEY;

  try {
    if (!SUPABASE_ANON_KEY) {
      console.error('Missing VITE_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY in Netlify environment');
      return new Response('Missing VITE_SUPABASE_ANON_KEY environment variable in Netlify. Please set it in Netlify dashboard.', { status: 500 });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/oauth-oura/, '/oauth-oura');
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
    
    // Handle redirects properly
    if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
      const location = response.headers.get('Location');
      if (location) {
        return Response.redirect(location, response.status);
      }
    }
    
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
    console.error('OAuth proxy error:', err);
    return new Response(`Proxy error: ${err?.message || 'unknown'}`, { status: 500 });
  }
};

export const config = {
  path: ['/oauth-oura', '/oauth-oura/*']
};


