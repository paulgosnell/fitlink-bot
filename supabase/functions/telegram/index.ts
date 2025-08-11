/// <reference types="https://deno.land/types/deno.d.ts" />
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleTelegramUpdate } from "../shared/telegram/handler.ts";

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract webhook secret from path
    const pathParts = url.pathname.split('/');
    const secret = pathParts[pathParts.length - 1];
    const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
    
    if (!expectedSecret || secret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle webhook
    if (req.method === 'POST') {
      const update = await req.json();
      console.log("Received Telegram update:", JSON.stringify(update, null, 2));
      
      const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (!telegramToken) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
      }

      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Process the update with full handler
      await handleTelegramUpdate(update, supabase, telegramToken);
      
      return new Response(
        JSON.stringify({ ok: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
