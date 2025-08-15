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
    
    console.log('OAuth callback received:', { code: code?.substring(0, 10) + '...', state });
    
    if (code && state) {
      try {
        // Parse state to get user_id
        const [userId, _] = state.split('_');
        console.log('Parsed user ID:', userId);
        
        // Exchange code for tokens
        console.log('Exchanging code for tokens...');
        const tokens = await exchangeCodeForTokens(code);
        console.log('Token exchange successful:', { user_id: tokens.user_id });
        
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
          provider: 'oura',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          provider_user_id: tokens.user_id?.toString(),
          scopes: ['email', 'personal', 'daily']
        });

        // Trigger initial data sync (last 7 days)
        console.log('Triggering initial Oura data sync...');
        try {
          await syncInitialOuraData(supabase, user.id, tokens.access_token);
          console.log('Initial data sync completed successfully');
        } catch (syncError) {
          console.error('Initial data sync failed:', syncError);
          // Don't fail the OAuth flow if sync fails
        }

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
        .success { color: #4ade80; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Oura Ring Connected!</h1>
        <p>Your Oura Ring has been successfully connected to Fitlink Bot.</p>
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
        console.error('Error in Oura OAuth callback:', error);
        
        const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connection Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ef4444 0%, #fca5a5 100%);
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
        <h1>❌ Connection Failed</h1>
        <p>Sorry, we couldn't connect your Oura Ring.</p>
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
  }

  // OAuth start
  if (path.endsWith('/start')) {
    try {
      const userId = url.searchParams.get('user_id');
      const clientId = Deno.env.get("OURA_CLIENT_ID");
      // CRITICAL: Always use Netlify URL for OAuth callbacks (not Supabase direct URL)
      const baseUrl = "https://fitlinkbot.netlify.app";
      
      if (!userId) return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: corsHeaders });
      if (!clientId) return new Response(JSON.stringify({ error: 'Missing OURA_CLIENT_ID' }), { status: 500, headers: corsHeaders });

      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-oura/callback`;
      const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email personal daily&state=${state}`;
      
      console.log('Redirecting to Oura OAuth:', ouraAuthUrl);
      return Response.redirect(ouraAuthUrl);
    } catch (e) {
      console.error('OAuth start error (Oura):', e);
      return new Response(JSON.stringify({ error: 'OAuth start failed' }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Not found", { status: 404 });
});

async function exchangeCodeForTokens(code: string) {
  const clientId = Deno.env.get('OURA_CLIENT_ID');
  const clientSecret = Deno.env.get('OURA_CLIENT_SECRET');
  const baseUrl = "https://fitlinkbot.netlify.app";
  const redirectUri = `${baseUrl}/oauth-oura/callback`;

  console.log('Token exchange with client_id:', clientId?.substring(0, 8) + '...');

  if (!clientId || !clientSecret) {
    console.error('Missing Oura credentials:', { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    throw new Error('Missing Oura credentials');
  }

  console.log('Making token request to Oura API...');
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  console.log('Oura API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Oura token exchange failed:', response.status, errorText);
    throw new Error(`Failed to exchange code for tokens: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Token exchange response keys:', Object.keys(data));
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
    user_id: data.user_id
  };
}

async function syncInitialOuraData(supabase: any, userId: string, accessToken: string) {
  // Fetch last 7 days of data for initial sync
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  const endDateStr = endDate.toISOString().split('T')[0];
  const startDateStr = startDate.toISOString().split('T')[0];

  console.log(`Fetching Oura data from ${startDateStr} to ${endDateStr}`);

  // Fetch sleep data
  const sleepResponse = await fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDateStr}&end_date=${endDateStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (sleepResponse.ok) {
    const sleepData = await sleepResponse.json();
    console.log(`Found ${sleepData.data?.length || 0} sleep records`);
    
    // Store sleep data
    for (const sleep of sleepData.data || []) {
      const { error } = await supabase
        .from('oura_sleep')
        .upsert({
          user_id: userId,
          date: sleep.day,
          total_sleep_minutes: sleep.total_sleep_duration ? Math.round(sleep.total_sleep_duration / 60) : null,
          sleep_efficiency: sleep.efficiency,
          deep_sleep_minutes: sleep.deep_sleep_duration ? Math.round(sleep.deep_sleep_duration / 60) : null,
          light_sleep_minutes: sleep.light_sleep_duration ? Math.round(sleep.light_sleep_duration / 60) : null,
          rem_sleep_minutes: sleep.rem_sleep_duration ? Math.round(sleep.rem_sleep_duration / 60) : null,
          awake_minutes: sleep.awake_time ? Math.round(sleep.awake_time / 60) : null,
          bedtime_start: sleep.bedtime_start,
          bedtime_end: sleep.bedtime_end,
          hrv_avg: sleep.average_hrv,
          resting_heart_rate: sleep.lowest_heart_rate,
          temperature_deviation: sleep.temperature_deviation,
          respiratory_rate: sleep.average_breath,
          readiness_score: sleep.score,
          raw_data: sleep,
        }, {
          onConflict: 'user_id,date'
        });

      if (error) {
        console.error('Error storing sleep data:', error);
      }
    }
  }

  // Note: Readiness and activity data is included in sleep data response
  // The readiness_score is stored in the sleep record above
}