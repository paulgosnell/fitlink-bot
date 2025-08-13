import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: any
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

// Conversation states
const userStates = new Map<number, { state: string; timestamp: number }>();

// Health-related keywords for detection
const HEALTH_KEYWORDS = [
  'sleep', 'tired', 'energy', 'workout', 'exercise', 'training', 'recovery', 'heart rate',
  'calories', 'steps', 'activity', 'fitness', 'health', 'nutrition', 'diet', 'weight',
  'stress', 'resting', 'hrv', 'readiness', 'sore', 'pain', 'fatigue', 'motivation',
  'goal', 'performance', 'endurance', 'strength', 'cardio', 'running', 'cycling',
  'swimming', 'zone', 'tempo', 'interval', 'rest day', 'active recovery'
];

function isHealthRelated(text: string): boolean {
  const lowercaseText = text.toLowerCase();
  return HEALTH_KEYWORDS.some(keyword => lowercaseText.includes(keyword)) ||
         lowercaseText.includes('how') && (lowercaseText.includes('feel') || lowercaseText.includes('sleep') || lowercaseText.includes('train')) ||
         lowercaseText.includes('should i') || lowercaseText.includes('what') && lowercaseText.includes('recommend');
}

function setUserState(userId: number, state: string) {
  userStates.set(userId, { state, timestamp: Date.now() });
}

function getUserState(userId: number): string | null {
  const userState = userStates.get(userId);
  if (!userState) return null;
  
  // Clear state after 10 minutes
  if (Date.now() - userState.timestamp > 600000) {
    userStates.delete(userId);
    return null;
  }
  
  return userState.state;
}

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  supabase: any,
  botToken: string
): Promise<void> {
  // Handle callback queries (button presses)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, supabase, botToken);
    return;
  }

  if (!update.message) return;

  const { message } = update;
  const userId = message.from.id;
  const chatId = message.chat.id;
  const text = message.text || "";

  console.log(`Received message from ${userId}: ${text}`);

  // Ensure user exists
  await supabase
    .from("users")
    .upsert({
      telegram_id: userId,
      username: message.from.username,
      first_name: message.from.first_name,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "telegram_id"
    });

  // Handle commands
  if (text.startsWith("/")) {
    await handleCommand(text, chatId, userId, supabase, botToken);
  } else {
    // Check conversation state
    const currentState = getUserState(userId);
    
    if (currentState === "awaiting_health_question") {
      // User is in health Q&A mode - use AI
      await handleHealthQuestion(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_location") {
      // User is setting location
      await handleLocationInput(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_time") {
      // User is setting briefing time
      await handleTimeInput(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_goal") {
      // User is setting training goal
      await handleGoalInput(text, chatId, userId, supabase, botToken);
    } else if (isHealthRelated(text)) {
      // Detected health-related message - offer AI assistance
      await offerHealthAssistance(text, chatId, userId, botToken);
    } else {
      // Regular message - simple response
      const keyboard = {
        inline_keyboard: [[
          { text: "🧠 Ask Health Question", callback_data: "ask_health_question" },
          { text: "📊 Daily Briefing", callback_data: "get_briefing" }
        ]]
      };
      
      await sendTelegramMessage(
        botToken,
        chatId,
        "Hi! I'm your Fitlink Bot. I can help with health questions or generate your daily briefing:",
        keyboard
      );
    }
  }
}

async function handleCallbackQuery(
  callbackQuery: any,
  supabase: any,
  botToken: string
): Promise<void> {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Answer the callback query to remove loading state
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });

  switch (data) {
    case "ask_health_question":
      setUserState(userId, "awaiting_health_question");
      await sendTelegramMessage(
        botToken,
        chatId,
        "🧠 *Health Question Mode Activated*\n\nAsk me anything about your health, fitness, or training! I'll analyze your data and provide personalized advice.\n\n_Type your question below:_"
      );
      break;
    
    case "get_briefing":
      await handleBriefingCommand(chatId, userId, supabase, botToken);
      break;
    
    case "connect_oura":
      await handleConnectOura(chatId, userId, botToken);
      break;
    
    case "connect_strava":
      await handleConnectStrava(chatId, userId, botToken);
      break;
    
    case "disconnect_strava":
      await handleDisconnectStrava(chatId, userId, supabase, botToken);
      break;
    
    case "disconnect_oura":
      await handleDisconnectOura(chatId, userId, supabase, botToken);
      break;
    
    case "set_location":
      await handleSetLocation(chatId, userId, supabase, botToken);
      break;
    
    case "set_time":
      await handleSetTime(chatId, userId, supabase, botToken);
      break;
    
    case "set_goal":
      await handleSetGoal(chatId, userId, supabase, botToken);
      break;
    
    case "pause":
      await handlePause(chatId, userId, supabase, botToken);
      break;
    
    case "resume":
      await handleResume(chatId, userId, supabase, botToken);
      break;
    
    case "sync_oura":
      await handleSyncOura(chatId, userId, supabase, botToken);
      break;
    
    case "sync_strava":
      await handleSyncStrava(chatId, userId, supabase, botToken);
      break;
    
    case "end_health_session":
      userStates.delete(userId);
      await sendTelegramMessage(
        botToken,
        chatId,
        "👍 Health question session ended. Use /start to see available commands."
      );
      break;
  }
}

