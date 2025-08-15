export default async (request, context) => {
  try {
    // Get environment variables with fallbacks
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 
      context?.env?.VITE_SUPABASE_ANON_KEY || 
      context?.env?.SUPABASE_ANON_KEY ||
      Deno?.env?.get?.('VITE_SUPABASE_ANON_KEY') ||
      Deno?.env?.get?.('SUPABASE_ANON_KEY') ||
      '';

    if (!SUPABASE_ANON_KEY) {
      console.error('Missing SUPABASE_ANON_KEY in environment');
      return new Response('Missing VITE_SUPABASE_ANON_KEY environment variable', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Build target URL
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/oauth-oura/, '/oauth-oura');
    const targetUrl = `${SUPABASE_URL}/functions/v1${path}${url.search}`;

    // Proxy the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      redirect: 'manual',
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });
    
    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        return Response.redirect(location, response.status);
      }
    }
    
    // Return response with proper headers
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/html; charset=UTF-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err) {
    console.error('OAuth proxy error:', err);
    return new Response(`Proxy error: ${err?.message || err}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

export const config = {
  path: ['/oauth-oura', '/oauth-oura/*']
};