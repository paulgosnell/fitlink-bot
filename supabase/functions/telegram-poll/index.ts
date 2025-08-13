/// <reference types="https://deno.land/types/deno.d.ts" />
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleTelegramUpdate } from "../shared/telegram.ts";

// Simple polling-based bot function
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
    
    // Health check
    if (url.pathname.endsWith('/health')) {
      return new Response(
        JSON.stringify({ status: "polling bot ok", timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Poll for updates endpoint
    if (url.pathname.endsWith('/poll') && req.method === 'POST') {
      console.log("Starting polling for Telegram updates...");
      
      const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (!telegramToken) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
      }

      // Initialize Supabase
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      try {
        // Get updates from Telegram
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/getUpdates?limit=10&timeout=5`);
        const data = await response.json();
        
        if (!data.ok) {
          console.error("Telegram API error:", data);
          throw new Error("Failed to get updates from Telegram");
        }

        const updates = data.result;
        console.log(`Received ${updates.length} updates from Telegram`);

        // Process each update
        for (const update of updates) {
          try {
            console.log("Processing update:", update.update_id);
            await handleTelegramUpdate(update, supabase, telegramToken);
            
            // Mark update as processed
            await fetch(`https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${update.update_id + 1}&limit=1`);
          } catch (error) {
            console.error("Error processing update:", error);
          }
        }

        return new Response(
          JSON.stringify({ 
            ok: true, 
            processed: updates.length,
            timestamp: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error("Polling error:", error);
        return new Response(
          JSON.stringify({ 
            error: "Polling failed", 
            message: error.message,
            timestamp: new Date().toISOString()
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
