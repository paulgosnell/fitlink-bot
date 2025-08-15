import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { TelegramUpdate, TelegramMessage, TelegramWebAppData, User } from "../types.ts";
import { sendTelegramMessage, sendTelegramMarkdownMessage } from "./api.ts";
import { getUserByTelegramId, createUser, updateUser } from "../database/users.ts";
import { generateBriefing, generateDeepBriefing } from "../ai/briefing.ts";
import { showMainMenu, showSettingsMenu, showConnectionsMenu } from "./menus.ts";
import { handleAdminResponse, submitFeedback } from "../feedback.ts";

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
    } else if (update.web_app_data) {
      await handleWebAppData(update.web_app_data, supabase, botToken);
    }
  } catch (error) {
    console.error("Error handling Telegram update:", error);
    console.error("Error stack:", error.stack);
    console.error("Update that caused error:", JSON.stringify(update, null, 2));
    
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

  // CRITICAL: Ignore messages from bots (including ourselves) to prevent infinite loops
  if (telegramUser.is_bot) {
    console.log("Ignoring message from bot:", telegramUser.username);
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

async function handleWebAppData(
  webAppData: TelegramWebAppData,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    const data = JSON.parse(webAppData.data);
    console.log('Web App Data received:', data);
    
    if (data.action === 'feedback' && data.data) {
      await handleWebAppFeedback(data.data, supabase, botToken);
    }
  } catch (error) {
    console.error('Error parsing web app data:', error);
  }
}

async function handleWebAppFeedback(
  feedbackData: any,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    // Note: Web App data doesn't include user info directly,
    // so we need to get it from the context or find another way
    console.log('Processing web app feedback:', feedbackData);
    
    // For now, we'll log it and could implement user lookup via timestamp matching
    // or require the dashboard to include user ID in the feedback data
    
    // TODO: Implement proper user identification for web app feedback
    console.warn('Web app feedback received but user identification needed');
    
  } catch (error) {
    console.error('Error handling web app feedback:', error);
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
      
    case '/deepbrief':
    case '/deep':
      await handleDeepBriefCommand(user, chatId, supabase, botToken);
      break;
      
    case '/dashboard':
      await handleDashboardCommand(user, chatId, supabase, botToken);
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
    
    case '/feedback':
      await handleFeedbackCommand(user, chatId, supabase, botToken);
      break;
    
    // Admin commands for feedback responses
    case '/reply':
    case '/resolve':
    case '/priority':
      const adminResult = await handleAdminResponse(user.telegram_id, cmd, args, supabase, botToken);
      await sendTelegramMessage(botToken, chatId, adminResult.message);
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
  // Just show the main menu with all functionality
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

async function handleDeepBriefCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🧠 Analyzing your health patterns...\n\n_This may take a moment as I dive deep into 30 days of your data._");
    
    const deepBriefing = await generateDeepBriefing(user.id, supabase, 30);
    
    if (deepBriefing.error) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `❌ ${deepBriefing.error}\n\nI need at least a few days of data to perform deep analysis. Try connecting your accounts in /settings and come back in a couple of days!`
      );
      return;
    }

    await sendTelegramMarkdownMessage(
      botToken,
      chatId,
      deepBriefing.message!,
      deepBriefing.keyboard
    );
    
  } catch (error) {
    console.error("Error generating deep briefing:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, there was an error analyzing your health patterns. Please try again later."
    );
  }
}

async function handleDashboardCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    // Show dashboard summary directly in Telegram first
    await showDashboardSummary(user, chatId, supabase, botToken);
    
  } catch (error) {
    console.error("Error showing dashboard:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, there was an error loading your dashboard. Please try again later."
    );
  }
}

