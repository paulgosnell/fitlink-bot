import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

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
      return new Response(JSON.stringify({ status: "ok" }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (req.method === 'POST') {
      const update = await req.json();
      console.log("Received update:", JSON.stringify(update, null, 2));
      
      // For now, just log the message and return success
      // This will allow Telegram to send messages without crashing
      
      if (update.message?.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        
        console.log(`Message from ${chatId}: ${text}`);
        
        // TODO: Add proper bot logic here once environment variables are set
        // For now, just acknowledge receipt
      }

      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});