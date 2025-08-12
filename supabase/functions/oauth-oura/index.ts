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
      console.error("Missing OAuth environment variables");
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

      // Generate state parameter for security
      const state = crypto.randomUUID();
      const redirectUri = `${baseUrl}/oauth-oura/callback`;

      // Store state in database or session (simplified here)
      const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?` + 
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=email personal daily&` +
        `state=${state}`;

      console.log("Starting Oura OAuth flow for user:", userId);
      
      // Redirect to Oura authorization
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
        console.error("OAuth error:", error);
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
          const errorText = await tokenResponse.text();
          console.error("Token exchange failed:", errorText);
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        console.log("Oura token exchange successful");

        // Get user info from Oura
        const userResponse = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        let ouraUserId = null;
        if (userResponse.ok) {
          const userData = await userResponse.json();
          ouraUserId = userData.id;
        }

        // TODO: Store encrypted tokens in database
        // For now, return success message
        console.log("Oura OAuth completed successfully");

        return new Response(
          `<html><body>
            <h1> Oura Ring Connected!</h1>
            <p>Your Oura Ring has been successfully connected to Fitlink Bot.</p>
            <p>You can now close this window and return to Telegram.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
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