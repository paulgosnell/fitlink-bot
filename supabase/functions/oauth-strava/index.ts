import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createOrUpdateProvider } from "../shared/database/providers.ts";
import { getUserByTelegramId } from "../shared/database/users.ts";

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
      try {
        // Parse state to get user_id
        const [userId, _] = state.split('_');
        
        console.log('Strava OAuth callback received:', { code: code?.substring(0, 10) + '...', state });
        console.log('Parsed user ID:', userId);
        
        // Exchange code for tokens
        console.log('Exchanging code for tokens...');
        const tokens = await exchangeCodeForTokens(code);
        console.log('Token exchange successful:', { athlete_id: tokens.athlete?.id });
        
        // Get user from database
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        console.log('Looking up user with Telegram ID:', userId);
        const user = await getUserByTelegramId(supabase, parseInt(userId));
        if (!user) {
          console.error('User not found for Telegram ID:', userId);
          throw new Error('User not found');
        }
        console.log('User found:', { id: user.id, telegram_id: user.telegram_id });

        // Store tokens in database
        console.log('Storing tokens in database...');
        await createOrUpdateProvider(supabase, {
          user_id: user.id,
          provider: 'strava',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          provider_user_id: tokens.athlete?.id?.toString(),
          scopes: ['read', 'activity:read_all']
        });

        // Trigger initial backfill for this user (best-effort)
        try {
          const baseUrl = Deno.env.get('SUPABASE_URL');
          const anon = Deno.env.get('SUPABASE_ANON_KEY');
          if (baseUrl && anon) {
            await fetch(`${baseUrl}/functions/v1/data-sync-strava`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
              body: JSON.stringify({ user_id: user.id })
            });
          }
        } catch (_) {
          // ignore backfill failure
        }

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
    .success { color: #4ade80; }
  </style>
  </head>
  <body>
    <div class="container">
      <h1>✅ Strava Connected!</h1>
      <p>Your Strava account has been successfully connected to Fitlink Bot.</p>
      <p class="success">Redirecting you back to Telegram to check your status...</p>
    </div>
    <script>
        // Redirect to Telegram bot with /status command after 2 seconds
        setTimeout(() => {
            window.location.href = 'https://t.me/the_fitlink_bot?start=status';
        }, 2000);
        
        // Also try to close window as fallback
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
  </body>
</html>`;

        return new Response(html, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/html; charset=UTF-8'
          }
        });
      } catch (error) {
        console.error('Error in Strava OAuth callback:', error);
        
        const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connection Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #ef4444 0%, #fca5a5 100%); color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .container { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); padding: 2rem; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); }
    h1 { margin-top: 0; font-size: 2rem; }
    p { font-size: 1.1rem; opacity: 0.9; }
  </style>
  </head>
  <body>
    <div class="container">
      <h1>❌ Connection Failed</h1>
      <p>Sorry, we couldn't connect your Strava account.</p>
      <p>Please try again or contact support if the problem persists.</p>
    </div>
    <script> 
      setTimeout(() => { 
        window.close(); 
      }, 5000); 
    </script>
  </body>
</html>`;

        return new Response(errorHtml, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/html; charset=UTF-8'
          }
        });
      }
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
    const baseUrl = "https://fitlinkbot.netlify.app"; // Use Netlify proxy for callbacks

    if (userId && clientId) {
      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-strava/callback`;
      
      console.log('Redirecting to Strava OAuth:', { clientId: clientId?.substring(0, 8) + '...', redirectUri });

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

    return new Response(JSON.stringify({ error: 'Missing STRAVA_CLIENT_ID or user_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

async function exchangeCodeForTokens(code: string) {
  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  const baseUrl = "https://fitlinkbot.netlify.app";
  const redirectUri = `${baseUrl}/oauth-strava/callback`;

  console.log('Token exchange with client_id:', clientId?.substring(0, 8) + '...');

  if (!clientId || !clientSecret) {
    console.error('Missing Strava credentials:', { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    throw new Error('Missing Strava credentials');
  }

  console.log('Making token request to Strava API...');
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });

  console.log('Strava API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Strava token exchange failed:', response.status, errorText);
    throw new Error(`Failed to exchange code for tokens: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Token exchange response keys:', Object.keys(data));
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ? new Date(Date.now() + data.expires_at * 1000).toISOString() : undefined,
    athlete: data.athlete
  };
}