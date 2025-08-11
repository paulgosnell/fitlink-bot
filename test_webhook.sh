#!/bin/bash

# Test the webhook directly
echo "Testing webhook endpoint..."

curl -X POST "https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram/fitlink_webhook_secret_2025" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {
        "id": 12345,
        "first_name": "Test",
        "username": "testuser"
      },
      "chat": {
        "id": 12345,
        "type": "private"
      },
      "date": 1640995200,
      "text": "/start"
    }
  }'

echo ""
echo "Check Supabase logs for any errors."
