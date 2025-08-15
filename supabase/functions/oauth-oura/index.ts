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
    
    console.log('OAuth callback received:', { code: code?.substring(0, 10) + '...', state, fullState: state });
    
    if (code && state) {
      try {
        // Parse state to get user_id
        const [userId, _] = state.split('_');
        console.log('Parsed user ID:', userId, 'Type:', typeof userId, 'IsNaN:', isNaN(parseInt(userId)));
        
        // Validate userId is a number
        const telegramId = parseInt(userId);
        if (isNaN(telegramId)) {
          throw new Error(`Invalid user ID in state: ${userId}. Expected a number, got: ${typeof userId}`);
        }
        
        // Exchange code for tokens
        console.log('Exchanging code for tokens...');
        const tokens = await exchangeCodeForTokens(code);
        console.log('Token exchange successful:', { user_id: tokens.user_id });
        
        // Get user from database
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        console.log('Looking up user with Telegram ID:', telegramId);
        const user = await getUserByTelegramId(supabase, telegramId);
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
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
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
            padding: 1rem;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 500px;
        }
        h1 { margin-top: 0; font-size: 2rem; }
        p { font-size: 1.1rem; opacity: 0.9; }
        .error-details { 
            background: rgba(0,0,0,0.3); 
            padding: 1rem; 
            border-radius: 10px; 
            margin-top: 1rem;
            font-size: 0.9rem;
            text-align: left;
            word-break: break-word;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Connection Failed</h1>
        <p>Sorry, we couldn't connect your Oura Ring.</p>
        <div class="error-details">
            <strong>Error Details:</strong><br>
            ${error.message || 'Unknown error'}<br><br>
            <strong>Error Type:</strong> ${error.name || 'Error'}<br><br>
            <strong>Stack:</strong><br>
            <pre style="white-space: pre-wrap; font-size: 0.8rem;">${(error.stack || '').substring(0, 500)}</pre>
        </div>
        <p style="margin-top: 1rem; font-size: 0.9rem;">Please screenshot this error and send to support.</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 10000);
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

  console.log(`Fetching comprehensive Oura data from ${startDateStr} to ${endDateStr}`);

  const authHeaders = {
    'Authorization': `Bearer ${accessToken}`,
  };

  // Fetch all Oura data endpoints in parallel
  const [
    sleepResponse,
    readinessResponse,
    activityResponse,
    stressResponse,
    heartRateResponse,
    spo2Response,
    temperatureResponse,
    workoutResponse,
    sessionResponse
  ] = await Promise.all([
    fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_stress?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=${startDateStr}T00:00:00&end_datetime=${endDateStr}T23:59:59`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_spo2?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/temperature?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/workouts?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders }),
    fetch(`https://api.ouraring.com/v2/usercollection/sessions?start_date=${startDateStr}&end_date=${endDateStr}`, { headers: authHeaders })
  ]);

  // Process sleep data (always available)
  await processSleepData(supabase, userId, sleepResponse, readinessResponse);
  
  // Process additional data only if tables exist
  try {
    await processDailyActivity(supabase, userId, activityResponse);
  } catch (error) {
    console.warn('Daily activity processing failed (table may not exist):', error);
  }
  
  try {
    await processDailyStress(supabase, userId, stressResponse);
  } catch (error) {
    console.warn('Daily stress processing failed (table may not exist):', error);
  }
  
  try {
    await processHeartRate(supabase, userId, heartRateResponse);
  } catch (error) {
    console.warn('Heart rate processing failed (table may not exist):', error);
  }
  
  try {
    await processSPO2(supabase, userId, spo2Response);
  } catch (error) {
    console.warn('SPO2 processing failed (table may not exist):', error);
  }
  
  try {
    await processTemperature(supabase, userId, temperatureResponse);
  } catch (error) {
    console.warn('Temperature processing failed (table may not exist):', error);
  }
  
  try {
    await processWorkouts(supabase, userId, workoutResponse);
  } catch (error) {
    console.warn('Workouts processing failed (table may not exist):', error);
  }
  
  try {
    await processSessions(supabase, userId, sessionResponse);
  } catch (error) {
    console.warn('Sessions processing failed (table may not exist):', error);
  }
}

