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
      redirect: 'manual'
    });
    
    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        return Response.redirect(location, response.status);
      }
    }
    
    // For HTML responses, we need to read the body and set headers explicitly
    const contentType = response.headers.get('Content-Type') || '';
    const body = await response.text();
    
    // Create new headers object
    const headers = new Headers();
    
    // Copy CORS headers
    const corsHeaders = ['Access-Control-Allow-Origin', 'Access-Control-Allow-Headers'];
    corsHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });
    
    // Set Content-Type explicitly
    if (contentType.includes('text/html') || body.trim().startsWith('<!DOCTYPE html>')) {
      headers.set('Content-Type', 'text/html; charset=UTF-8');
    } else {
      headers.set('Content-Type', contentType || 'text/plain');
    }
    
    headers.set('Cache-Control', 'no-cache');
    
    return new Response(body, {
      status: response.status,
      headers
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