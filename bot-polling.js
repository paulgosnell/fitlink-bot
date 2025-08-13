#!/usr/bin/env node

const BOT_TOKEN = "8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI";
let lastUpdateId = 0;

console.log("🤖 Fitlink Bot - Polling Mode Started");
console.log("Bot will now respond to messages in real-time!");

const startMessage = `🏃‍♂️ *Welcome to Fitlink Bot!*

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

async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  return response.json();
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || "";
  const username = message.from.username || message.from.first_name;
  
  console.log(`📩 ${username}: ${text}`);
  
  if (text === "/start") {
    await sendMessage(chatId, startMessage, keyboard);
    console.log(`✅ Sent /start response to ${username}`);
  } else if (text === "/status") {
    await sendMessage(chatId, "📱 *Device Status*\n\n🟢 **Oura Ring:** ❌ Not connected\n🔴 **Strava:** ❌ Not connected\n\nUse the buttons below to connect your devices!", keyboard);
    console.log(`✅ Sent /status response to ${username}`);
  } else if (text.includes("sleep") || text.includes("tired") || text.includes("workout")) {
    await sendMessage(chatId, `I noticed you mentioned something health-related! 🏃‍♂️\n\nI would analyze your data and provide personalized advice, but I need to be connected to your devices first.\n\nUse /start to see connection options.`);
    console.log(`✅ Detected health keyword from ${username}`);
  } else {
    await sendMessage(chatId, "Hi! I'm your Fitlink Bot. Use /start to see all available commands and features!");
    console.log(`✅ Sent general response to ${username}`);
  }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const username = callbackQuery.from.username || callbackQuery.from.first_name;
  
  console.log(`🔘 ${username} clicked: ${data}`);
  
  // Answer the callback query
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id })
  });
  
  switch (data) {
    case "ask_health_question":
      await sendMessage(chatId, "🧠 *Health Question Mode*\n\nI would analyze your health data and provide AI-powered advice, but I need to be connected to your Oura Ring and Strava first!\n\nOnce connected, you'll be able to ask questions like:\n• \"How did I sleep last night?\"\n• \"Should I train today?\"\n• \"What's my recovery status?\"\n\nUse /start to connect your devices.");
      break;
    case "get_briefing":
      await sendMessage(chatId, "📊 *Daily Briefing*\n\nI would generate a personalized daily briefing with your sleep, activity, and weather data, but I need to be connected to your devices first!\n\nOnce connected, your briefings will include:\n• Sleep quality analysis\n• Training recommendations\n• Recovery insights\n• Weather-optimized suggestions\n\nUse /start to connect your devices.");
      break;
    case "connect_oura":
      await sendMessage(chatId, "🟢 *Connect Oura Ring*\n\nOura Ring integration is coming soon! This will provide:\n• Sleep quality analysis\n• HRV and readiness scores\n• Recovery recommendations\n• Temperature trend monitoring\n\nStay tuned for updates!");
      break;
    case "connect_strava":
      await sendMessage(chatId, "🔴 *Connect Strava*\n\nStrava integration is coming soon! This will provide:\n• Training load analysis\n• Activity-based recommendations\n• Performance insights\n• Recovery planning\n\nStay tuned for updates!");
      break;
  }
  
  console.log(`✅ Handled callback: ${data}`);
}

async function poll() {
  try {
    const offset = lastUpdateId ? lastUpdateId + 1 : 0;
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`);
    const data = await response.json();
    
    if (!data.ok) {
      console.error("❌ Telegram API error:", data);
      return;
    }
    
    for (const update of data.result) {
      lastUpdateId = update.update_id;
      
      if (update.message) {
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    }
  } catch (error) {
    console.error("❌ Polling error:", error);
  }
}

// Start polling
console.log("Starting polling loop...");
setInterval(poll, 1000); // Poll every second

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bot polling stopped');
  process.exit(0);
});