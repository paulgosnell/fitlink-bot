import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { updateProviderTokens } from "../shared/database/providers.ts";
import { decryptToken } from "../shared/utils/encryption.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const clientId = Deno.env.get('OURA_CLIENT_ID');
    const clientSecret = Deno.env.get('OURA_CLIENT_SECRET');

    let targetUserId: string | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.user_id === 'string') {
        targetUserId = body.user_id;
      }
    } catch (_e) {
      // ignore body parse errors
    }

    // Get active Oura users (optionally targeted)
    const query = supabase
      .from("providers")
      .select("id, user_id, access_token, refresh_token, expires_at, provider_user_id")
      .eq("provider", "oura")
      .eq("is_active", true);

    const { data: providers, error: providersError } = targetUserId
      ? await query.eq('user_id', targetUserId)
      : await query;

    if (providersError) {
      console.error("Error fetching Oura providers:", providersError);
      return new Response(JSON.stringify({ error: "Failed to fetch providers" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!providers || providers.length === 0) {
      return new Response(JSON.stringify({ message: "No active Oura users found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let successCount = 0;
    let errorCount = 0;

    // Sync data for each user
    for (const provider of providers) {
      try {
        let accessToken = decryptToken(provider.access_token);
        const refreshToken = provider.refresh_token ? decryptToken(provider.refresh_token) : undefined;

        // Refresh token if expiring within 5 minutes
        const expiresAt = provider.expires_at ? new Date(provider.expires_at) : undefined;
        if (clientId && clientSecret && refreshToken && expiresAt && (expiresAt.getTime() - Date.now() < 5 * 60 * 1000)) {
          const refreshed = await refreshOuraToken(clientId, clientSecret, refreshToken);
          await updateProviderTokens(supabase as any, provider.id, {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at
          });
          accessToken = refreshed.access_token;
        }

        await syncOuraData(supabase, provider.user_id, accessToken);
        successCount++;
      } catch (error) {
        console.error(`Error syncing data for user ${provider.user_id}:`, error);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({ 
      message: "Oura data sync completed",
      successCount,
      errorCount,
      totalUsers: providers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error in Oura data sync:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function syncOuraData(supabase: any, userId: string, accessToken: string) {
  // Get today's date and yesterday's date
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Fetch sleep data for the last 2 days
  const sleepResponse = await fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${yesterdayStr}&end_date=${todayStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!sleepResponse.ok) {
    throw new Error(`Failed to fetch Oura sleep data: ${sleepResponse.status}`);
  }

  const sleepData = await sleepResponse.json();
  
  // Process and store sleep data
  for (const day of sleepData.data || []) {
    if (day.sleep) {
      const sleepRecord = {
        user_id: userId,
        date: day.day,
        total_sleep_minutes: day.sleep.total_sleep_duration / 60, // Convert seconds to minutes
        sleep_efficiency: day.sleep.sleep_efficiency,
        deep_sleep_minutes: day.sleep.deep_sleep_duration / 60,
        light_sleep_minutes: day.sleep.light_sleep_duration / 60,
        rem_sleep_minutes: day.sleep.rem_sleep_duration / 60,
        awake_minutes: day.sleep.awake_duration / 60,
        bedtime_start: day.sleep.bedtime_start,
        bedtime_end: day.sleep.bedtime_end,
        hrv_avg: day.sleep.hrv_average,
        resting_heart_rate: day.sleep.heart_rate_average,
        temperature_deviation: day.sleep.temperature_deviation,
        respiratory_rate: day.sleep.respiratory_rate_average,
        readiness_score: day.sleep.readiness_score,
        raw_data: day.sleep
      };

      // Upsert sleep data
      const { error: upsertError } = await supabase
        .from("oura_sleep")
        .upsert(sleepRecord, {
          onConflict: "user_id,date"
        });

      if (upsertError) {
        console.error(`Error upserting sleep data for user ${userId}, date ${day.day}:`, upsertError);
      }
    }
  }

  // Fetch readiness data for the last 2 days
  const readinessResponse = await fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${yesterdayStr}&end_date=${todayStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (readinessResponse.ok) {
    const readinessData = await readinessResponse.json();
    
    // Process and store readiness data (could be stored in a separate table or combined with sleep)
    for (const day of readinessData.data || []) {
      if (day.readiness) {
        // Update existing sleep record with readiness data if it exists
        const { error: updateError } = await supabase
          .from("oura_sleep")
          .update({ 
            readiness_score: day.readiness.score,
            raw_data: { ...day.readiness, ...day.readiness.contributors }
          })
          .eq("user_id", userId)
          .eq("date", day.day);

        if (updateError) {
          console.error(`Error updating readiness data for user ${userId}, date ${day.day}:`, updateError);
        }
      }
    }
  }
}

async function refreshOuraToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_at?: string; }>{
  const resp = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Oura refresh failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined
  };
}
