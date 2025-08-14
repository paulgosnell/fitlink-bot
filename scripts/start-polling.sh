#!/bin/bash

# Temporarily disable webhook and use polling to get bot working
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI"

echo "🔧 Temporarily switching to polling mode..."

# First, delete the webhook
echo "Deleting webhook..."
response=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook")
echo "Delete webhook response: $response"

# Start the telegram-poll function locally
echo ""
echo "✅ Webhook deleted. Now you can:"
echo "1. Message the bot on Telegram"
echo "2. Run: supabase functions serve telegram-poll --env-file supabase/.env.local"
echo ""
echo "Or to use the deployed polling function, call it manually:"
echo "curl https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-poll"