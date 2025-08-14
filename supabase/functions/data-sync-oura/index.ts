import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { decryptToken } from "../shared/utils/encryption.ts";
import { updateProviderTokens } from "../shared/database/providers.ts";

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

    // Optional payload to restrict sync to a single user and control backfill range
    let filterUserId: string | undefined;
    let daysBack: number = 2; // default: yesterday + today
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body && typeof body.user_id === 'string') {
          filterUserId = body.user_id;
        }
        if (body && typeof body.days_back === 'number') {
          // Cap at 30 days to avoid excessive load by default
          const n = Math.floor(body.days_back);
          if (n >= 1) {
            daysBack = Math.min(n, 30);
          }
        }
      } catch (_) {
        // ignore bad/missing JSON
      }
    }

    // Get active Oura providers (optionally for a single user)
    let query = supabase
      .from("providers")
      .select("id, user_id, access_token, refresh_token, expires_at, provider_user_id")
      .eq("provider", "oura")
      .eq("is_active", true) as any;
    if (filterUserId) {
      query = query.eq("user_id", filterUserId);
    }

    const { data: providers, error: providersError } = await query;

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
        // Refresh token if expired
        let accessToken = await decryptToken(provider.access_token);
        const now = new Date();
        if (provider.expires_at && new Date(provider.expires_at) <= now && provider.refresh_token) {
          const refreshed = await refreshOuraToken(await decryptToken(provider.refresh_token));
          if (refreshed) {
            const newExpiresAt = refreshed.expires_in
              ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
              : undefined;
            await updateProviderTokens(supabase, provider.id, {
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token,
              expires_at: newExpiresAt
            });
            accessToken = refreshed.access_token;
          }
        }

        await syncOuraData(supabase, provider.user_id, accessToken, daysBack);
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

async function syncOuraData(supabase: any, userId: string, accessToken: string, daysBack: number = 2) {
  // Compute date range inclusive of today going back `daysBack` days
  const today = new Date();
  const start = new Date(today);
  // Include today as 1 day, so go back (daysBack - 1)
  start.setDate(start.getDate() - Math.max(0, daysBack - 1));
  
  const todayStr = today.toISOString().split('T')[0];
  const startStr = start.toISOString().split('T')[0];

  // Fetch sleep data for the requested range
  const sleepResponse = await fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startStr}&end_date=${todayStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!sleepResponse.ok) {
    throw new Error(`Failed to fetch Oura sleep data: ${sleepResponse.status}`);
  }

  const sleepData = await sleepResponse.json();
  
  // Process and store sleep data (Oura v2 daily_sleep has top-level fields per day)
  for (const day of sleepData.data || []) {
    const sleepRecord = {
      user_id: userId,
      date: day.day,
      total_sleep_minutes: typeof day.total_sleep_duration === 'number' ? Math.round(day.total_sleep_duration / 60) : null,
      sleep_efficiency: day.efficiency ?? day.sleep_efficiency ?? null,
      deep_sleep_minutes: typeof day.deep_sleep_duration === 'number' ? Math.round(day.deep_sleep_duration / 60) : null,
      light_sleep_minutes: typeof day.light_sleep_duration === 'number' ? Math.round(day.light_sleep_duration / 60) : null,
      rem_sleep_minutes: typeof day.rem_sleep_duration === 'number' ? Math.round(day.rem_sleep_duration / 60) : null,
      awake_minutes: typeof day.awake_time === 'number' ? Math.round(day.awake_time / 60) : (typeof day.awake_duration === 'number' ? Math.round(day.awake_duration / 60) : null),
      bedtime_start: day.bedtime_start ?? null,
      bedtime_end: day.bedtime_end ?? null,
      hrv_avg: day.hrv_average ?? null,
      resting_heart_rate: day.heart_rate_average ?? day.resting_heart_rate ?? null,
      temperature_deviation: day.temperature_deviation ?? null,
      respiratory_rate: day.respiratory_rate_average ?? null,
      // readiness_score filled by readiness endpoint below
      raw_data: day
    } as any;

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

  // Fetch readiness data for the requested range
  const readinessResponse = await fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startStr}&end_date=${todayStr}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (readinessResponse.ok) {
    const readinessData = await readinessResponse.json();
    for (const day of readinessData.data || []) {
      // Update existing sleep record with readiness score
      const { error: updateError } = await supabase
        .from("oura_sleep")
        .update({ 
          readiness_score: day.score ?? null
        })
        .eq("user_id", userId)
        .eq("date", day.day);

      if (updateError) {
        console.error(`Error updating readiness data for user ${userId}, date ${day.day}:`, updateError);
      }
    }
  }
}

async function refreshOuraToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in?: number } | null> {
  const clientId = Deno.env.get('OURA_CLIENT_ID');
  const clientSecret = Deno.env.get('OURA_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('Oura refresh failed', response.status, text);
    return null;
  }
  const json = await response.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || refreshToken,
    expires_in: json.expires_in,
  };
}
