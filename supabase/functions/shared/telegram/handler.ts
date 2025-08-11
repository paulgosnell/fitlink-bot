import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { TelegramUpdate, TelegramMessage, User } from "../types.ts";
import { sendTelegramMessage, sendTelegramMarkdownMessage } from "./api.ts";
import { getUserByTelegramId, createUser, updateUser } from "../database/users.ts";
import { generateBriefing } from "../ai/briefing.ts";
import { showMainMenu, showSettingsMenu, showConnectionsMenu } from "./menus.ts";

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    if (update.message) {
      await handleMessage(update.message, supabase, botToken);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, supabase, botToken);
    }
  } catch (error) {
    console.error("Error handling Telegram update:", error);
    
    // Send error message to user if possible
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
    if (chatId) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "Sorry, something went wrong. Please try again later."
      );
    }
  }
}

async function handleMessage(
  message: TelegramMessage,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim() || "";
  const telegramUser = message.from;

  if (!telegramUser) {
    console.error("No user data in message");
    return;
  }

  // Get or create user
  let user = await getUserByTelegramId(supabase, telegramUser.id);
  
  if (!user) {
    user = await createUser(supabase, {
      telegram_id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      timezone: 'UTC', // Will be updated when user sets location
      briefing_hour: 7,
      training_goal: 'general_fitness',
      is_active: true
    });
  }

  // Handle commands
  if (text.startsWith('/')) {
    await handleCommand(text, user, chatId, supabase, botToken);
  } else {
    // Handle text input based on current state
    await handleTextInput(text, user, chatId, supabase, botToken);
  }
}

async function handleCommand(
  command: string,
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const [cmd, ...args] = command.split(' ');

  switch (cmd.toLowerCase()) {
    case '/start':
      await handleStartCommand(user, chatId, supabase, botToken);
      break;
    
    case '/brief':
      await handleBriefCommand(user, chatId, supabase, botToken);
      break;
    
    case '/settings':
      await handleSettingsCommand(user, chatId, supabase, botToken);
      break;
    
    case '/help':
      await handleHelpCommand(user, chatId, supabase, botToken);
      break;
    
    case '/pause':
      await handlePauseCommand(user, chatId, supabase, botToken, args);
      break;
    
    case '/resume':
      await handleResumeCommand(user, chatId, supabase, botToken);
      break;
    
    case '/delete':
      await handleDeleteCommand(user, chatId, supabase, botToken);
      break;
    
    default:
      await sendTelegramMessage(
        botToken,
        chatId,
        `Unknown command: ${cmd}\n\nType /help to see available commands.`
      );
  }
}

async function handleStartCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const welcomeMessage = `👋 Hello ${user.first_name || 'there'}!

Welcome to **Fitlink Bot** — your AI-powered health briefing assistant.

I combine data from your Oura Ring, Strava activities, and local weather to create personalised morning briefings that help you optimise your training and recovery.

**What I can do:**
• 📊 Daily health briefings with sleep, training load, and weather insights
• 🎯 Personalised training recommendations based on your data
• ⚡ Smart recovery suggestions when you need them
• 🌤️ Weather-aware exercise timing

**Privacy first:** Your data stays secure, tokens are encrypted, and you control everything.

Let's get started! 👇`;

  await sendTelegramMarkdownMessage(botToken, chatId, welcomeMessage);
  await showMainMenu(botToken, chatId, user, supabase);
}

async function handleBriefCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🔄 Generating your briefing...");
    
    const briefing = await generateBriefing(user.id, supabase);
    
    if (briefing.error) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `❌ ${briefing.error}\n\nMake sure you've connected your accounts in /settings.`
      );
      return;
    }

    await sendTelegramMarkdownMessage(
      botToken,
      chatId,
      briefing.message!,
      briefing.keyboard
    );
    
  } catch (error) {
    console.error("Error generating briefing:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, there was an error generating your briefing. Please try again later."
    );
  }
}

async function handleSettingsCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  await showSettingsMenu(botToken, chatId, user, supabase);
}

async function handleHelpCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const helpMessage = `🤖 **Fitlink Bot Help**

**Commands:**
• /start - Get started and see main menu
• /brief - Get your daily briefing now
• /settings - Manage connections and preferences
• /pause [days] - Pause daily briefings (default: 7 days)
• /resume - Resume daily briefings
• /help - Show this help message
• /delete - Delete all your data

**Data Sources:**
• 🔗 **Oura Ring**: Sleep duration, efficiency, HRV, readiness score
• 🚴 **Strava**: Recent activities, training load estimation
• 🌤️ **Weather**: Local conditions, best exercise windows

**Daily Briefings:**
Your personalised morning briefing includes:
• Sleep quality and recovery status
• Training load vs. your averages
• Today's weather and exercise recommendations
• Specific action items (hydration, recovery, etc.)

**Privacy:**
• Your data is encrypted and never shared
• Connect/disconnect accounts anytime
• Full data deletion available with /delete

**Support:**
Having issues? The bot logs errors automatically, but you can also provide feedback using the 👍👎 buttons on briefings.`;

  await sendTelegramMarkdownMessage(botToken, chatId, helpMessage);
}

