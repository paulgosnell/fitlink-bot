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

// Conversation states - stored in database for persistence across cold starts
// Fallback to in-memory storage if database columns don't exist yet
const userStatesFallback = new Map<number, { state: string; timestamp: number }>();


async function setUserState(userId: number, state: string, supabase: any) {
  const expiresAt = new Date(Date.now() + 600000); // 10 minutes from now
  
  console.log(`Setting user ${userId} state to: ${state}, expires: ${expiresAt.toISOString()}`);
  
  try {
    const { error } = await supabase
      .from("users")
      .update({ 
        conversation_state: state,
        state_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("telegram_id", userId);
      
    if (error) {
      console.error(`Error setting user state for ${userId}:`, error);
      // Check if error is due to missing column (migration not run yet)
      if (error.message?.includes('column "conversation_state" does not exist')) {
        console.log(`Database columns not yet created, using fallback for user ${userId}`);
        userStatesFallback.set(userId, { state, timestamp: Date.now() });
      }
    } else {
      console.log(`Successfully set user ${userId} state to: ${state}`);
    }
  } catch (error) {
    console.error(`Exception in setUserState for ${userId}:`, error);
    // Fallback to in-memory state
    userStatesFallback.set(userId, { state, timestamp: Date.now() });
  }
}

async function getUserState(userId: number, supabase: any): Promise<string | null> {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("conversation_state, state_expires_at")
      .eq("telegram_id", userId)
      .single();
    
    if (error) {
      console.error(`Error fetching user state for ${userId}:`, error);
      // Check if error is due to missing column (migration not run yet)
      if (error.message?.includes('column "conversation_state" does not exist')) {
        console.log(`Database columns not yet created for user ${userId}, using fallback`);
        const fallbackState = userStatesFallback.get(userId);
        if (fallbackState) {
          // Check if state has expired (10 minutes)
          if (Date.now() - fallbackState.timestamp > 600000) {
            userStatesFallback.delete(userId);
            return null;
          }
          return fallbackState.state;
        }
        return null;
      }
      return null;
    }
    
    if (!user) {
      console.log(`No user found for telegram_id ${userId}`);
      return null;
    }
    
    console.log(`User ${userId} state: ${user.conversation_state}, expires: ${user.state_expires_at}`);
    
    if (!user.conversation_state) return null;
    
    // Check if state has expired (10 minutes)
    if (user.state_expires_at) {
      const expiresAt = new Date(user.state_expires_at);
      if (Date.now() > expiresAt.getTime()) {
        console.log(`State expired for user ${userId}, clearing`);
        // Clear expired state
        await supabase
          .from("users")
          .update({ 
            conversation_state: null,
            state_expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("telegram_id", userId);
        return null;
      }
    }
    
    return user.conversation_state;
  } catch (error) {
    console.error(`Exception in getUserState for ${userId}:`, error);
    // Fallback to in-memory state if database fails
    const fallbackState = userStatesFallback.get(userId);
    if (fallbackState) {
      // Check if state has expired (10 minutes)
      if (Date.now() - fallbackState.timestamp > 600000) {
        userStatesFallback.delete(userId);
        return null;
      }
      return fallbackState.state;
    }
    return null;
  }
}

async function clearUserState(userId: number, supabase: any) {
  try {
    await supabase
      .from("users")
      .update({ 
        conversation_state: null,
        state_expires_at: null,
        detected_question: null,
        updated_at: new Date().toISOString()
      })
      .eq("telegram_id", userId);
  } catch (error) {
    console.error(`Error clearing user state for ${userId}:`, error);
  }
  
  // Also clear fallback state
  userStatesFallback.delete(userId);
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
  
  // CRITICAL: Ignore messages from bots to prevent infinite loops
  if (message.from?.is_bot) {
    console.log("Ignoring message from bot:", message.from.username);
    return;
  }
  
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
    const currentState = await getUserState(userId, supabase);
    console.log(`User ${userId} current state: "${currentState}", message: "${text}"`);
    
    if (currentState === "awaiting_health_question") {
      // User is in health Q&A mode - use AI directly
      console.log(`Processing health question directly for user ${userId}`);
      await handleHealthQuestion(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_feedback") {
      // User is providing feedback
      console.log(`Processing feedback from user ${userId}: "${text}"`);
      await handleFeedbackInput(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_location") {
      // User is setting location
      await handleLocationInput(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_time") {
      // User is setting briefing time
      await handleTimeInput(text, chatId, userId, supabase, botToken);
    } else if (currentState === "awaiting_goal") {
      // User is setting training goal
      await handleGoalInput(text, chatId, userId, supabase, botToken);
    } else {
      // Regular message - simple response
      console.log(`No specific state for user ${userId}, showing default response`);
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
      await setUserState(userId, "awaiting_health_question", supabase);
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
    
    case "feedback":
      console.log(`Setting feedback state for user ${userId}`);
      await setUserState(userId, "awaiting_feedback", supabase);
      
      // Verify state was set correctly
      const verifyState = await getUserState(userId, supabase);
      console.log(`Verification: User ${userId} state is now: "${verifyState}"`);
      
      console.log(`Feedback state set for user ${userId}, sending prompt message`);
      await sendTelegramMessage(
        botToken,
        chatId,
        "💬 **Send Feedback**\n\nType your message and I'll forward it to our team:\n• Report bugs or issues\n• Request features\n• Share suggestions\n• Give compliments!\n\nJust type your feedback below:"
      );
      break;
    
    case "end_health_session":
      await clearUserState(userId, supabase);
      await sendTelegramMessage(
        botToken,
        chatId,
        "👍 Health question session ended. Use /start to see available commands."
      );
      break;
    
    case "show_status":
      await handleStatusCommand(chatId, userId, supabase, botToken);
      break;
      
  }
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
      ]]
    };

    await sendTelegramMessage(
      botToken,
      chatId,
      `🧠 *Health Advice*\n\n${advice}`,
      keyboard
    );
    
    // Clear the conversation state - let user choose next action via buttons
    await clearUserState(userId, supabase);
    
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
  const parts = command.split(" ");
  const cmd = parts[0].toLowerCase();
  const parameter = parts[1]?.toLowerCase();

  switch (cmd) {
    case "/start":
      // Handle deep link parameters from OAuth success
      if (parameter === "status") {
        await handleStatusCommand(chatId, userId, supabase, botToken);
      } else {
        await handleStartCommand(chatId, userId, supabase, botToken);
      }
      break;
    case "/connect_oura":
      await handleConnectOura(chatId, userId, botToken);
      break;
    case "/connect_strava":
      await handleConnectStrava(chatId, userId, botToken);
      break;
    case "/disconnect_oura":
      await handleDisconnectOura(chatId, userId, supabase, botToken);
      break;
    case "/disconnect_strava":
      await handleDisconnectStrava(chatId, userId, supabase, botToken);
      break;
    case "/briefing":
      await handleBriefingCommand(chatId, userId, supabase, botToken);
      break;
    case "/status":
      await handleStatusCommand(chatId, userId, supabase, botToken);
      break;
    default:
      // Route to help for unknown slash commands
      if (cmd.startsWith('/')) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Unknown command. Showing /help with available options."
        );
        await handleHelpCommand(chatId, userId, supabase, botToken);
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Unknown command. Use /start to see available commands."
        );
      }
  }
}

