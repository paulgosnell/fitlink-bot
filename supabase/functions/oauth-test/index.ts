import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // Database lookup endpoint for dashboard
    if (url.pathname.endsWith('/user-lookup') && req.method === 'POST') {
      const { telegram_id } = await req.json();
      
      if (!telegram_id) {
        return new Response(JSON.stringify({ error: 'Missing telegram_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Look up user by telegram_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegram_id)
        .single();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'User not found', telegram_id }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get user's health data
      const [sleepData, activityData, providers] = await Promise.all([
        supabase
          .from('oura_sleep')
          .select('*')
          .eq('user_id', user.id)
          .gte('day', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('day', { ascending: false })
          .limit(30),
        supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('start_date', { ascending: false })
          .limit(50),
        supabase
          .from('providers')
          .select('provider, is_active, created_at, updated_at')
          .eq('user_id', user.id)
      ]);

      return new Response(JSON.stringify({
        user: {
          id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          city: user.city,
          timezone: user.timezone,
          briefing_hour: user.briefing_hour,
          created_at: user.created_at
        },
        sleep_data: sleepData.data || [],
        activities: activityData.data || [],
        providers: providers.data || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Debug environment variables
    const envCheck = {
      OURA_CLIENT_ID: Deno.env.get("OURA_CLIENT_ID") ? "SET" : "NOT_SET",
      OURA_CLIENT_SECRET: Deno.env.get("OURA_CLIENT_SECRET") ? "SET" : "NOT_SET",
      STRAVA_CLIENT_ID: Deno.env.get("STRAVA_CLIENT_ID") ? "SET" : "NOT_SET", 
      STRAVA_CLIENT_SECRET: Deno.env.get("STRAVA_CLIENT_SECRET") ? "SET" : "NOT_SET",
      BASE_URL: Deno.env.get("BASE_URL") ? "SET" : "NOT_SET",
      SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "SET" : "NOT_SET",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "SET" : "NOT_SET",
    };

    return new Response(
      JSON.stringify({ 
        message: "Environment variable check",
        env: envCheck,
        timestamp: new Date().toISOString()
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});