async function handlePauseCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string,
  args: string[]
): Promise<void> {
  const days = parseInt(args[0]) || 7;
  const pauseUntil = new Date();
  pauseUntil.setDate(pauseUntil.getDate() + days);

  await updateUser(supabase, user.id, {
    paused_until: pauseUntil.toISOString().split('T')[0]
  });

  await sendTelegramMessage(
    botToken,
    chatId,
    `⏸️ Daily briefings paused for ${days} days.\n\nYou can still use /brief for on-demand briefings.\nUse /resume to restart daily briefings anytime.`
  );
}

async function handleResumeCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  await updateUser(supabase, user.id, {
    paused_until: null
  });

  await sendTelegramMessage(
    botToken,
    chatId,
    `▶️ Daily briefings resumed!\n\nYou'll receive your next briefing tomorrow at ${user.briefing_hour}:00.`
  );
}

async function handleDeleteCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const confirmMessage = `⚠️ **Data Deletion Confirmation**

This will permanently delete:
• Your user profile and settings
• All connected account tokens
• Sleep and activity data
• Briefing history

This action cannot be undone.

Reply with "DELETE MY DATA" to confirm, or anything else to cancel.`;

  await sendTelegramMarkdownMessage(botToken, chatId, confirmMessage);
  
  // Note: In a full implementation, you'd set a user state to handle the confirmation
  // For now, this is a placeholder for the confirmation flow
}

async function handleTextInput(
  text: string,
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  // Handle data deletion confirmation
  if (text.toUpperCase() === "DELETE MY DATA") {
    try {
      // Delete all user data
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      await sendTelegramMessage(
        botToken,
        chatId,
        "✅ All your data has been permanently deleted.\n\nThanks for using Fitlink Bot. Feel free to /start again anytime!"
      );
    } catch (error) {
      console.error("Error deleting user data:", error);
      await sendTelegramMessage(
        botToken,
        chatId,
        "❌ Error deleting data. Please try again or contact support."
      );
    }
    return;
  }

  // Default response for unrecognized text
  await sendTelegramMessage(
    botToken,
    chatId,
    "I didn't understand that. Type /help to see what I can do! 🤖"
  );
}

async function handleCallbackQuery(
  callbackQuery: any,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  const user = await getUserByTelegramId(supabase, userId);
  if (!user) {
    console.error("User not found for callback query");
    return;
  }

  // Answer the callback query to remove loading state
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQuery.id,
      text: "Processing..."
    })
  });

  // Handle different callback data
  switch (data) {
    case 'main_menu':
      await showMainMenu(botToken, chatId, user, supabase);
      break;
    
    case 'settings':
      await showSettingsMenu(botToken, chatId, user, supabase);
      break;
    
    case 'connections':
      await showConnectionsMenu(botToken, chatId, user, supabase);
      break;
    
    case 'brief_now':
      await handleBriefCommand(user, chatId, supabase, botToken);
      break;
    
    case 'feedback_positive':
    case 'feedback_negative':
      await handleFeedback(data === 'feedback_positive' ? 1 : -1, user, supabase, botToken, chatId);
      break;
    
    default:
      if (data.startsWith('connect_')) {
        const provider = data.replace('connect_', '') as 'oura' | 'strava';
        await handleOAuthStart(provider, user, supabase, botToken, chatId);
      }
  }
}

async function handleFeedback(
  rating: 1 | -1,
  user: User,
  supabase: SupabaseClient,
  botToken: string,
  chatId: number
): Promise<void> {
  // Update the most recent brief log with feedback
  const { error } = await supabase
    .from('brief_logs')
    .update({ feedback_rating: rating })
    .eq('user_id', user.id)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error saving feedback:", error);
  }

  const message = rating === 1 
    ? "👍 Thanks for the positive feedback!" 
    : "👎 Thanks for the feedback. I'll work on improving!";
  
  await sendTelegramMessage(botToken, chatId, message);
}

async function handleOAuthStart(
  provider: 'oura' | 'strava',
  user: User,
  supabase: SupabaseClient,
  botToken: string,
  chatId: number
): Promise<void> {
  const baseUrl = Deno.env.get('BASE_URL');
  const oauthUrl = `${baseUrl}/oauth/${provider}/start?user_id=${user.id}`;
  
  const providerName = provider === 'oura' ? 'Oura Ring' : 'Strava';
  
  await sendTelegramMarkdownMessage(
    botToken,
    chatId,
    `🔗 **Connect ${providerName}**\n\nClick the button below to securely connect your ${providerName} account.`,
    {
      inline_keyboard: [[
        { text: `Connect ${providerName}`, url: oauthUrl }
      ]]
    }
  );
}
