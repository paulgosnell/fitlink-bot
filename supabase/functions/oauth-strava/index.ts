import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // OAuth callback
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (code && state) {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Strava Connected</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #fc4c02 0%, #ff955a 100%); color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .container { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 2rem; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); }
    h1 { margin-top: 0; font-size: 2rem; }
    p { font-size: 1.1rem; opacity: 0.9; }
  </style>
  </head>
  <body>
    <div class="container">
      <h1>✅ Strava Connected!</h1>
      <p>Your Strava account has been successfully connected to Fitlink Bot.</p>
      <p>You can now close this window and return to Telegram.</p>
    </div>
    <script> setTimeout(() => { window.close(); }, 3000); </script>
  </body>
</html>`;

      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response(JSON.stringify({ error: 'Missing code or state' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // OAuth start
  if (path.endsWith('/start')) {
    const userId = url.searchParams.get('user_id');
    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const baseUrl = Deno.env.get('BASE_URL');

    if (userId && clientId && baseUrl) {
      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-strava/callback`;

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'read,activity:read_all',
        state,
        approval_prompt: 'auto',
      });

      const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
      return Response.redirect(stravaAuthUrl, 302);
    }

    return new Response(JSON.stringify({ error: 'Missing STRAVA_CLIENT_ID, BASE_URL, or user_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});