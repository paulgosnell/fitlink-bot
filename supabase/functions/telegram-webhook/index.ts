/// <reference types="https://deno.land/types/deno.d.ts" />
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleTelegramUpdate } from "../shared/telegram/handler.ts";

serve(async (req) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    console.log("Received request:", req.method, url.pathname);
    
    // Health check endpoint (no auth required)
    if (url.pathname.endsWith('/health')) {
      return new Response(
        JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Webhook endpoint - extract secret from path
    const pathParts = url.pathname.split('/');
    const secret = pathParts[pathParts.length - 1];
    const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
    
    console.log("Webhook secret check:", { received: secret, expected: expectedSecret ? "SET" : "NOT_SET" });
    
    // Verify webhook secret
    if (!expectedSecret || secret !== expectedSecret) {
      console.error("Invalid webhook secret:", { received: secret, expected: expectedSecret });
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid webhook secret" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle webhook POST requests
    if (req.method === 'POST') {
      console.log("Processing webhook POST request");
      
      // Parse Telegram update
      let update;
      try {
        update = await req.json();
        console.log("Received Telegram update:", JSON.stringify(update, null, 2));
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return new Response(
          JSON.stringify({ error: "Invalid JSON" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get environment variables
      const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!telegramToken) {
        console.error("TELEGRAM_BOT_TOKEN not configured");
        return new Response(
          JSON.stringify({ error: "Bot token not configured" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase configuration missing");
        return new Response(
          JSON.stringify({ error: "Database not configured" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Initialize Supabase client with service role key
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        // Process the Telegram update
        await handleTelegramUpdate(update, supabase, telegramToken);
        
        console.log("Successfully processed Telegram update");
        return new Response(
          JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (handlerError) {
        console.error("Error in handleTelegramUpdate:", handlerError);
        
        // Still return OK to Telegram to prevent retries
        return new Response(
          JSON.stringify({ ok: true, error: "Internal processing error" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Method not allowed
    console.log("Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Top-level error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
