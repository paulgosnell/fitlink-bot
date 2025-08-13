export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTQ1MTcsImV4cCI6MjA3MDQ3MDUxN30.brHKkPojybFjpW9kCbPTaRsGWlCmjrGEYmpDgCStSGo';
    
    // Forward to Supabase OAuth function with auth header
    const response = await fetch(`${SUPABASE_URL}/functions/v1/oauth-oura${url.pathname}${url.search}`, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      body: request.method !== 'GET' ? await request.text() : undefined
    });
    
    // Return Supabase response
    const responseData = await response.text();
    return new Response(responseData, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/html'
      }
    });
    
  } catch (error) {
    console.error('OAuth Oura proxy error:', error);
    return new Response('OAuth error', { status: 500 });
  }
};

export const config = {
  path: "/oauth-oura/*"
};