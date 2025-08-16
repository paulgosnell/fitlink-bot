/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

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
      const body = await req.json();
      
      // TEMPORARY: Skip validation for debugging - look for telegram_id directly
      console.log('DEBUG: Request body keys:', Object.keys(body));
      console.log('DEBUG: Full request body:', body);
      
      const telegramId = body.telegram_id || body.user?.id;
      console.log('DEBUG: Using telegram_id:', telegramId);
      
      if (!telegramId) {
        return new Response(JSON.stringify({ 
          error: 'Missing telegram_id', 
          debug_info: { 
            body_keys: Object.keys(body),
            body: body
          }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      console.log('DEBUG: Looking up user with Telegram ID:', telegramId);

      // Look up user by telegram_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      console.log('DEBUG: User lookup result:', { user: user ? 'found' : 'not found', error: userError });

      if (userError || !user) {
        console.error('DEBUG: User lookup failed:', userError);
        return new Response(JSON.stringify({ 
          error: 'User not found', 
          telegram_id: telegramId, 
          db_error: userError?.message,
          debug_info: {
            has_supabase_url: !!Deno.env.get('SUPABASE_URL'),
            has_service_key: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
          }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get user's health data and providers
      console.log('DEBUG: Fetching health data for user:', user.id);
      
            const [sleepData, activityData, dailyActivityData, workoutData, providers] = await Promise.all([
        supabase
          .from('oura_sleep')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('activities')
          .select('*')
          .eq('user_id', user.id)
          .order('start_time', { ascending: false })
          .limit(50),
        supabase
          .from('oura_daily_activity')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('oura_workouts')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('start_datetime', { ascending: false })
          .limit(50),
        supabase
          .from('providers')
          .select('provider, is_active, created_at, updated_at')
          .eq('user_id', user.id)
      ]);

      console.log('DEBUG: Data query results:', {
        sleep_count: sleepData.data?.length || 0,
        sleep_error: sleepData.error?.message,
        activity_count: activityData.data?.length || 0,
        activity_error: activityData.error?.message,
        daily_activity_count: dailyActivityData.data?.length || 0,
        daily_activity_error: dailyActivityData.error?.message,
        workout_count: workoutData.data?.length || 0,
        workout_error: workoutData.error?.message,
        provider_count: providers.data?.length || 0,
        provider_error: providers.error?.message
      });      return new Response(JSON.stringify({
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
        oura_daily_activity: dailyActivityData.data || [],
        oura_workouts: workoutData.data || [],
        providers: providers.data || [],
        debug_info: {
          lookup_method: 'telegram_id_direct',
          validation_skipped: true,
          timestamp: new Date().toISOString(),
          table_counts: {
            sleep: sleepData.data?.length || 0,
            activities: activityData.data?.length || 0,
            oura_daily_activity: dailyActivityData.data?.length || 0,
            oura_workouts: workoutData.data?.length || 0,
            providers: providers.data?.length || 0
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // List users endpoint (for GET requests with ?list=users)
    if (url.searchParams.get('list') === 'users') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: users, error } = await supabase
        .from('users')
        .select('telegram_id, username, first_name, last_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify({ 
          users: users || [],
          error: error?.message,
          count: users?.length || 0
        }, null, 2),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check actual database schema by trying queries
    if (url.searchParams.get('check') === 'schema') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      try {
        // Test queries on potential tables to see which exist
        const tableTests = [
          { name: 'users', query: supabase.from('users').select('id').limit(1) },
          { name: 'activities', query: supabase.from('activities').select('id').limit(1) },
          { name: 'oura_sleep', query: supabase.from('oura_sleep').select('id').limit(1) },
          { name: 'oura_daily_activity', query: supabase.from('oura_daily_activity').select('id').limit(1) },
          { name: 'oura_workouts', query: supabase.from('oura_workouts').select('id').limit(1) },
          { name: 'providers', query: supabase.from('providers').select('id').limit(1) }
        ];

        const results = await Promise.all(
          tableTests.map(async (test) => {
            try {
              const result = await test.query;
              return { table: test.name, exists: true, error: null };
            } catch (error) {
              return { table: test.name, exists: false, error: error.message };
            }
          })
        );

        return new Response(JSON.stringify({
          table_status: results,
          existing_tables: results.filter(r => r.exists).map(r => r.table),
          missing_tables: results.filter(r => !r.exists).map(r => r.table),
          timestamp: new Date().toISOString()
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Manual sync trigger
    if (url.searchParams.get('action') === 'sync' && req.method === 'POST') {
      const body = await req.json();
      const userId = body.user_id;
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing user_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        // Trigger Oura sync
        const ouraResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/data-sync-oura`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        });

        const ouraResult = ouraResponse.ok ? await ouraResponse.json() : { error: await ouraResponse.text() };

        // Trigger Strava sync
        const stravaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/data-sync-strava`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ user_id: userId })
        });

        const stravaResult = stravaResponse.ok ? await stravaResponse.json() : { error: await stravaResponse.text() };

        return new Response(JSON.stringify({
          message: 'Sync triggered',
          user_id: userId,
          oura_sync: {
            status: ouraResponse.status,
            result: ouraResult
          },
          strava_sync: {
            status: stravaResponse.status,
            result: stravaResult
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Debug endpoint (for GET requests)
    return new Response(
      JSON.stringify({ 
        message: "OAuth test function - working",
        method: req.method,
        pathname: url.pathname,
        search: url.search,
        env_check: {
          SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "SET" : "NOT_SET",
          SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "SET" : "NOT_SET",
        },
        endpoints: {
          "POST /user-lookup": "Fetch user data by telegram_id",
          "GET ?list=users": "List recent users",
          "GET ?check=schema": "Check actual database tables",
          "POST ?action=sync": "Trigger data sync for user_id"
        },
        timestamp: new Date().toISOString()
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OAuth test error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});