async function showDashboardSummary(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "📊 Loading your health dashboard...");
    
    // Get recent health data for summary
    const healthSummary = await generateQuickHealthSummary(user.id, supabase);
    
    if (!healthSummary) {
      await sendTelegramMarkdownMessage(
        botToken,
        chatId,
        `📊 **Health Dashboard**

_Connect your devices to see personalized analytics!_

**Available when connected:**
• 30-day trend analysis
• Predictive health alerts
• Peak performance windows
• Micro-habit coaching

Use /settings to connect your Oura Ring and Strava accounts.`,
        {
          inline_keyboard: [[
            { text: "⚙️ Connect Devices", callback_data: "settings" }
          ]]
        }
      );
      return;
    }
    
    // Format dashboard summary message
    const summaryMessage = formatDashboardSummary(healthSummary, user);
    
    // Create dashboard navigation keyboard
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📈 Deep Analysis", callback_data: "dashboard_deep" },
          { text: "🎯 Habits", callback_data: "dashboard_habits" }
        ],
        [
          { text: "⚡ Alerts", callback_data: "dashboard_alerts" },
          { text: "📱 Full Web Dashboard", web_app: { url: await generateWebAppUrl(user.id, supabase) } }
        ],
        [
          { text: "🔄 Refresh", callback_data: "dashboard_refresh" },
          { text: "🏠 Main Menu", callback_data: "main_menu" }
        ]
      ]
    };
    
    await sendTelegramMarkdownMessage(botToken, chatId, summaryMessage, keyboard);
    
  } catch (error) {
    console.error("Error in dashboard summary:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Unable to load dashboard data. Make sure your devices are connected in /settings."
    );
  }
}

async function generateQuickHealthSummary(userId: string, supabase: SupabaseClient) {
  try {
    // Get last 7 days of sleep data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [sleepData, activityData] = await Promise.all([
      supabase
        .from('oura_sleep')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(7),
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', sevenDaysAgo.toISOString())
        .order('start_time', { ascending: false })
        .limit(10)
    ]);

    if ((!sleepData.data || sleepData.data.length === 0) && 
        (!activityData.data || activityData.data.length === 0)) {
      return null;
    }

    return {
      sleep: sleepData.data || [],
      activities: activityData.data || [],
      hasData: true
    };
  } catch (error) {
    console.error("Error getting quick health summary:", error);
    return null;
  }
}

function formatDashboardSummary(data: any, user: any): string {
  const { sleep, activities } = data;
  
  let message = `📊 **${user.first_name}'s Health Dashboard**\n\n`;
  
  // Sleep Summary
  if (sleep.length > 0) {
    const latestSleep = sleep[0];
    const avgEfficiency = sleep.reduce((sum: number, s: any) => sum + (s.sleep_efficiency || 0), 0) / sleep.length;
    const avgHRV = sleep.filter((s: any) => s.hrv_avg > 0).reduce((sum: number, s: any) => sum + s.hrv_avg, 0) / sleep.filter((s: any) => s.hrv_avg > 0).length || 0;
    
    message += `💤 **Sleep (7 days)**\n`;
    message += `• Latest: ${Math.round((latestSleep.total_sleep_minutes || 0) / 60 * 10) / 10}h (${latestSleep.sleep_efficiency || 0}% efficiency)\n`;
    message += `• Avg Efficiency: ${Math.round(avgEfficiency)}%\n`;
    if (avgHRV > 0) {
      message += `• Avg HRV: ${Math.round(avgHRV)}\n`;
    }
    message += `\n`;
  }
  
  // Activity Summary
  if (activities.length > 0) {
    const totalTSS = activities.reduce((sum: number, a: any) => sum + (a.tss_estimated || 0), 0);
    const totalDuration = activities.reduce((sum: number, a: any) => sum + (a.duration_seconds || 0), 0);
    
    message += `🏃 **Training (7 days)**\n`;
    message += `• Sessions: ${activities.length}\n`;
    message += `• Total Time: ${Math.round(totalDuration / 3600 * 10) / 10}h\n`;
    if (totalTSS > 0) {
      message += `• Training Load: ${Math.round(totalTSS)} TSS\n`;
    }
    message += `\n`;
  }
  
  // Quick Status
  message += `⚡ **Quick Status**\n`;
  
  if (sleep.length >= 3) {
    const recentSleep = sleep.slice(0, 3);
    const sleepTrend = recentSleep[0].sleep_efficiency > recentSleep[2].sleep_efficiency ? "↗️ Improving" : "↘️ Declining";
    message += `• Sleep Trend: ${sleepTrend}\n`;
  }
  
  if (activities.length >= 2) {
    const recentActivities = activities.slice(0, 2);
    const isActive = recentActivities.length > 0 && new Date(recentActivities[0].start_time) > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    message += `• Activity: ${isActive ? "🟢 Active" : "🟡 Rest Phase"}\n`;
  }
  
  message += `\n_Use buttons below to explore detailed analytics_ 👇`;
  
  return message;
}

