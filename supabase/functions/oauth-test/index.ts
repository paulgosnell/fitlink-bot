import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

// Validate Telegram WebApp initData
function validateTelegramWebAppData(initData: string, botToken: string): { isValid: boolean; userData?: any } {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return { isValid: false };

    // Remove hash from params for validation
    urlParams.delete('hash');

    // Sort parameters and create data-check-string
    const sortedParams = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key: HMAC-SHA-256(bot_token, "WebAppData")
    const secretKey = hmac("sha256", "WebAppData", botToken, "utf8", "hex");
    
    // Calculate expected hash: HMAC-SHA-256(data_check_string, secret_key)
    const expectedHash = hmac("sha256", secretKey, sortedParams, "utf8", "hex");

    if (hash !== expectedHash) {
      return { isValid: false };
    }

    // Check auth_date (within last 24 hours)
    const authDate = urlParams.get('auth_date');
    if (authDate) {
      const authTimestamp = parseInt(authDate) * 1000;
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (now - authTimestamp > maxAge) {
        return { isValid: false };
      }
    }

    // Parse user data
    const userParam = urlParams.get('user');
    if (!userParam) return { isValid: false };

    const userData = JSON.parse(userParam);
    return { isValid: true, userData };

  } catch (error) {
    console.error('Telegram validation error:', error);
    return { isValid: false };
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

      // Validate Telegram WebApp data
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (!botToken) {
        return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const validation = validateTelegramWebAppData(telegram_auth_data, botToken);
      if (!validation.isValid || !validation.userData) {
        return new Response(JSON.stringify({ error: 'Invalid Telegram authentication' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const telegramId = validation.userData.id;

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Look up user by telegram_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'User not found', telegram_id: telegramId }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get user's health data and providers
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