async function offerHealthAssistance(
  text: string,
  chatId: number,
  userId: number,
  botToken: string
): Promise<void> {
  const keyboard = {
    inline_keyboard: [[
      { text: "🧠 Yes, get AI advice", callback_data: "ask_health_question" },
      { text: "📊 Daily briefing instead", callback_data: "get_briefing" }
    ]]
  };
  
  await sendTelegramMessage(
    botToken,
    chatId,
    `I noticed you mentioned something health-related! 🏃‍♂️\n\nWould you like me to analyze your data and provide personalized advice about: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    keyboard
  );
}

async function handleHealthQuestion(
  question: string,
  chatId: number,
  userId: number,
  supabase: any,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🔄 Analyzing your data and generating personalized advice...");
    
    // Import AI module dynamically
    const { generateHealthAdvice } = await import("./ai.ts");
    
    // Get user's recent data
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Get recent health data for context
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const { data: recentSleep } = await supabase
      .from("sleep_data")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", yesterday)
      .order("date", { ascending: false })
      .limit(3);

    const { data: recentActivity } = await supabase
      .from("activity_data")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", yesterday)
      .order("date", { ascending: false })
      .limit(5);

    // Generate AI response
    const advice = await generateHealthAdvice(question, {
      sleep: recentSleep || [],
      activities: recentActivity || [],
      userQuestion: question
    });
    
    // Provide options for follow-up
    const keyboard = {
      inline_keyboard: [[
        { text: "🔄 Ask another question", callback_data: "ask_health_question" },
        { text: "📊 Get daily briefing", callback_data: "get_briefing" }
      ], [
        { text: "✅ End session", callback_data: "end_health_session" }
      ]]
    };

    await sendTelegramMessage(
      botToken,
      chatId,
      `🧠 *Health Advice*\n\n${advice}`,
      keyboard
    );
    
    // Keep user in Q&A state for follow-ups
    setUserState(userId, "awaiting_health_question");
    
  } catch (error) {
    console.error("Error handling health question:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "❌ Sorry, I couldn't process your health question right now. Please try again later."
    );
  }
}

async function handleCommand(
  command: string,
  chatId: number,
  userId: number,
  supabase: any,
  botToken: string
): Promise<void> {
  const cmd = command.split(" ")[0].toLowerCase();

  switch (cmd) {
    case "/start":
      await handleStartCommand(chatId, botToken);
      break;
    case "/connect_oura":
      await handleConnectOura(chatId, userId, botToken);
      break;
    case "/connect_strava":
      await handleConnectStrava(chatId, userId, botToken);
      break;
    case "/briefing":
      await handleBriefingCommand(chatId, userId, supabase, botToken);
      break;
    case "/status":
      await handleStatusCommand(chatId, userId, supabase, botToken);
      break;
    default:
      await sendTelegramMessage(
        botToken,
        chatId,
        "Unknown command. Use /start to see available commands."
      );
  }
}

async function handleStartCommand(chatId: number, botToken: string): Promise<void> {
  const message = `🏃‍♂️ *Welcome to Fitlink Bot!*

I help you track your health data and provide AI-powered insights from Claude.

*🔧 Setup Commands:*
/connect\\_oura - Connect your Oura Ring
/connect\\_strava - Connect your Strava account  
/status - Check your connected devices

*🧠 AI Features:*
📊 Daily briefings with Claude analysis
🤖 Ask health questions anytime
💡 Smart keyword detection

*💬 How it works:*
• Type health-related words → I'll offer AI help
• Use buttons for direct AI access
• Only uses Claude when you need it (saves costs!)

Try asking: "How did I sleep?" or "Should I train today?"`;

  const keyboard = {
    inline_keyboard: [[
      { text: "🧠 Ask Health Question", callback_data: "ask_health_question" },
      { text: "📊 Daily Briefing", callback_data: "get_briefing" }
    ], [
      { text: "🟢 Connect Oura", callback_data: "connect_oura" },
      { text: "🔴 Connect Strava", callback_data: "connect_strava" }
    ]]
  };

  await sendTelegramMessage(botToken, chatId, message, keyboard);
}

async function handleConnectOura(chatId: number, userId: number, botToken: string): Promise<void> {
  const ouraClientId = Deno.env.get("OURA_CLIENT_ID");
  const baseUrl = "https://fitlinkbot.netlify.app"; // Use Netlify proxy for OAuth flows
  
  const authUrl = `${baseUrl}/oauth-oura/start?user_id=${userId}`;
  
  const message = `🟢 *Connect Your Oura Ring*

Click the button below to authorize Fitlink Bot to access your Oura data:`;

  const keyboard = {
    inline_keyboard: [[
      {
        text: "Connect Oura Ring",
        url: authUrl
      }
    ]]
  };

  await sendTelegramMessage(botToken, chatId, message, keyboard);
}

async function handleConnectStrava(chatId: number, userId: number, botToken: string): Promise<void> {
  const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
  const baseUrl = "https://fitlinkbot.netlify.app"; // Use Netlify proxy for OAuth flows
  
  const authUrl = `${baseUrl}/oauth-strava/start?user_id=${userId}`;
  
  const message = `🔴 *Connect Your Strava Account*

Click the button below to authorize Fitlink Bot to access your Strava activities:`;

  const keyboard = {
    inline_keyboard: [[
      {
        text: "Connect Strava",
        url: authUrl
      }
    ]]
  };

  await sendTelegramMessage(botToken, chatId, message, keyboard);
}

async function handleDisconnectStrava(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Deactivate the Strava provider
    await supabase
      .from("providers")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("provider", "strava");

    await sendTelegramMessage(botToken, chatId, "🔌 *Strava Disconnected*\n\nYour Strava account has been disconnected from Fitlink Bot. You can reconnect anytime using /connect_strava.");
    
  } catch (error) {
    console.error("Error disconnecting Strava:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error disconnecting Strava. Please try again.");
  }
}

async function handleDisconnectOura(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Deactivate the Oura provider
    await supabase
      .from("providers")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("provider", "oura");

    await sendTelegramMessage(botToken, chatId, "🔌 *Oura Ring Disconnected*\n\nYour Oura Ring has been disconnected from Fitlink Bot. You can reconnect anytime using /connect_oura.");
    
  } catch (error) {
    console.error("Error disconnecting Oura:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error disconnecting Oura. Please try again.");
  }
}

async function handleSetLocation(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Set user state to await location input
    setUserState(userId, "awaiting_location");
    
    await sendTelegramMessage(botToken, chatId, "📍 *Set Your Location*\n\nPlease send me your city name (e.g., 'London', 'New York', 'Tokyo').\n\nThis helps me provide weather-optimized training recommendations.");
    
  } catch (error) {
    console.error("Error setting location:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error setting location. Please try again.");
  }
}

async function handleSetTime(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Set user state to await time input
    setUserState(userId, "awaiting_time");
    
    await sendTelegramMessage(botToken, chatId, "⏰ *Set Briefing Time*\n\nPlease send me the hour (0-23) when you'd like to receive your daily briefing.\n\nFor example: '7' for 7:00 AM, '18' for 6:00 PM.");
    
  } catch (error) {
    console.error("Error setting time:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error setting time. Please try again.");
  }
}

async function handleSetGoal(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Set user state to await goal input
    setUserState(userId, "awaiting_goal");
    
    await sendTelegramMessage(botToken, chatId, "🎯 *Set Training Goal*\n\nPlease send me your training goal. Examples:\n\n• General fitness\n• Weight loss\n• Muscle building\n• Endurance training\n• Strength training\n• Recovery focus");
    
  } catch (error) {
    console.error("Error setting goal:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error setting goal. Please try again.");
  }
}

async function handlePause(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Pause briefings for 7 days
    const pauseUntil = new Date();
    pauseUntil.setDate(pauseUntil.getDate() + 7);

    await supabase
      .from("users")
      .update({ 
        paused_until: pauseUntil.toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    await sendTelegramMessage(botToken, chatId, "⏸️ *Daily Briefings Paused*\n\nYour daily briefings have been paused for 7 days.\n\nYou can still use /brief for on-demand briefings.\nUse /resume to restart daily briefings anytime.");
    
  } catch (error) {
    console.error("Error pausing briefings:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error pausing briefings. Please try again.");
  }
}

async function handleResume(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Resume briefings
    await supabase
      .from("users")
      .update({ 
        paused_until: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    await sendTelegramMessage(botToken, chatId, `▶️ *Daily Briefings Resumed!*\n\nYou'll receive your next briefing tomorrow at ${user.briefing_hour || 7}:00.`);
    
  } catch (error) {
    console.error("Error resuming briefings:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error resuming briefings. Please try again.");
  }
}

