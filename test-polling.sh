#!/bin/bash

# Simple test script to see if we can communicate with the bot directly
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI"

echo "🤖 Testing Telegram bot without webhooks..."
echo ""

# Get updates (polling)
echo "Getting recent messages..."
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getUpdates?limit=1" | jq '.'

echo ""
echo "✅ Test complete! If you see messages above, the bot token works."
echo "🔧 The issue is with Supabase Edge Function authentication."
echo ""
echo "SOLUTION: Try messaging the bot now - I'll set up a simpler webhook alternative."
