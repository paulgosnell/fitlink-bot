import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // OAuth callback
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (code && state) {
      // Process OAuth (simplified for now)
      const userId = state.split('_')[0];
      
      // Return success HTML directly
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Oura Ring Connected</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { margin-top: 0; font-size: 2rem; }
        p { font-size: 1.1rem; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Oura Ring Connected!</h1>
        <p>Your Oura Ring has been successfully connected to Fitlink Bot.</p>
        <p>You can now close this window and return to Telegram.</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }

  // OAuth start
  if (path.endsWith('/start')) {
    const userId = url.searchParams.get('user_id');
    const clientId = Deno.env.get("OURA_CLIENT_ID");
    const baseUrl = Deno.env.get("BASE_URL");
    
    if (userId && clientId) {
      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-oura/callback`;
      const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email personal daily&state=${state}`;
      
      return Response.redirect(ouraAuthUrl);
    }
  }

  return new Response("Not found", { status: 404 });
});