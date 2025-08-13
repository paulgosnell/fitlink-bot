export default async (request, context) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get the request body
    const body = await request.text();
    
    // Hardcode the values for now to ensure they work
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    
    console.log('Proxy received request, body length:', body.length);
    console.log('Forwarding to:', `${SUPABASE_URL}/functions/v1/telegram-webhook`);
    
    // Forward to Supabase Edge Function with auth header
    const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: body
    });
    
    // Log for debugging
    console.log('Supabase response status:', response.status);
    
    // Return Supabase response to Telegram
    const responseData = await response.text();
    console.log('Supabase response:', responseData.substring(0, 200));
    
    return new Response(responseData, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    // Return 200 OK to prevent Telegram retries on errors
    return new Response(JSON.stringify({ ok: true, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/telegram-webhook"
};