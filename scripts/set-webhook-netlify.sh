#!/bin/bash

# Script to set Telegram webhook to Netlify proxy URL with secret token

# Configuration
WEBHOOK_URL="https://fitlinkbot.netlify.app/api/telegram-webhook"

# Check if BOT_TOKEN is provided as argument or environment variable
if [ -n "$1" ]; then
    BOT_TOKEN="$1"
elif [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
else
    echo "Error: Please provide bot token as argument or set TELEGRAM_BOT_TOKEN environment variable"
    echo "Usage: $0 <bot_token> [webhook_secret]"
    exit 1
fi

# Check if WEBHOOK_SECRET is provided as argument or environment variable
if [ -n "$2" ]; then
    WEBHOOK_SECRET="$2"
elif [ -n "$TELEGRAM_WEBHOOK_SECRET" ]; then
    WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET"
else
    echo "Warning: No webhook secret provided. Webhook will be set without secret validation."
    echo "To provide a secret, pass it as second argument or set TELEGRAM_WEBHOOK_SECRET environment variable"
fi

echo "🔧 Setting Telegram webhook..."
echo "Webhook URL: $WEBHOOK_URL"
echo "Secret configured: $([ -n "$WEBHOOK_SECRET" ] && echo "Yes" || echo "No")"
echo ""

# Prepare payload
if [ -n "$WEBHOOK_SECRET" ]; then
    PAYLOAD="{\"url\": \"$WEBHOOK_URL\", \"secret_token\": \"$WEBHOOK_SECRET\", \"drop_pending_updates\": true, \"allowed_updates\": [\"message\", \"callback_query\"]}"
else
    PAYLOAD="{\"url\": \"$WEBHOOK_URL\", \"drop_pending_updates\": true, \"allowed_updates\": [\"message\", \"callback_query\"]}"
fi

# Set the webhook
echo "📤 Sending webhook configuration to Telegram..."
response=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "Response: $response"
echo ""

# Verify webhook was set
echo "📍 Verifying webhook configuration..."
webhook_info=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo")

# Pretty print with jq if available, otherwise just echo
if command -v jq &> /dev/null; then
    echo "$webhook_info" | jq '.'
else
    echo "$webhook_info"
fi

# Check if webhook was set successfully
if echo "$response" | grep -q '"ok":true'; then
    echo ""
    echo "✅ Webhook set successfully!"
    echo ""
    echo "🧪 To test the webhook:"
    echo "1. Send a message to your bot"
    echo "2. Check Supabase function logs for the telegram-webhook function"
    echo "3. Verify the bot responds appropriately"
else
    echo ""
    echo "❌ Failed to set webhook. Please check the error message above."
    exit 1
fi