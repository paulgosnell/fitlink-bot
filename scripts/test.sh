#!/bin/bash

# Test script for local development

echo "🧪 Testing Fitlink Bot locally..."

# Check if Supabase is running
if ! supabase status | grep -q "API URL"; then
    echo "❌ Supabase not running. Run: supabase start"
    exit 1
fi

# Get local URLs
API_URL=$(supabase status | grep "API URL" | awk '{print $3}')
ANON_KEY=$(supabase status | grep "anon key" | awk '{print $3}')

echo "🌐 Local API URL: $API_URL"
echo ""

# Test Telegram webhook
echo "📞 Testing Telegram webhook..."
curl -X POST "$API_URL/functions/v1/telegram/webhook/test-secret" \
     -H "Content-Type: application/json" \
     -d '{
       "update_id": 1,
       "message": {
         "message_id": 1,
         "from": {
           "id": 123456789,
           "is_bot": false,
           "first_name": "Test",
           "username": "testuser"
         },
         "chat": {
           "id": 123456789,
           "first_name": "Test",
           "username": "testuser",
           "type": "private"
         },
         "date": 1234567890,
         "text": "/start"
       }
     }'
echo ""

# Test OAuth URLs
echo "🔗 OAuth URLs:"
echo "Oura: $API_URL/functions/v1/oauth/oura/start?user_id=test-user-id"
echo "Strava: $API_URL/functions/v1/oauth/strava/start?user_id=test-user-id"
echo ""

# Test health endpoints
echo "💓 Testing health endpoints..."
curl -s "$API_URL/functions/v1/telegram/health" | jq .
echo ""

echo "✅ Basic tests complete!"
echo ""
echo "💡 To test with a real Telegram bot:"
echo "1. Create a bot with @BotFather"
echo "2. Set TELEGRAM_BOT_TOKEN in .env.local"
echo "3. Set webhook: curl -X POST \"https://api.telegram.org/bot<TOKEN>/setWebhook\" -d \"url=$API_URL/functions/v1/telegram/webhook/your-secret\""
echo "4. Message your bot /start"
