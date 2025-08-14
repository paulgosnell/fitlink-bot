#!/bin/bash

# Set webhook for Telegram bot to Supabase Edge Function
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI"
WEBHOOK_URL="https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook"
WEBHOOK_SECRET="your-webhook-secret" # This should match what's in your Supabase environment

echo "🔧 Setting webhook to Supabase Edge Function..."
echo "Webhook URL: $WEBHOOK_URL"

# Set the webhook
response=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\", \"secret_token\": \"$WEBHOOK_SECRET\"}")

echo "Response: $response"

# Verify webhook was set
echo ""
echo "📍 Verifying webhook configuration..."
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq '.'