async function generateWebAppUrl(userId: string, supabase: SupabaseClient): Promise<string> {
  // Return Web App URL directly - authentication handled via Telegram Web App API
  return `https://fitlinkbot.netlify.app/dashboard.html`;
}

async function generateDashboardToken(userId: string, supabase: SupabaseClient): Promise<string> {
  // Generate a secure token for dashboard access
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry
  
  // Store the token in database for validation
  const { error } = await supabase
    .from('dashboard_tokens')
    .insert([{
      user_id: userId,
      token: token,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    }]);
    
  if (error) {
    console.error("Error storing dashboard token:", error);
    throw new Error("Failed to generate dashboard access");
  }
  
  return token;
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
• /deepbrief - Deep health analysis (30-day trends)
• /dashboard - Access your web analytics dashboard
• /settings - Manage connections and preferences
• /feedback - Send feedback to our team
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

  // Check if user is in feedback mode
  if (user.conversation_state === 'awaiting_feedback') {
    await handleFeedbackSubmission(text, user, chatId, supabase, botToken);
    return;
  }

  // Auto-detect feedback messages
  if (isFeedbackMessage(text)) {
    const feedbackType = classifyFeedbackType(text);
    await handleAutoFeedback(text, feedbackType, user, chatId, supabase, botToken);
    return;
  }

  // Default response for unrecognized text
  await sendTelegramMessage(
    botToken,
    chatId,
    "I didn't understand that. Type /help to see what I can do! 🤖\n\nOr type /feedback to send us your thoughts!"
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
    
    case 'feedback':
      await handleFeedbackCommand(user, chatId, supabase, botToken);
      break;
    
    case 'dashboard_deep':
      await handleDeepBriefCommand(user, chatId, supabase, botToken);
      break;
      
    case 'dashboard_habits':
      await handleDashboardHabits(user, chatId, supabase, botToken);
      break;
      
    case 'dashboard_alerts':
      await handleDashboardAlerts(user, chatId, supabase, botToken);
      break;
      
    case 'dashboard_refresh':
      await showDashboardSummary(user, chatId, supabase, botToken);
      break;
    
    default:
      if (data.startsWith('connect_')) {
        const provider = data.replace('connect_', '') as 'oura' | 'strava';
        await handleOAuthStart(provider, user, supabase, botToken, chatId);
      }
  }
}

async function handleDashboardHabits(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🎯 Generating your personalized habits...");
    
    // Get recent health data for habit recommendations
    const healthSummary = await generateQuickHealthSummary(user.id, supabase);
    
    if (!healthSummary) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "Connect your devices first to get personalized habit recommendations! Use /settings to get started."
      );
      return;
    }
    
    const habits = generatePersonalizedHabits(healthSummary, user);
    const habitMessage = formatHabitsMessage(habits, user.first_name || 'there');
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 Back to Dashboard", callback_data: "dashboard_refresh" },
          { text: "📈 Deep Analysis", callback_data: "dashboard_deep" }
        ],
        [
          { text: "🏠 Main Menu", callback_data: "main_menu" }
        ]
      ]
    };
    
    await sendTelegramMarkdownMessage(botToken, chatId, habitMessage, keyboard);
    
  } catch (error) {
    console.error("Error showing habits:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, there was an error generating your habits. Please try again."
    );
  }
}

