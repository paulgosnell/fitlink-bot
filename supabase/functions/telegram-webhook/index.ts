import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

    // Verify webhook secret from path
    // const pathParts = url.pathname.split('/');
    // const secret = pathParts[pathParts.length - 1];
    // const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
    
    // if (!expectedSecret || secret !== expectedSecret) {
    //   return new Response(JSON.stringify({ error: "Unauthorized" }), { 
    //     status: 401, 
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    //   });
    // }

    if (req.method === 'POST') {
      const update = await req.json();
      console.log("Received update:", JSON.stringify(update, null, 2));
      
      // Get environment variables
      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!botToken || !supabaseUrl || !supabaseKey) {
        console.error("Missing environment variables");
        return new Response(JSON.stringify({ ok: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Handle basic commands
      if (update.message?.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const telegramUser = update.message.from;

        if (text === '/start') {
          // Send welcome message with main menu
          const welcomeMessage = `🚀 *Welcome to Fitlink Bot!*

Your AI-powered health intelligence hub is ready.

Connect your health data and get:
• 🧠 Deep health analysis
• 🚨 Early warning alerts  
• ⚡ Peak performance predictions
• 💎 Micro-habit coaching

What would you like to do?`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: "🔗 Connect Oura Ring", callback_data: "connect_oura" },
                { text: "🚴 Connect Strava", callback_data: "connect_strava" }
              ],
              [
                { text: "📊 Health Brief", callback_data: "brief" },
                { text: "🧠 Deep Analysis", callback_data: "deep_brief" }
              ],
              [
                { text: "⚙️ Settings", callback_data: "settings" },
                { text: "❓ Help", callback_data: "help" }
              ]
            ]
          };

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeMessage,
              parse_mode: 'Markdown',
              reply_markup: keyboard
            })
          });

          // Create user record if doesn't exist
          if (telegramUser) {
            const { error } = await supabase
              .from('users')
              .upsert({
                id: telegramUser.id,
                username: telegramUser.username || null,
                first_name: telegramUser.first_name || null,
                last_name: telegramUser.last_name || null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id'
              });

            if (error) {
              console.error("Error creating user:", error);
            }
          }
        }
      }

      // Handle callback queries (button presses)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message?.chat.id;
        const data = callbackQuery.data;

        if (chatId && data) {
          let responseText = "Feature coming soon! 🚀";

          if (data === 'connect_oura') {
            const userId = callbackQuery.from.id;
            const connectUrl = `${supabaseUrl}/functions/v1/oauth-oura/start?user_id=${userId}`;
            responseText = `🔗 *Connect your Oura Ring*

Click the link below to securely connect your Oura Ring to Fitlink Bot:

[Connect Oura Ring](${connectUrl})

This will allow me to analyze your sleep, readiness, and activity data for personalized health insights.`;
          } else if (data === 'connect_strava') {
            const userId = callbackQuery.from.id;
            const connectUrl = `${supabaseUrl}/functions/v1/oauth-strava/start?user_id=${userId}`;
            responseText = `🔗 *Connect your Strava Account*

Click the link below to securely connect your Strava account to Fitlink Bot:

[Connect Strava](${connectUrl})

This will allow me to analyze your training activities and provide personalized performance insights.`;
          } else if (data === 'brief') {
            responseText = "📊 *Health Brief*\n\nConnect your Oura Ring first to get personalized health insights!";
          } else if (data === 'deep_brief') {
            responseText = "🧠 *Deep Analysis*\n\nThis feature analyzes 30 days of your health data for advanced insights. Connect your Oura Ring to get started!";
          } else if (data === 'settings') {
            responseText = "⚙️ *Settings*\n\nSettings panel coming soon. You'll be able to customize your notifications and preferences here.";
          } else if (data === 'help') {
            responseText = `❓ *Help & Support*

*Commands:*
• /start - Show main menu
• /brief - Get health summary
• /settings - Access settings

*Features:*
• Connect Oura Ring for sleep & readiness data
• Deep AI analysis of your health patterns
• Early warning system for health issues
• Personalized micro-habit recommendations

*Support:* Contact @support for help`;
          }

          // Send response
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseText,
              parse_mode: 'Markdown'
            })
          });

          // Answer callback query
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id
            })
          });
        }
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