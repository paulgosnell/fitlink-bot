export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTQ1MTcsImV4cCI6MjA3MDQ3MDUxN30.brHKkPojybFjpW9kCbPTaRsGWlCmjrGEYmpDgCStSGo';
    
    console.log('OAuth Strava proxy hit:', url.pathname, url.search);
    
    // Forward to Supabase OAuth function with auth header
    // Extract path after /oauth-strava
    const supabasePath = url.pathname.replace('/oauth-strava', '') || '/start';
    const targetUrl = `${SUPABASE_URL}/functions/v1/oauth-strava${supabasePath}${url.search}`;
    
    console.log('Forwarding to:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
      redirect: 'manual' // Don't follow redirects - pass them through
    });
    
    console.log('Supabase response status:', response.status);
    
    // If it's a redirect, pass it through
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      console.log('Redirect to:', location);
      return new Response('', {
        status: response.status,
        headers: {
          'Location': location
        }
      });
    }
    
    // Otherwise return the response normally
    const responseData = await response.text();
    const contentType = response.headers.get('Content-Type') || 'text/html';
    console.log('Response Content-Type:', contentType);
    
    return new Response(responseData, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('OAuth Strava proxy error:', error);
    return new Response('OAuth error', { status: 500 });
  }
};

export const config = {
  path: ["/oauth-strava", "/oauth-strava/*"]
};