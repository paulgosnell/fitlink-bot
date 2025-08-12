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
      
      // Return HTML with meta refresh
      const html = `
        <html>
        <head>
          <meta http-equiv="refresh" content="0; url=https://fitlinkbot.netlify.app/oura-success.html">
        </head>
        <body>
          <p>Redirecting...</p>
        </body>
        </html>
      `;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
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