async function handleDashboardAlerts(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "⚡ Checking your health alerts...");
    
    // Get recent health data for alerts
    const healthSummary = await generateQuickHealthSummary(user.id, supabase);
    
    if (!healthSummary) {
      await sendTelegramMessage(
        botToken,
        chatId,
        "Connect your devices to receive personalized health alerts! Use /settings to get started."
      );
      return;
    }
    
    const alerts = generateHealthAlerts(healthSummary);
    const alertMessage = formatAlertsMessage(alerts, user.first_name || 'there');
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: "📊 Back to Dashboard", callback_data: "dashboard_refresh" },
          { text: "🎯 View Habits", callback_data: "dashboard_habits" }
        ],
        [
          { text: "🏠 Main Menu", callback_data: "main_menu" }
        ]
      ]
    };
    
    await sendTelegramMarkdownMessage(botToken, chatId, alertMessage, keyboard);
    
  } catch (error) {
    console.error("Error showing alerts:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "Sorry, there was an error checking your health alerts. Please try again."
    );
  }
}

function generatePersonalizedHabits(healthSummary: any, user: any): any[] {
  const { sleep, activities } = healthSummary;
  const habits = [];
  
  // Sleep-based habits
  if (sleep.length > 0) {
    const avgEfficiency = sleep.reduce((sum: number, s: any) => sum + (s.sleep_efficiency || 0), 0) / sleep.length;
    const avgDuration = sleep.reduce((sum: number, s: any) => sum + (s.total_sleep_minutes || 0), 0) / sleep.length / 60;
    
    if (avgEfficiency < 80) {
      habits.push({
        time: "Evening (9:00 PM)",
        icon: "🌙",
        title: "Sleep Optimization",
        description: `Your sleep efficiency is ${Math.round(avgEfficiency)}%. Try dimming lights 2 hours before bed to improve sleep quality.`,
        category: "sleep"
      });
    }
    
    if (avgDuration < 7) {
      habits.push({
        time: "Bedtime",
        icon: "⏰",
        title: "Sleep Duration",
        description: `You're averaging ${avgDuration.toFixed(1)}h sleep. Aim to go to bed 30 minutes earlier for optimal recovery.`,
        category: "sleep"
      });
    }
  }
  
  // Activity-based habits
  if (activities.length > 0) {
    const totalTSS = activities.reduce((sum: number, a: any) => sum + (a.tss_estimated || 0), 0);
    
    if (totalTSS > 300) {
      habits.push({
        time: "Post-Workout",
        icon: "❄️",
        title: "Recovery Boost",
        description: "High training load detected. Try 10-15 minutes of cold exposure after workouts to enhance recovery.",
        category: "recovery"
      });
    } else if (totalTSS < 100 && activities.length < 3) {
      habits.push({
        time: "Morning (7:00 AM)",
        icon: "🚶",
        title: "Movement Activation",
        description: "Low activity this week. Start with a 15-minute morning walk to boost energy and circulation.",
        category: "activity"
      });
    }
  }
  
  // Default habits if no data
  if (habits.length === 0) {
    habits.push(
      {
        time: "Morning (7:00 AM)",
        icon: "☀️",
        title: "Circadian Reset",
        description: "Get 10-15 minutes of natural sunlight within 30 minutes of waking to optimize your sleep-wake cycle.",
        category: "general"
      },
      {
        time: "Evening (8:00 PM)",
        icon: "📱",
        title: "Digital Sunset",
        description: "Reduce blue light exposure 2 hours before bed to improve sleep quality and HRV recovery.",
        category: "general"
      }
    );
  }
  
  return habits.slice(0, 3); // Limit to 3 habits for focus
}

