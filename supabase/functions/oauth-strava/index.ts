import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ message: "Strava OAuth endpoint - under construction" }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});