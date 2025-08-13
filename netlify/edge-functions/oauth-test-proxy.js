export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTQ1MTcsImV4cCI6MjA3MDQ3MDUxN30.brHKkPojybFjpW9kCbPTaRsGWlCmjrGEYmpDgCStSGo';
    
    console.log('OAuth Test proxy hit:', url.pathname, url.search);
    
    // Forward to Supabase oauth-test function with auth header
    // Extract path after /oauth-test
    const supabasePath = url.pathname.replace('/oauth-test', '') || '/';
    const targetUrl = `${SUPABASE_URL}/functions/v1/oauth-test${supabasePath}${url.search}`;
    
    console.log('Forwarding to:', targetUrl);
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      body: request.method !== 'GET' ? await request.text() : undefined
    });
    
    console.log('Supabase response status:', response.status);
    
    // Return the response normally
    const responseData = await response.text();
    const contentType = response.headers.get('Content-Type') || 'application/json';
    console.log('Response Content-Type:', contentType);
    
    return new Response(responseData, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      }
    });
    
  } catch (error) {
    console.error('OAuth Test proxy error:', error);
    return new Response('OAuth error', { status: 500 });
  }
};

export const config = {
  path: ["/oauth-test", "/oauth-test/*"]
};