function generateHealthAlerts(healthSummary: any): any[] {
  const { sleep, activities } = healthSummary;
  const alerts = [];
  
  // Sleep alerts
  if (sleep.length >= 3) {
    const recentSleep = sleep.slice(0, 3);
    const avgEfficiency = recentSleep.reduce((sum: number, s: any) => sum + (s.sleep_efficiency || 0), 0) / recentSleep.length;
    const hrvValues = recentSleep.map((s: any) => s.hrv_avg).filter((h: number) => h > 0);
    
    if (avgEfficiency < 70) {
      alerts.push({
        type: "warning",
        icon: "⚠️",
        title: "Low Sleep Efficiency",
        message: `Sleep efficiency dropped to ${Math.round(avgEfficiency)}% over last 3 days. Consider sleep hygiene improvements.`,
        priority: "high"
      });
    }
    
    if (hrvValues.length >= 2) {
      const hrvTrend = ((hrvValues[0] - hrvValues[hrvValues.length - 1]) / hrvValues[hrvValues.length - 1]) * 100;
      if (hrvTrend < -15) {
        alerts.push({
          type: "alert",
          icon: "🚨",
          title: "HRV Declining",
          message: `HRV dropped ${Math.abs(Math.round(hrvTrend))}% recently. Consider reducing training intensity and prioritizing recovery.`,
          priority: "high"
        });
      }
    }
  }
  
  // Training alerts
  if (activities.length > 0) {
    const recentTSS = activities.slice(0, 3).reduce((sum: number, a: any) => sum + (a.tss_estimated || 0), 0);
    const weeklyTSS = activities.reduce((sum: number, a: any) => sum + (a.tss_estimated || 0), 0);
    
    if (weeklyTSS > 400 && activities.length > 6) {
      alerts.push({
        type: "warning",
        icon: "🏃‍♂️",
        title: "High Training Load",
        message: `Weekly TSS: ${Math.round(weeklyTSS)}. Monitor recovery markers closely and consider a rest day.`,
        priority: "medium"
      });
    }
  }
  
  // Positive alerts
  if (sleep.length >= 7) {
    const weekAvgEfficiency = sleep.reduce((sum: number, s: any) => sum + (s.sleep_efficiency || 0), 0) / sleep.length;
    if (weekAvgEfficiency > 85) {
      alerts.push({
        type: "positive",
        icon: "✅",
        title: "Excellent Sleep Pattern",
        message: `Outstanding ${Math.round(weekAvgEfficiency)}% average sleep efficiency this week! Keep up the great routine.`,
        priority: "low"
      });
    }
  }
  
  // Default positive message if no issues
  if (alerts.length === 0) {
    alerts.push({
      type: "positive",
      icon: "💪",
      title: "All Systems Go",
      message: "No health alerts detected. Your recovery patterns look stable. Keep up the great work!",
      priority: "low"
    });
  }
  
  return alerts;
}

function formatHabitsMessage(habits: any[], userName: string): string {
  let message = `🎯 **${userName}'s Personalized Habits**\n\n`;
  message += `_Based on your recent health patterns:_\n\n`;
  
  habits.forEach((habit, index) => {
    message += `${habit.icon} **${habit.title}**\n`;
    message += `⏰ ${habit.time}\n`;
    message += `${habit.description}\n\n`;
  });
  
  message += `💡 _Focus on 1-2 habits first, then build your routine gradually._`;
  
  return message;
}

