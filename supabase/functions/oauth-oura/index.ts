import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Environment variables
    const clientId = Deno.env.get("OURA_CLIENT_ID");
    const clientSecret = Deno.env.get("OURA_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const baseUrl = Deno.env.get("BASE_URL");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // Start OAuth flow
    if (path.endsWith('/start')) {
      const userId = url.searchParams.get('user_id');
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Missing user_id parameter" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-oura/callback`;
      const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?` + 
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=email personal daily&` +
        `state=${state}`;

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': ouraAuthUrl
        }
      });
    }

    // Handle OAuth callback
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        return new Response(
          `<html><body><h1>Authorization Error</h1><p>${error}</p><p>You can close this window.</p></body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      if (!code) {
        return new Response(
          `<html><body><h1>Authorization Error</h1><p>No authorization code received</p></body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://api.ouraring.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `${baseUrl}/oauth-oura/callback`,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        
        // Get user info
        const userResponse = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        const ouraUserData = userResponse.ok ? await userResponse.json() : {};
        
        // Store connection info
        const userId = state ? state.split('_')[0] : null;
        if (supabase && userId) {
          const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
          
          await supabase
            .from('providers')
            .upsert({
              user_id: parseInt(userId),
              provider: 'oura',
              access_token: tokenData.access_token, // Will be encrypted by RLS
              refresh_token: tokenData.refresh_token || null,
              expires_at: expiresAt,
              provider_user_id: ouraUserData.id || 'unknown',
              scopes: ['personal', 'daily'],
              is_active: true,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,provider'
            });
        }

        return new Response(
          `<!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Oura Ring Connected</title>
          </head>
          <body>
            <h1>✓ Oura Ring Connected!</h1>
            <p>Your Oura Ring has been successfully connected to Fitlink Bot.</p>
            <p>You can now close this window and return to Telegram.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );

      } catch (error) {
        console.error("OAuth callback error:", error);
        return new Response(
          `<html><body><h1>Connection Error</h1><p>Failed to connect your Oura Ring. Please try again.</p></body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("OAuth function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});