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
      
      const [sleepData, activityData, providers] = await Promise.all([
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
          .gte('start_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('start_date', { ascending: false })
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
        provider_count: providers.data?.length || 0,
        provider_error: providers.error?.message
      });

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
        providers: providers.data || [],
        debug_info: {
          lookup_method: 'telegram_id_direct',
          validation_skipped: true,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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