async function handleStartCommand(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    // Get user and check connected providers
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    console.log("Looking up user for telegram_id:", userId);
    console.log("User lookup result:", { user, userError });

    let connectedProviders: string[] = [];
    if (user) {
      // Fetch all provider rows for the user and interpret activity in JS.
      // This is more robust if `is_active` is null/undefined or stored with
      // a non-boolean value in the DB (migration drift, manual edits, etc.).
      const { data: tokens, error: tokensError } = await supabase
        .from("providers")
        .select("provider, is_active")
        .eq("user_id", user.id);

      console.log("Provider lookup for user_id:", user.id);
      console.log("Providers found:", { tokens, tokensError });

      // Treat any truthy `is_active` as active; fallback to false otherwise.
      connectedProviders = (tokens || [])
        .filter((t: any) => !!t.is_active)
        .map((t: any) => t.provider);
    }

    const ouraConnected = connectedProviders.includes("oura");
    const stravaConnected = connectedProviders.includes("strava");
    const totalConnections = connectedProviders.length;

    // Generate personalized welcome message based on connections
    let welcomeSection = "";
    let setupSection = "";
    
    if (totalConnections === 0) {
      welcomeSection = `🏃‍♂️ *Welcome to Fitlink Bot!*

I help you track your health data and provide AI-powered insights from Claude.

*🚀 Get Started:*
Connect your devices below to unlock personalized health insights!`;
      
      setupSection = `*🔧 Available Connections:*
• 🟢 Oura Ring - Sleep, HRV, readiness data
• 🔴 Strava - Activity and training data`;
      
    } else if (totalConnections === 1) {
      const connectedDevice = ouraConnected ? "Oura Ring" : "Strava";
      const missingDevice = ouraConnected ? "Strava" : "Oura Ring";
      
      welcomeSection = `🏃‍♂️ *Welcome back!*

Great! You have your ${connectedDevice} connected. 

*🔗 Complete Your Setup:*
Connect your ${missingDevice} for even better insights combining sleep and activity data!`;
      
      setupSection = `*🔧 Connection Status:*
${ouraConnected ? "✅" : "🔴"} Oura Ring ${ouraConnected ? "- Connected" : "- Available to connect"}
${stravaConnected ? "✅" : "🔴"} Strava ${stravaConnected ? "- Connected" : "- Available to connect"}`;
      
    } else {
      welcomeSection = `🏃‍♂️ *Welcome back!*

Perfect! You have both Oura Ring and Strava connected.

*🎯 You're all set for:*
• Comprehensive health insights
• AI-powered training recommendations  
• Daily briefings combining sleep + activity data`;
      
      setupSection = `*🔧 Connected Devices:*
✅ Oura Ring - Sleep, HRV, readiness data
✅ Strava - Activity and training data

Use /status to manage your connections.`;
    }

    const message = `${welcomeSection}

${setupSection}

*🧠 AI Features:*
📊 Daily briefings with Claude analysis
🤖 Ask health questions anytime
💡 Smart keyword detection

*💬 How it works:*
• Type health-related words → I'll offer AI help
• Use buttons for direct AI access
• Only uses Claude when you need it (saves costs!)

Try asking: "How did I sleep?" or "Should I train today?"`;

    // Generate dynamic keyboard based on connection status
    let connectionButtons = [];
    
    if (!ouraConnected) {
      connectionButtons.push({ text: "🟢 Connect Oura", callback_data: "connect_oura" });
    }
    if (!stravaConnected) {
      connectionButtons.push({ text: "🔴 Connect Strava", callback_data: "connect_strava" });
    }
    
    // If both connected, show status button instead
    if (totalConnections === 2) {
      connectionButtons.push({ text: "📱 Device Status", callback_data: "show_status" });
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🧠 Ask Health Question", callback_data: "ask_health_question" },
          { text: "📊 Daily Briefing", callback_data: "get_briefing" }
        ],
        [
          { text: "📱 View Dashboard", web_app: { url: `https://fitlinkbot.netlify.app/dashboard.html?user_id=${userId}&t=${Date.now()}` } }
        ],
        [
          { text: "💬 Feedback", callback_data: "feedback" }
        ],
        connectionButtons
      ].filter(row => row.length > 0) // Remove empty rows
    };

    await sendTelegramMessage(botToken, chatId, message, keyboard);
    
  } catch (error) {
    console.error("Error in handleStartCommand:", error);
    
    // Fallback to basic message if database query fails
    const fallbackMessage = `🏃‍♂️ *Welcome to Fitlink Bot!*

I help you track your health data and provide AI-powered insights from Claude.

Use /status to check your device connections and get started!`;

    await sendTelegramMessage(botToken, chatId, fallbackMessage);
  }
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
    await setUserState(userId, "awaiting_location", supabase);
    
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
    await setUserState(userId, "awaiting_time", supabase);
    
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
    await setUserState(userId, "awaiting_goal", supabase);
    
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
    await clearUserState(userId, supabase);

    await sendTelegramMessage(botToken, chatId, `📍 *Location Updated!*\n\nYour location has been set to: *${location.trim()}*\n\nI'll now provide weather-optimized training recommendations based on your local conditions.`);
    
  } catch (error) {
    console.error("Error updating location:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error updating location. Please try again.");
    await clearUserState(userId, supabase);
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
    await clearUserState(userId, supabase);

    const timeString = hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`;
    
    await sendTelegramMessage(botToken, chatId, `⏰ *Briefing Time Updated!*\n\nYour daily briefing will now be sent at *${timeString}*.\n\nYou can change this anytime in Settings.`);
    
  } catch (error) {
    console.error("Error updating briefing time:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error updating briefing time. Please try again.");
    await clearUserState(userId, supabase);
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
    await clearUserState(userId, supabase);

    await sendTelegramMessage(botToken, chatId, `🎯 *Training Goal Updated!*\n\nYour training goal is now: *${goal.trim()}*\n\nI'll tailor your briefings and recommendations to help you achieve this goal.`);
    
  } catch (error) {
    console.error("Error updating training goal:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error updating training goal. Please try again.");
    await clearUserState(userId, supabase);
  }
}

