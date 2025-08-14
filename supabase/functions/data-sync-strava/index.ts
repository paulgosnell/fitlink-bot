import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { decryptToken } from "../shared/utils/encryption.ts";
import { updateProviderTokens } from "../shared/database/providers.ts";

interface StravaActivity {
  id: number;
  name: string;
  type: string; // e.g., Run, Ride
  start_date: string; // ISO
  start_date_local?: string;
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  distance: number; // meters
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
}

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

    // Optional payload to restrict sync to a single user
    let filterUserId: string | undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body && typeof body.user_id === 'string') {
          filterUserId = body.user_id;
        }
      } catch (_) {
        // ignore
      }
    }

    // Find active Strava providers
    let query = supabase
      .from('providers')
      .select('id, user_id, access_token, refresh_token, expires_at, provider_user_id')
      .eq('provider', 'strava')
      .eq('is_active', true) as any;
    if (filterUserId) query = query.eq('user_id', filterUserId);

    const { data: providers, error: providersError } = await query;
    if (providersError) {
      console.error('Error fetching Strava providers:', providersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch providers' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!providers || providers.length === 0) {
      return new Response(JSON.stringify({ message: 'No active Strava users found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let errorCount = 0;

    for (const provider of providers) {
      try {
        // Refresh token if expired
        let accessToken = await decryptToken(provider.access_token);
        const now = new Date();
        if (provider.expires_at && new Date(provider.expires_at) <= now && provider.refresh_token) {
          const decryptedRefresh = await decryptToken(provider.refresh_token);
          const refreshed = await refreshStravaToken(decryptedRefresh);
          if (refreshed) {
            const newExpiresAt = refreshed.expires_in
              ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
              : undefined;
            await updateProviderTokens(supabase, provider.id, {
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token,
              expires_at: newExpiresAt,
            });
            accessToken = refreshed.access_token;
          }
        }

        await syncStravaData(supabase, provider.user_id, accessToken);
        successCount++;
      } catch (e) {
        console.error(`Error syncing Strava for user ${provider.user_id}:`, e);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: 'Strava sync completed', successCount, errorCount, totalUsers: providers.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in Strava data sync:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function syncStravaData(supabase: any, userId: string, accessToken: string) {
  // Fetch recent activities (last 2 days)
  const twoDaysAgo = Math.floor((Date.now() - 2 * 24 * 3600 * 1000) / 1000);
  const resp = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${twoDaysAgo}&per_page=50`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Failed to fetch Strava activities: ${resp.status} ${text}`);
  }
  const activities: StravaActivity[] = await resp.json();

  for (const act of activities) {
    const row = mapStravaToActivityRow(userId, act);
    const { error } = await supabase
      .from('activities')
      .upsert(row, { onConflict: 'user_id,source,external_id' });
    if (error) {
      console.error(`Error upserting activity ${act.id} for user ${userId}:`, error);
    }
  }
}

function mapStravaToActivityRow(userId: string, act: StravaActivity) {
  const typeMap: Record<string, any> = {
    Run: 'run',
    Ride: 'ride',
    Swim: 'swim',
    Walk: 'walk',
    Hike: 'hike',
  };
  const activity_type = typeMap[act.type] || 'other';
  return {
    user_id: userId,
    source: 'strava',
    external_id: String(act.id),
    activity_type,
    name: act.name,
    start_time: act.start_date,
    duration_seconds: act.elapsed_time,
    distance_meters: act.distance,
    elevation_gain_meters: act.total_elevation_gain ?? null,
    average_heart_rate: act.average_heartrate ?? null,
    max_heart_rate: act.max_heartrate ?? null,
    average_power: act.average_watts ?? null,
    weighted_power: act.weighted_average_watts ?? null,
    tss_estimated: null,
    intensity_factor: null,
    raw_data: act,
  };
}

async function refreshStravaToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in?: number } | null> {
  const clientId = Deno.env.get('STRAVA_CLIENT_ID');
  const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('Strava refresh failed', response.status, text);
    return null;
  }
  const json = await response.json();
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || refreshToken,
    expires_in: json.expires_in,
  };
}