async function processSleepData(supabase: any, userId: string, sleepResponse: Response, readinessResponse: Response) {
  let sleepDataByDate = {};
  let readinessDataByDate = {};

  // Process sleep sessions
  if (sleepResponse.ok) {
    const sleepData = await sleepResponse.json();
    console.log(`Found ${sleepData.data?.length || 0} sleep sessions`);
    
    // Group sleep sessions by date (take the main sleep session per day)
    for (const sleep of sleepData.data || []) {
      const sleepDate = sleep.bedtime_start.split('T')[0]; // Get date from bedtime
      if (!sleepDataByDate[sleepDate] || sleep.type === 'long_sleep') {
        sleepDataByDate[sleepDate] = sleep;
      }
    }
  }

  // Process readiness scores
  if (readinessResponse.ok) {
    const readinessData = await readinessResponse.json();
    console.log(`Found ${readinessData.data?.length || 0} readiness records`);
    
    for (const readiness of readinessData.data || []) {
      readinessDataByDate[readiness.day] = readiness;
    }
  }

  // Combine and store sleep data
  const allDates = new Set([...Object.keys(sleepDataByDate), ...Object.keys(readinessDataByDate)]);
  
  for (const date of allDates) {
    const sleep = sleepDataByDate[date];
    const readiness = readinessDataByDate[date];
    
    const { error } = await supabase
      .from('oura_sleep')
      .upsert({
        user_id: userId,
        date: date,
        total_sleep_duration: sleep?.total_sleep_duration ? (sleep.total_sleep_duration / 3600) : null, // Convert seconds to hours
        deep_sleep_duration: sleep?.deep_sleep_duration ? (sleep.deep_sleep_duration / 3600) : null, // Convert seconds to hours
        light_sleep_duration: sleep?.light_sleep_duration ? (sleep.light_sleep_duration / 3600) : null, // Convert seconds to hours
        rem_sleep_duration: sleep?.rem_sleep_duration ? (sleep.rem_sleep_duration / 3600) : null, // Convert seconds to hours
        sleep_score: readiness?.score || null, // Use readiness score as sleep score
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error(`Error storing sleep data for ${date}:`, error);
    }
  }
}

async function processDailyActivity(supabase: any, userId: string, activityResponse: Response) {
  if (!activityResponse.ok) {
    console.warn(`Daily activity fetch failed: ${activityResponse.status}`);
    return;
  }

  const activityData = await activityResponse.json();
  console.log(`Found ${activityData.data?.length || 0} daily activity records`);

  for (const activity of activityData.data || []) {
    const { error } = await supabase
      .from('oura_daily_activity')
      .upsert({
        user_id: userId,
        date: activity.day,
        activity_score: activity.score,
        steps: activity.steps,
        active_calories: activity.active_calories,
        total_calories: activity.total_calories,
        target_calories: activity.target_calories,
        equivalent_walking_distance: activity.equivalent_walking_distance,
        high_activity_minutes: activity.high_activity_minutes,
        medium_activity_minutes: activity.medium_activity_minutes,
        low_activity_minutes: activity.low_activity_minutes,
        non_wear_minutes: activity.non_wear_minutes,
        rest_minutes: activity.rest_minutes,
        inactive_minutes: activity.inactive_minutes,
        inactivity_alerts: activity.inactivity_alerts,
        average_met: activity.average_met,
        met_1min: activity.met_1min,
        raw_data: activity,
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error(`Error storing activity data for ${activity.day}:`, error);
    }
  }
}

async function processDailyStress(supabase: any, userId: string, stressResponse: Response) {
  if (!stressResponse.ok) {
    console.warn(`Daily stress fetch failed: ${stressResponse.status}`);
    return;
  }

  const stressData = await stressResponse.json();
  console.log(`Found ${stressData.data?.length || 0} daily stress records`);

  for (const stress of stressData.data || []) {
    const { error } = await supabase
      .from('oura_daily_stress')
      .upsert({
        user_id: userId,
        date: stress.day,
        stress_high: stress.stress_high,
        stress_recovery: stress.stress_recovery,
        stress_day_summary: stress.day_summary,
        raw_data: stress,
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error(`Error storing stress data for ${stress.day}:`, error);
    }
  }
}

async function processHeartRate(supabase: any, userId: string, heartRateResponse: Response) {
  if (!heartRateResponse.ok) {
    console.warn(`Heart rate fetch failed: ${heartRateResponse.status}`);
    return;
  }

  const heartRateData = await heartRateResponse.json();
  console.log(`Found ${heartRateData.data?.length || 0} heart rate records`);

  // Insert heart rate data in batches to avoid too many individual queries
  const batchSize = 100;
  const heartRateRecords = heartRateData.data || [];
  
  for (let i = 0; i < heartRateRecords.length; i += batchSize) {
    const batch = heartRateRecords.slice(i, i + batchSize);
    const records = batch.map(hr => ({
      user_id: userId,
      timestamp: hr.timestamp,
      heart_rate: hr.bpm,
      source: hr.source,
      raw_data: hr,
    }));

    const { error } = await supabase
      .from('oura_heart_rate')
      .upsert(records);

    if (error) {
      console.error(`Error storing heart rate batch ${i}-${i + batch.length}:`, error);
    }
  }
}

async function processSPO2(supabase: any, userId: string, spo2Response: Response) {
  if (!spo2Response.ok) {
    console.warn(`SPO2 fetch failed: ${spo2Response.status}`);
    return;
  }

  const spo2Data = await spo2Response.json();
  console.log(`Found ${spo2Data.data?.length || 0} SPO2 records`);

  for (const spo2 of spo2Data.data || []) {
    const { error } = await supabase
      .from('oura_daily_spo2')
      .upsert({
        user_id: userId,
        date: spo2.day,
        spo2_percentage: spo2.spo2_percentage,
        raw_data: spo2,
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error(`Error storing SPO2 data for ${spo2.day}:`, error);
    }
  }
}

async function processTemperature(supabase: any, userId: string, temperatureResponse: Response) {
  if (!temperatureResponse.ok) {
    console.warn(`Temperature fetch failed: ${temperatureResponse.status}`);
    return;
  }

  const temperatureData = await temperatureResponse.json();
  console.log(`Found ${temperatureData.data?.length || 0} temperature records`);

  for (const temp of temperatureData.data || []) {
    const { error } = await supabase
      .from('oura_temperature')
      .upsert({
        user_id: userId,
        date: temp.day,
        temperature_deviation: temp.temperature_deviation,
        temperature_trend_deviation: temp.temperature_trend_deviation,
        raw_data: temp,
      }, {
        onConflict: 'user_id,date'
      });

    if (error) {
      console.error(`Error storing temperature data for ${temp.day}:`, error);
    }
  }
}

async function processWorkouts(supabase: any, userId: string, workoutResponse: Response) {
  if (!workoutResponse.ok) {
    console.warn(`Workouts fetch failed: ${workoutResponse.status}`);
    return;
  }

  const workoutData = await workoutResponse.json();
  console.log(`Found ${workoutData.data?.length || 0} workout records`);

  for (const workout of workoutData.data || []) {
    const { error } = await supabase
      .from('oura_workouts')
      .upsert({
        user_id: userId,
        external_id: workout.id,
        activity: workout.activity,
        start_datetime: workout.start_datetime,
        end_datetime: workout.end_datetime,
        intensity: workout.intensity,
        load: workout.load,
        average_heart_rate: workout.average_heart_rate,
        max_heart_rate: workout.max_heart_rate,
        calories: workout.calories,
        day: workout.day,
        raw_data: workout,
      }, {
        onConflict: 'user_id,external_id'
      });

    if (error) {
      console.error(`Error storing workout data for ${workout.id}:`, error);
    }
  }
}

async function processSessions(supabase: any, userId: string, sessionResponse: Response) {
  if (!sessionResponse.ok) {
    console.warn(`Sessions fetch failed: ${sessionResponse.status}`);
    return;
  }

  const sessionData = await sessionResponse.json();
  console.log(`Found ${sessionData.data?.length || 0} session records`);

  for (const session of sessionData.data || []) {
    const { error } = await supabase
      .from('oura_sessions')
      .upsert({
        user_id: userId,
        external_id: session.id,
        session_type: session.type,
        start_datetime: session.start_datetime,
        end_datetime: session.end_datetime,
        mood: session.mood,
        tags: session.tags,
        day: session.day,
        raw_data: session,
      }, {
        onConflict: 'user_id,external_id'
      });

    if (error) {
      console.error(`Error storing session data for ${session.id}:`, error);
    }
  }
}