# Telegram Webhook Setup Guide

## Overview
This guide explains how to set up the Telegram webhook for the Fitlink bot with proper secret validation.

## Architecture
1. Telegram sends webhook requests to: `https://fitlinkbot.netlify.app/api/telegram-webhook`
2. Netlify Edge Function proxies the request to Supabase Edge Function
3. Secret validation is performed using the `X-Telegram-Bot-Api-Secret-Token` header

## Prerequisites
- `TELEGRAM_BOT_TOKEN` environment variable set in Supabase
- `TELEGRAM_WEBHOOK_SECRET` environment variable set in Supabase (recommended)
- Deployed Supabase function with the updated code
- Netlify Edge Function deployed and running

## Setting the Webhook

### Option 1: Using the provided script (recommended)
```bash
# With environment variables
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_WEBHOOK_SECRET="your-secret-token"
./scripts/set-webhook-netlify.sh

# Or with arguments
./scripts/set-webhook-netlify.sh "your-bot-token" "your-secret-token"
```

### Option 2: Using the Supabase function endpoint
```bash
curl -X POST https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook/set-webhook \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Option 3: Manual Telegram API call
```bash
BOT_TOKEN="your-bot-token"
WEBHOOK_SECRET="your-secret-token"

curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://fitlinkbot.netlify.app/api/telegram-webhook",
    "secret_token": "'$WEBHOOK_SECRET'",
    "drop_pending_updates": true,
    "allowed_updates": ["message", "callback_query"]
  }'
```

## Testing the Webhook

### 1. Test endpoint availability
```bash
./scripts/test-webhook-endpoint.sh [optional-secret-token]
```

### 2. Send a test message to your bot
- Open Telegram and send `/start` to your bot
- Check Supabase function logs for the telegram-webhook function
- Verify the bot responds appropriately

### 3. Verify webhook info
```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq
```

Expected output should show:
- `url`: "https://fitlinkbot.netlify.app/api/telegram-webhook"
- `has_custom_certificate`: false
- `pending_update_count`: 0 (or low number)
- If secret is configured, it won't be shown but will be active

## Security Considerations

1. **Secret Token**: Always use a strong, random secret token for production
2. **Environment Variables**: Never commit secrets to the repository
3. **Header Validation**: The webhook validates the `X-Telegram-Bot-Api-Secret-Token` header
4. **HTTPS Only**: The webhook URL must use HTTPS

## Troubleshooting

### Webhook not receiving updates
1. Check webhook info: `curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"`
2. Look for `last_error_message` in the response
3. Verify the URL is correctly set to the Netlify proxy URL
4. Check Netlify function logs for any errors

### 401 Unauthorized errors
1. Ensure `TELEGRAM_WEBHOOK_SECRET` is set in Supabase environment
2. Verify the secret token matches when setting the webhook
3. Check that Netlify Edge Function forwards the header correctly

### 200 OK but bot doesn't respond
1. Check Supabase function logs for errors
2. Verify `TELEGRAM_BOT_TOKEN` is correctly set
3. Ensure the bot has permission to send messages in the chat

## Deployment Checklist
- [ ] Deploy updated Supabase function with secret validation
- [ ] Deploy updated Netlify Edge Function with header forwarding
- [ ] Set `TELEGRAM_WEBHOOK_SECRET` in Supabase environment
- [ ] Run webhook setup script with secret token
- [ ] Test webhook endpoint returns 200 for valid requests
- [ ] Verify bot responds to messages