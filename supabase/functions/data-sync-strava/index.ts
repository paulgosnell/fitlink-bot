import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { updateProviderTokens } from "../shared/database/providers.ts";
import { decryptToken } from "../shared/utils/encryption.ts";

interface StravaActivity {
  id: number;
  name: string;
  type: string; // e.g., Run, Ride, Swim
  start_date: string; // ISO
  moving_time: number; // seconds
  distance: number; // meters
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  [key: string]: unknown;
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Missing Strava credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let targetUserId: string | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.user_id === 'string') {
        targetUserId = body.user_id;
      }
    } catch (_e) {
      // ignore body parse errors
    }

    const providerFilter = supabase
      .from('providers')
      .select('id,user_id,access_token,refresh_token,expires_at,provider_user_id')
      .eq('provider', 'strava')
      .eq('is_active', true);

    const { data: providers, error: providersError } = targetUserId
      ? await providerFilter.eq('user_id', targetUserId)
      : await providerFilter;

    if (providersError) {
      console.error('Error fetching Strava providers:', providersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch providers' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!providers || providers.length === 0) {
      return new Response(JSON.stringify({ message: 'No active Strava users found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const afterEpoch = Math.floor((Date.now() - 1000 * 60 * 60 * 24 * 30) / 1000); // last 30 days

    let successCount = 0;
    let errorCount = 0;

    for (const provider of providers) {
      try {
        let accessToken = decryptToken(provider.access_token);
        const refreshToken = provider.refresh_token ? decryptToken(provider.refresh_token) : undefined;

        // Refresh if expired or near expiry
        const expiresAt = provider.expires_at ? new Date(provider.expires_at) : undefined;
        if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000 && refreshToken) {
          const refreshed = await refreshStravaToken(clientId, clientSecret, refreshToken);
          await updateProviderTokens(supabase as any, provider.id, {
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at
          });
          accessToken = refreshed.access_token;
        }

        const activitiesResp = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50&after=${afterEpoch}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!activitiesResp.ok) {
          throw new Error(`Strava activities fetch failed: ${activitiesResp.status}`);
        }
        const activities: StravaActivity[] = await activitiesResp.json();

        for (const a of activities) {
          const activityType = mapStravaType(a.type);
          const upsertRecord = {
            user_id: provider.user_id,
            source: 'strava',
            external_id: a.id.toString(),
            activity_type: activityType,
            name: a.name,
            start_time: a.start_date,
            duration_seconds: a.moving_time,
            distance_meters: a.distance,
            elevation_gain_meters: a.total_elevation_gain ?? null,
            average_heart_rate: a.average_heartrate ?? null,
            max_heart_rate: a.max_heartrate ?? null,
            average_power: a.average_watts ?? null,
            weighted_power: (a as any).weighted_average_watts ?? null,
            tss_estimated: null,
            intensity_factor: null,
            raw_data: a
          };

          const { error: upsertError } = await supabase
            .from('activities')
            .upsert(upsertRecord, { onConflict: 'user_id,source,external_id' });

          if (upsertError) {
            console.error(`Error upserting Strava activity ${a.id} for user ${provider.user_id}:`, upsertError);
          }
        }

        successCount++;
      } catch (err) {
        console.error(`Error syncing Strava for user ${provider.user_id}:`, err);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      message: 'Strava data sync completed',
      successCount,
      errorCount,
      totalUsers: providers.length
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in Strava data sync:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function mapStravaType(type: string): 'run' | 'ride' | 'swim' | 'walk' | 'hike' | 'other' {
  const t = (type || '').toLowerCase();
  if (t === 'run') return 'run';
  if (t === 'ride' || t === 'virtualride' || t === 'gravelride' || t === 'mtb') return 'ride';
  if (t === 'swim') return 'swim';
  if (t === 'walk') return 'walk';
  if (t === 'hike') return 'hike';
  return 'other';
}

async function refreshStravaToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_at?: string; }>{
  const resp = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava refresh failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : undefined
  };
}


