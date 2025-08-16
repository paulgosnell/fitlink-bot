export default async (request, context) => {
  try {
    // 🚨 CRITICAL: Hardcoded Supabase URL (not env var)
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    
    // 🚨 CRITICAL: Multiple env var access methods
    const SUPABASE_ANON_KEY = 
      context?.env?.VITE_SUPABASE_ANON_KEY || 
      context?.env?.SUPABASE_ANON_KEY ||
      Deno?.env?.get?.('VITE_SUPABASE_ANON_KEY') ||
      Deno?.env?.get?.('SUPABASE_ANON_KEY');

    if (!SUPABASE_ANON_KEY) {
      return new Response('Missing Supabase key', { status: 500 });
    }

    const path = new URL(request.url).pathname.replace('/test-schema', '');
    const targetUrl = `${SUPABASE_URL}/functions/v1/test-schema${path}${new URL(request.url).search}`;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
      redirect: 'manual' // REQUIRED
    });

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) return Response.redirect(location, response.status);
    }

    const body = await response.text();
    const headers = new Headers();
    
    // Copy important headers
    ['content-type', 'cache-control'].forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });

    // Fix Content-Type for HTML responses
    if (body.trim().startsWith('<!DOCTYPE html>') || body.includes('<html')) {
      headers.set('Content-Type', 'text/html; charset=UTF-8');
    } else if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
      headers.set('Content-Type', 'application/json');
    }

    return new Response(body, { 
      status: response.status, 
      headers 
    });

  } catch (err) {
    console.error('Test schema proxy error:', err);
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
};
