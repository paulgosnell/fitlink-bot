import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { User, TelegramInlineKeyboardMarkup } from "../types.ts";
import { sendTelegramMarkdownMessage } from "./api.ts";
import { getProvidersByUserId } from "../database/providers.ts";

export async function showMainMenu(
  botToken: string,
  chatId: number,
  user: User,
  supabase: SupabaseClient
): Promise<void> {
  const providers = await getProvidersByUserId(supabase, user.id);
  const hasOura = providers.some(p => p.provider === 'oura' && p.is_active);
  const hasStrava = providers.some(p => p.provider === 'strava' && p.is_active);

  const connectionStatus = [];
  if (hasOura) connectionStatus.push("✅ Oura Ring");
  if (hasStrava) connectionStatus.push("✅ Strava");
  if (!hasOura && !hasStrava) connectionStatus.push("❌ No connections");

  const message = `🏠 **Main Menu**

**Current Status:**
${connectionStatus.join('\n')}
📍 ${user.city || 'Location not set'}
⏰ Daily briefing: ${user.briefing_hour}:00 ${user.timezone}
${user.paused_until ? '⏸️ Briefings paused' : '▶️ Briefings active'}

**What would you like to do?**`;

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "📊 Get Briefing Now", callback_data: "brief_now" }],
      [
        { text: "🔗 Connections", callback_data: "connections" },
        { text: "⚙️ Settings", callback_data: "settings" }
      ],
      [{ text: "❓ Help", callback_data: "help" }]
    ]
  };

  await sendTelegramMarkdownMessage(botToken, chatId, message, keyboard);
}

export async function showSettingsMenu(
  botToken: string,
  chatId: number,
  user: User,
  supabase: SupabaseClient
): Promise<void> {
  const message = `⚙️ **Settings**

**Current Configuration:**
📍 Location: ${user.city || 'Not set'}
⏰ Briefing time: ${user.briefing_hour}:00 ${user.timezone}
🎯 Training goal: ${user.training_goal.replace('_', ' ')}
${user.paused_until ? `⏸️ Paused until: ${user.paused_until}` : '▶️ Briefings active'}

**What would you like to change?**`;

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "📍 Set Location", callback_data: "set_location" }],
      [{ text: "⏰ Change Briefing Time", callback_data: "set_time" }],
      [{ text: "🎯 Training Goal", callback_data: "set_goal" }],
      [
        { text: user.paused_until ? "▶️ Resume" : "⏸️ Pause", callback_data: user.paused_until ? "resume" : "pause" }
      ],
      [{ text: "🗑️ Delete Data", callback_data: "delete_data" }],
      [{ text: "🔙 Back", callback_data: "main_menu" }]
    ]
  };

  await sendTelegramMarkdownMessage(botToken, chatId, message, keyboard);
}

export async function showConnectionsMenu(
  botToken: string,
  chatId: number,
  user: User,
  supabase: SupabaseClient
): Promise<void> {
  const providers = await getProvidersByUserId(supabase, user.id);
  
  const ouraProvider = providers.find(p => p.provider === 'oura');
  const stravaProvider = providers.find(p => p.provider === 'strava');

  const message = `🔗 **Account Connections**

**Health Data Sources:**

**Oura Ring** ${ouraProvider?.is_active ? '✅' : '❌'}
${ouraProvider?.is_active ? 'Connected - Sleep & recovery data' : 'Not connected'}

**Strava** ${stravaProvider?.is_active ? '✅' : '❌'}
${stravaProvider?.is_active ? 'Connected - Activity & training data' : 'Not connected'}

**Privacy:** All tokens are encrypted and stored securely. You can disconnect anytime.`;

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: []
  };

  // Add connection buttons
  if (!ouraProvider?.is_active) {
    keyboard.inline_keyboard.push([{ text: "🔗 Connect Oura Ring", callback_data: "connect_oura" }]);
  } else {
    keyboard.inline_keyboard.push([
      { text: "🔄 Sync Data", callback_data: "sync_oura" },
      { text: "🔌 Disconnect", callback_data: "disconnect_oura" }
    ]);
  }

  if (!stravaProvider?.is_active) {
    keyboard.inline_keyboard.push([{ text: "🔗 Connect Strava", callback_data: "connect_strava" }]);
  } else {
    keyboard.inline_keyboard.push([
      { text: "🔄 Sync Data", callback_data: "sync_strava" },
      { text: "🔌 Disconnect", callback_data: "disconnect_strava" }
    ]);
  }

  keyboard.inline_keyboard.push([{ text: "🔙 Back", callback_data: "main_menu" }]);

  await sendTelegramMarkdownMessage(botToken, chatId, message, keyboard);
}

export async function showWebAppDashboard(
  botToken: string,
  chatId: number,
  user: User
): Promise<void> {
  const webAppUrl = `${Deno.env.get('WEBAPP_URL')}/dashboard?user_id=${user.id}`;
  
  const message = `📱 **Dashboard**

View your detailed health metrics, trends, and briefing history in the web dashboard.`;

  const keyboard: TelegramInlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: "📊 Open Dashboard", web_app: { url: webAppUrl } }],
      [{ text: "🔙 Back", callback_data: "main_menu" }]
    ]
  };

  await sendTelegramMarkdownMessage(botToken, chatId, message, keyboard);
}

export function createBriefingKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "👍", callback_data: "feedback_positive" },
        { text: "👎", callback_data: "feedback_negative" }
      ],
      [
        { text: "📊 Dashboard", callback_data: "dashboard" },
        { text: "⚙️ Settings", callback_data: "settings" }
      ]
    ]
  };
}