async function handleLocationInput(location: string, chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Update user location
    await supabase
      .from("users")
      .update({ 
        city: location.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    // Clear user state
    userStates.delete(userId);

    await sendTelegramMessage(botToken, chatId, `📍 *Location Updated!*\n\nYour location has been set to: *${location.trim()}*\n\nI'll now provide weather-optimized training recommendations based on your local conditions.`);
    
  } catch (error) {
    console.error("Error updating location:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error updating location. Please try again.");
    userStates.delete(userId);
  }
}

async function handleTimeInput(timeInput: string, chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const hour = parseInt(timeInput.trim());
    
    if (isNaN(hour) || hour < 0 || hour > 23) {
      await sendTelegramMessage(botToken, chatId, "❌ *Invalid Time*\n\nPlease enter a number between 0 and 23.\n\nFor example:\n• '7' for 7:00 AM\n• '18' for 6:00 PM");
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Update user briefing hour
    await supabase
      .from("users")
      .update({ 
        briefing_hour: hour,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    // Clear user state
    userStates.delete(userId);

    const timeString = hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`;
    
    await sendTelegramMessage(botToken, chatId, `⏰ *Briefing Time Updated!*\n\nYour daily briefing will now be sent at *${timeString}*.\n\nYou can change this anytime in Settings.`);
    
  } catch (error) {
    console.error("Error updating briefing time:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error updating briefing time. Please try again.");
    userStates.delete(userId);
  }
}

async function handleGoalInput(goal: string, chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Update user training goal
    await supabase
      .from("users")
      .update({ 
        training_goal: goal.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    // Clear user state
    userStates.delete(userId);

    await sendTelegramMessage(botToken, chatId, `🎯 *Training Goal Updated!*\n\nYour training goal is now: *${goal.trim()}*\n\nI'll tailor your briefings and recommendations to help you achieve this goal.`);
    
  } catch (error) {
    console.error("Error updating training goal:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error updating training goal. Please try again.");
    userStates.delete(userId);
  }
}

async function handleSyncOura(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🔄 *Syncing Oura Data*\n\nFetching your latest sleep and readiness data...");
    
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Get Oura provider
    const { data: provider } = await supabase
      .from("providers")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "oura")
      .eq("is_active", true)
      .single();

    if (!provider) {
      await sendTelegramMessage(botToken, chatId, "❌ Oura not connected. Please connect your Oura Ring first.");
      return;
    }

    // Call the data sync function
    const baseUrl = Deno.env.get("BASE_URL");
    const syncResponse = await fetch(`${baseUrl}/functions/v1/data-sync-oura`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      }
    });

    if (syncResponse.ok) {
      await sendTelegramMessage(botToken, chatId, "✅ *Oura Data Synced!*\n\nYour latest sleep and readiness data has been updated.\n\nYou can now use /brief to get a personalized briefing with your Oura data.");
    } else {
      throw new Error(`Sync failed: ${syncResponse.status}`);
    }
    
  } catch (error) {
    console.error("Error syncing Oura data:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error syncing Oura data. Please try again later.");
  }
}