function formatAlertsMessage(alerts: any[], userName: string): string {
  let message = `⚡ **${userName}'s Health Alerts**\n\n`;
  
  const highAlerts = alerts.filter(a => a.priority === 'high');
  const mediumAlerts = alerts.filter(a => a.priority === 'medium');
  const positiveAlerts = alerts.filter(a => a.type === 'positive');
  
  if (highAlerts.length > 0) {
    message += `🚨 **Immediate Attention**\n`;
    highAlerts.forEach(alert => {
      message += `${alert.icon} ${alert.title}: ${alert.message}\n\n`;
    });
  }
  
  if (mediumAlerts.length > 0) {
    message += `⚠️ **Monitor Closely**\n`;
    mediumAlerts.forEach(alert => {
      message += `${alert.icon} ${alert.title}: ${alert.message}\n\n`;
    });
  }
  
  if (positiveAlerts.length > 0) {
    message += `✅ **Good News**\n`;
    positiveAlerts.forEach(alert => {
      message += `${alert.icon} ${alert.title}: ${alert.message}\n\n`;
    });
  }
  
  message += `_Alerts update based on your latest health data._`;
  
  return message;
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
  const oauthUrl = `${baseUrl}/oauth-${provider}/start?user_id=${user.id}`;
  
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

// Feedback handling functions

async function handleFeedbackCommand(
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  await updateUser(supabase, user.id, {
    conversation_state: 'awaiting_feedback'
  });

  const message = `💬 **Send Feedback**

What would you like to tell us? You can:
• Report a bug or issue
• Request a new feature  
• Share general feedback
• Ask a question
• Give us a compliment!

Just type your message and I'll forward it to our team. We read every message and will respond if needed.

_Type /cancel to exit feedback mode._`;

  await sendTelegramMarkdownMessage(botToken, chatId, message);
}

async function handleFeedbackSubmission(
  text: string,
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  if (text.toLowerCase() === '/cancel') {
    await updateUser(supabase, user.id, {
      conversation_state: null
    });
    await sendTelegramMessage(botToken, chatId, "Feedback cancelled. How else can I help you?");
    return;
  }

  const feedbackType = classifyFeedbackType(text);
  const result = await submitFeedback(
    user.id,
    user.telegram_id,
    undefined, // No specific message ID in this flow
    {
      type: feedbackType,
      category: 'general',
      message: text,
      context: { source: 'telegram_bot', command: '/feedback' }
    },
    supabase,
    botToken
  );

  // Clear feedback state
  await updateUser(supabase, user.id, {
    conversation_state: null
  });

  if (result.success) {
    await sendTelegramMarkdownMessage(
      botToken,
      chatId,
      `✅ **Feedback Received!**

Thanks for your message! We've received your feedback and our team will review it.

${feedbackType === 'complaint' || feedbackType === 'bug_report' 
  ? "We take issues seriously and will respond if we need more information." 
  : "We really appreciate you taking the time to help us improve!"}

**Feedback ID:** \`${result.feedbackId}\``,
      {
        inline_keyboard: [[
          { text: "🏠 Main Menu", callback_data: "main_menu" }
        ]]
      }
    );
  } else {
    await sendTelegramMessage(
      botToken,
      chatId,
      "❌ Sorry, there was an error sending your feedback. Please try again later or contact support directly."
    );
  }
}

async function handleAutoFeedback(
  text: string,
  feedbackType: string,
  user: User,
  chatId: number,
  supabase: SupabaseClient,
  botToken: string
): Promise<void> {
  const result = await submitFeedback(
    user.id,
    user.telegram_id,
    undefined,
    {
      type: feedbackType as any,
      category: 'auto_detected',
      message: text,
      context: { source: 'telegram_bot', auto_detected: true }
    },
    supabase,
    botToken
  );

  if (result.success) {
    const responseMessage = feedbackType === 'complaint' 
      ? "I understand you're having an issue. I've forwarded your message to our team and we'll look into it."
      : "Thanks for the feedback! I've passed your message along to our team.";
    
    await sendTelegramMessage(
      botToken,
      chatId,
      `${responseMessage}\n\nIs there anything else I can help you with right now?`
    );
  }
}

function isFeedbackMessage(text: string): boolean {
  const lowerText = text.toLowerCase();
  const feedbackKeywords = [
    'bug', 'error', 'issue', 'problem', 'broken', 'not working',
    'suggestion', 'feature', 'request', 'would be nice',
    'love', 'great', 'awesome', 'thank you', 'thanks',
    'hate', 'terrible', 'awful', 'worst', 'sucks',
    'slow', 'fast', 'improvement', 'better'
  ];
  
  return feedbackKeywords.some(keyword => lowerText.includes(keyword)) &&
         text.split(' ').length >= 3; // At least 3 words to avoid false positives
}

function classifyFeedbackType(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('bug') || lowerText.includes('error') || lowerText.includes('broken') || lowerText.includes('not working')) {
    return 'bug_report';
  }
  
  if (lowerText.includes('feature') || lowerText.includes('request') || lowerText.includes('suggestion') || lowerText.includes('would be nice')) {
    return 'feature_request';
  }
  
  if (lowerText.includes('love') || lowerText.includes('great') || lowerText.includes('awesome') || lowerText.includes('thank')) {
    return 'compliment';
  }
  
  if (lowerText.includes('hate') || lowerText.includes('terrible') || lowerText.includes('awful') || lowerText.includes('worst') || lowerText.includes('suck')) {
    return 'complaint';
  }
  
  return 'general_feedback';
}
