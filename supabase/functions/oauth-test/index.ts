import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
});