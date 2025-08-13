export default async (request, context) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get the request body
    const body = await request.text();
    
    // Get Supabase URL and anon key from environment
    const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Missing Supabase configuration');
      return new Response('Configuration error', { status: 500 });
    }
    
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
    console.log('Telegram webhook forwarded:', response.status);
    
    // Return Supabase response to Telegram
    const responseData = await response.text();
    return new Response(responseData, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    // Return 200 OK to prevent Telegram retries on errors
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/telegram-webhook"
};