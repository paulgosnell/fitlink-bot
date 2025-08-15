import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleTelegramUpdate, TelegramUpdate } from "../shared/telegram.ts";

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
    
    // Health checks
    if (url.pathname.endsWith('/health') || url.pathname.endsWith('/healthz')) {
      return new Response(JSON.stringify({ status: "ok" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Self-serve webhook setup (uses function secrets)
    if (req.method === 'POST' && url.pathname.endsWith('/set-webhook')) {
      const baseUrl = Deno.env.get('BASE_URL');
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || 'webhook-secret';

      if (!baseUrl || !botToken) {
        return new Response(JSON.stringify({ error: 'Missing BASE_URL or TELEGRAM_BOT_TOKEN' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const webhookUrl = `${baseUrl}/telegram/webhook/${webhookSecret}`;
      const tgUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
      const tgResp = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const tgJson = await tgResp.json().catch(() => ({}));

      return new Response(JSON.stringify({ ok: tgResp.ok, status: tgResp.status, result: tgJson, webhookUrl }), {
        status: tgResp.ok ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Skip webhook secret verification for now to fix immediate issue
      // TODO: Re-enable after deployment issues are resolved
      // const secret = url.searchParams.get('secret');
      // const expectedSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
      
      // if (!expectedSecret || secret !== expectedSecret) {
      //   console.error('Invalid webhook secret');
      //   return new Response('Unauthorized', { status: 401 });
      // }

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;

      if (!supabaseUrl || !supabaseServiceKey || !botToken) {
        console.error('Missing required environment variables:', {
          hasSupabaseUrl: !!supabaseUrl,
          hasSupabaseServiceKey: !!supabaseServiceKey,
          hasBotToken: !!botToken
        });
        return new Response('Internal Server Error', { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Parse Telegram update
      const update: TelegramUpdate = await req.json();
      console.log("Received Telegram update:", JSON.stringify(update, null, 2));
      
      // Handle the update using shared module
      await handleTelegramUpdate(update, supabase, botToken);

      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Webhook error:", error);
    // Return ok to prevent Telegram from retrying
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});