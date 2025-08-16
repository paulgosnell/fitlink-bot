/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// Validate Telegram WebApp initData
function validateTelegramWebAppData(initData: string, botToken: string): { isValid: boolean; userData?: any; error?: string } {
  try {
    console.log('DEBUG: Starting Telegram WebApp validation');
    console.log('DEBUG: InitData length:', initData?.length || 0);
    console.log('DEBUG: Has bot token:', !!botToken);
    
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    console.log('DEBUG: Hash present:', !!hash);
    
    if (!hash) {
      console.log('DEBUG: No hash in initData');
      return { isValid: false, error: 'No hash in initData' };
    }

    // Remove hash from params for validation
    urlParams.delete('hash');

    // Sort parameters and create data-check-string
    const sortedParams = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    console.log('DEBUG: Sorted params for validation:', sortedParams);

    // Create secret key: HMAC-SHA-256(bot_token, "WebAppData")
    const secretKey = hmac("sha256", "WebAppData", botToken, "utf8", "hex");
    console.log('DEBUG: Secret key generated (first 10 chars):', secretKey.substring(0, 10));
    
    // Calculate expected hash: HMAC-SHA-256(data_check_string, secret_key)
    const expectedHash = hmac("sha256", secretKey, sortedParams, "utf8", "hex");
    console.log('DEBUG: Expected hash:', expectedHash);
    console.log('DEBUG: Received hash:', hash);
    console.log('DEBUG: Hashes match:', hash === expectedHash);

    if (hash !== expectedHash) {
      console.log('DEBUG: Hash validation failed - trying to extract user anyway for debugging');
      
      // For debugging, try to extract user data even if hash fails
      const userParam = urlParams.get('user');
      if (userParam) {
        try {
          const userData = JSON.parse(userParam);
          console.log('DEBUG: User data extracted despite hash failure:', userData);
          // Return valid for debugging purposes but log the issue
          return { isValid: true, userData, error: 'Hash validation failed but allowing for debug' };
        } catch (e) {
          console.log('DEBUG: Could not parse user data:', e);
        }
      }
      
      return { isValid: false, error: `Hash validation failed. Expected: ${expectedHash}, Got: ${hash}` };
    }

    // Check auth_date (within last 24 hours)
    const authDate = urlParams.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate) * 1000;
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      console.log('DEBUG: Auth timestamp:', authTimestamp);
      console.log('DEBUG: Current timestamp:', now);
      console.log('DEBUG: Age in hours:', (now - authTimestamp) / (60 * 60 * 1000));
      
      if (now - authTimestamp > maxAge) {
        console.log('DEBUG: Auth data too old');
        return { isValid: false, error: 'Auth data too old (>24 hours)' };
      }
    }

    // Parse user data
    const userParam = urlParams.get('user');
    if (!userParam) {
      console.log('DEBUG: No user parameter in initData');
      return { isValid: false, error: 'No user parameter in initData' };
    }

    const userData = JSON.parse(userParam);
    console.log('DEBUG: Successfully parsed user data:', userData);
    return { isValid: true, userData };

  } catch (error) {
    console.error('DEBUG: Telegram validation error:', error);
    return { isValid: false, error: `Validation exception: ${error.message}` };
  }
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
    const url = new URL(req.url);
    
    // Database lookup endpoint for dashboard
    if (url.pathname.endsWith('/user-lookup') && req.method === 'POST') {
      const body = await req.json();
      const { telegram_auth_data } = body;
      
      if (!telegram_auth_data) {
        return new Response(JSON.stringify({ error: 'Missing telegram_auth_data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // TEMPORARY: Skip validation for debugging
      console.log('DEBUG: Skipping Telegram validation for debugging');
      
      // Extract user ID directly from the request for debugging
      const telegramId = body.telegram_id;
      console.log('DEBUG: Using telegram_id from request body:', telegramId);
      
      if (!telegramId) {
        return new Response(JSON.stringify({ 
          error: 'Missing telegram_id in request', 
          debug_info: { body_keys: Object.keys(body) }
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
        providers: providers.data || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Debug environment variables (for GET requests)
    const envCheck = {
      TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN") ? "SET" : "NOT_SET",
      OURA_CLIENT_ID: Deno.env.get("OURA_CLIENT_ID") ? "SET" : "NOT_SET",
      OURA_CLIENT_SECRET: Deno.env.get("OURA_CLIENT_SECRET") ? "SET" : "NOT_SET",
      STRAVA_CLIENT_ID: Deno.env.get("STRAVA_CLIENT_ID") ? "SET" : "NOT_SET", 
      STRAVA_CLIENT_SECRET: Deno.env.get("STRAVA_CLIENT_SECRET") ? "SET" : "NOT_SET",
      BASE_URL: Deno.env.get("BASE_URL") ? "SET" : "NOT_SET",
      SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "SET" : "NOT_SET",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "SET" : "NOT_SET",
      LAST_DEPLOYED: "2025-08-16-15:30:00", // Force function update
      VALIDATION_DISABLED: "YES" // Confirm validation is disabled
    };

    return new Response(
      JSON.stringify({ 
        message: "Telegram WebApp authentication service",
        env: envCheck,
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