async function handleFeedbackInput(feedback: string, chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id, first_name, username")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    // Store feedback in database (you might want to add a feedback table)
    console.log(`📋 FEEDBACK from ${user.first_name} (@${user.username}, ID: ${userId}): ${feedback}`);
    
    // Clear user state
    await clearUserState(userId, supabase);

    await sendTelegramMessage(
      botToken, 
      chatId, 
      "✅ **Feedback Received!**\n\nThank you for your feedback! Our team will review it and use it to improve Fitlink Bot.\n\nUse /start to return to the main menu."
    );
    
  } catch (error) {
    console.error("Error handling feedback:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error submitting feedback. Please try again.");
    await clearUserState(userId, supabase);
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

    // Get Oura provider (interpret is_active in JS)
    const { data: ouraRows } = await supabase
      .from("providers")
      .select("access_token, is_active")
      .eq("user_id", user.id)
      .eq("provider", "oura");

    const provider = (ouraRows || []).find((r: any) => !!r.is_active);

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

    // Get Strava provider (interpret is_active in JS)
    const { data: stravaRows } = await supabase
      .from("providers")
      .select("access_token, is_active")
      .eq("user_id", user.id)
      .eq("provider", "strava");

    const stravaProvider = (stravaRows || []).find((r: any) => !!r.is_active);

    if (!stravaProvider) {
      await sendTelegramMessage(botToken, chatId, "❌ Strava not connected. Please connect your Strava account first.");
      return;
    }

    // Call the data sync function
    const baseUrl = Deno.env.get("BASE_URL");
    const syncResponse = await fetch(`${baseUrl}/functions/v1/data-sync-strava`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({ user_id: user.id })
    });

    if (syncResponse.ok) {
      await sendTelegramMessage(botToken, chatId, "✅ *Strava Data Synced!*\n\nYour latest activities have been updated.\n\nYou can now use /brief to get a personalized briefing with your activity data.");
    } else {
      throw new Error(`Sync failed: ${syncResponse.status}`);
    }
    
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

    // Debug: Check all providers for this user
    const { data: allProviders } = await supabase
      .from("providers")
      .select("*")
      .eq("user_id", user.id);
    
    console.log("All providers for user:", allProviders);

    // Fetch provider rows and determine active status in JS — this helps
    // surface cases where `is_active` might be null/incorrectly typed.
    const { data: tokens } = await supabase
      .from("providers")
      .select("provider, is_active")
      .eq("user_id", user.id);

    const connectedProviders = (tokens || [])
      .filter((t: any) => !!t.is_active)
      .map((t: any) => t.provider);

    console.log("Active providers (computed):", connectedProviders);
    
    const ouraConnected = connectedProviders.includes("oura");
    const stravaConnected = connectedProviders.includes("strava");
    
    const ouraStatus = ouraConnected ? "✅ Connected" : "❌ Not connected";
    const stravaStatus = stravaConnected ? "✅ Connected" : "❌ Not connected";

    // Generate appropriate action messages based on connection status
    let actionMessages = [];
    
    if (!ouraConnected) {
      actionMessages.push("• Use /connect\\_oura to link your Oura Ring");
    } else {
      actionMessages.push("• Use /disconnect\\_oura to unlink your Oura Ring");
    }
    
    if (!stravaConnected) {
      actionMessages.push("• Use /connect\\_strava to link your Strava account");
    } else {
      actionMessages.push("• Use /disconnect\\_strava to unlink your Strava account");
    }

    const message = `📱 *Device Status*

🟢 **Oura Ring:** ${ouraStatus}
🔴 **Strava:** ${stravaStatus}

*Available Actions:*
${actionMessages.join("\n")}`;

    await sendTelegramMessage(botToken, chatId, message);
    
  } catch (error) {
    console.error("Error checking status:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error checking device status.");
  }
}
