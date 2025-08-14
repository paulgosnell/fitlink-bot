#!/bin/bash

# Test script to verify Telegram webhook endpoint

WEBHOOK_URL="https://fitlinkbot.netlify.app/api/telegram-webhook"

echo "🧪 Testing Telegram webhook endpoint..."
echo "URL: $WEBHOOK_URL"
echo ""

# Test GET request (should return 405 or similar)
echo "1️⃣ Testing GET request (expecting 405 Method Not Allowed):"
curl -s -o /dev/null -w "Status: %{http_code}\n" -X GET "$WEBHOOK_URL"
echo ""

# Test POST without secret (should return 401 if secret is configured in Supabase)
echo "2️⃣ Testing POST without secret token:"
response=$(curl -s -w "\nStatus: %{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123, "message": {"text": "test"}}')
echo "$response"
echo ""

# Test POST with secret (if provided)
if [ -n "$1" ]; then
    echo "3️⃣ Testing POST with secret token:"
    response=$(curl -s -w "\nStatus: %{http_code}" -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -H "X-Telegram-Bot-Api-Secret-Token: $1" \
      -d '{"update_id": 123, "message": {"text": "test"}}')
    echo "$response"
    echo ""
fi

# Test health endpoint
echo "4️⃣ Testing health endpoint:"
curl -s "$WEBHOOK_URL/health" || curl -s "https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook/health"
echo ""
echo ""

echo "✅ Tests complete. Check the responses above to verify:"
echo "   - GET should return 405 (Method Not Allowed)"
echo "   - POST without secret should return 401 if TELEGRAM_WEBHOOK_SECRET is set, or 200 if not"
echo "   - POST with correct secret should return 200"
echo "   - Health endpoint should return {\"status\":\"ok\"}"