async function handleSyncStrava(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🔄 *Syncing Strava Data*\n\nFetching your latest training activities...");
    
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Get Strava provider
    const { data: provider } = await supabase
      .from("providers")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "strava")
      .eq("is_active", true)
      .single();

    if (!provider) {
      await sendTelegramMessage(botToken, chatId, "❌ Strava not connected. Please connect your Strava account first.");
      return;
    }

    // For now, just acknowledge the sync request
    // TODO: Implement Strava data sync function
    await sendTelegramMessage(botToken, chatId, "🔄 *Strava Sync Requested*\n\nStrava data synchronization is coming soon!\n\nFor now, your connected activities will be available in future briefings.");
    
  } catch (error) {
    console.error("Error syncing Strava data:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error syncing Strava data. Please try again later.");
  }
}

async function handleBriefingCommand(
  chatId: number,
  userId: number,
  supabase: any,
  botToken: string
): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, "🔄 Generating your daily briefing...");
    
    // Import AI module dynamically
    const { generateHealthBriefing } = await import("./ai.ts");
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch user's data
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Fetch sleep data
    const { data: sleepData } = await supabase
      .from("oura_sleep")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    // Fetch activity data
    const { data: activityData } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today);

    // Fetch weather data
    const { data: weatherData } = await supabase
      .from("env_daily")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    // Prepare data for AI
    const healthData = {
      date: today,
      sleep: sleepData ? {
        duration: sleepData.duration,
        efficiency: sleepData.efficiency,
        score: sleepData.score,
        bedtime: sleepData.bedtime_start,
      } : undefined,
      activity: activityData || [],
      weather: weatherData ? {
        temperature: weatherData.temperature,
        condition: weatherData.condition,
        humidity: weatherData.humidity,
      } : undefined,
    };

    // Generate briefing
    const briefing = await generateHealthBriefing(healthData);
    
    // Save briefing
    await supabase
      .from("briefings")
      .upsert({
        user_id: user.id,
        date: today,
        content: briefing,
        data_sources: healthData,
      }, {
        onConflict: "user_id,date"
      });

    await sendTelegramMessage(botToken, chatId, `📊 *Your Daily Health Briefing*\n\n${briefing}`);
    
  } catch (error) {
    console.error("Error generating briefing:", error);
    await sendTelegramMessage(
      botToken,
      chatId,
      "❌ Sorry, I couldn't generate your briefing right now. Please try again later."
    );
  }
}

async function handleStatusCommand(
  chatId: number,
  userId: number,
  supabase: any,
  botToken: string
): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    const { data: tokens } = await supabase
      .from("providers")
      .select("provider")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const connectedProviders = tokens?.map(t => t.provider) || [];
    
    const ouraStatus = connectedProviders.includes("oura") ? "✅ Connected" : "❌ Not connected";
    const stravaStatus = connectedProviders.includes("strava") ? "✅ Connected" : "❌ Not connected";

    const message = `📱 *Device Status*

🟢 **Oura Ring:** ${ouraStatus}
🔴 **Strava:** ${stravaStatus}

Use /connect\\_oura or /connect\\_strava to link your accounts.`;

    await sendTelegramMessage(botToken, chatId, message);
    
  } catch (error) {
    console.error("Error checking status:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error checking device status.");
  }
}
