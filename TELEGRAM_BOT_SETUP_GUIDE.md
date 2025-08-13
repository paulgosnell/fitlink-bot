# Telegram Bot Setup Guide - Complete Working Solution

**Status:** ✅ WORKING - Bot responds instantly to all messages  
**Last Updated:** 2025-01-13  
**Issue History:** Broken 3+ times, took days to fix each time

## 🚨 CRITICAL SUCCESS FACTORS

### 1. The Root Problem
**Supabase Edge Functions require `Authorization: Bearer <token>` header**  
**Telegram webhooks CANNOT send custom headers**  
**Result:** Direct webhook to Supabase = 401 Unauthorized always

### 2. The Working Solution
**Netlify Edge Functions act as authentication proxy between Telegram and Supabase**

```
Telegram → Netlify Proxy (adds auth) → Supabase Edge Function → Bot Logic
```

## 📋 WORKING CONFIGURATION

### Bot Information
- **Bot Token:** `8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI`  
- **Bot Username:** `@the_fitlink_bot`
- **Webhook URL:** `https://fitlinkbot.netlify.app/api/telegram-webhook`

### Required Files & Configuration

#### 1. Netlify Edge Function Proxy (`/netlify/edge-functions/telegram-proxy.js`)
```javascript
export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.text();
    
    // CRITICAL: Use correct anon key - get from Supabase dashboard
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4OTQ1MTcsImV4cCI6MjA3MDQ3MDUxN30.brHKkPojybFjpW9kCbPTaRsGWlCmjrGEYmpDgCStSGo';
    
    // Forward to Supabase with auth header
    const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: body
    });
    
    const responseData = await response.text();
    return new Response(responseData, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/telegram-webhook"
};
```

#### 2. Netlify Configuration (`netlify.toml`)
```toml
[build]
  publish = "web/public"
  command = "echo 'Static site - no build needed'"
  edge_functions = "netlify/edge-functions"

[build.environment]
  NODE_VERSION = "18"
```

#### 3. Supabase Function Config (`/supabase/functions/telegram-webhook/config.toml`)
```toml
name = "telegram-webhook"
verify_jwt = false

[routes]
include = [
  "/telegram/webhook/*",
  "/telegram-webhook/telegram/webhook/*", 
  "/telegram-webhook/healthz",
  "/healthz"
]
```

## 🔧 DEPLOYMENT COMMANDS

### 1. Deploy Netlify Proxy
```bash
# Add and commit proxy files
git add netlify/edge-functions/telegram-proxy.js netlify.toml
git commit -m "Add Telegram webhook proxy for Supabase auth"
git push origin main
```

### 2. Set Telegram Webhook
```bash
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI"
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://fitlinkbot.netlify.app/api/telegram-webhook"}'
```

### 3. Verify Webhook Status
```bash
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo326OvVlyPI"
curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq '.'
```

**Expected Result:**
```json
{
  "ok": true,
  "result": {
    "url": "https://fitlinkbot.netlify.app/api/telegram-webhook",
    "pending_update_count": 0,
    "max_connections": 40
  }
}
```

## 🚨 CRITICAL FAILURE POINTS

### ❌ Wrong Supabase Anon Key
**Symptom:** `{"code":401,"message":"Invalid JWT"}`  
**Fix:** Get current key from https://supabase.com/dashboard/project/umixefoxgjmdlvvtfnmr/settings/api

### ❌ Missing Authorization Header
**Symptom:** `{"code":401,"message":"Missing authorization header"}`  
**Fix:** Ensure proxy adds `Authorization: Bearer ${SUPABASE_ANON_KEY}` header

### ❌ Webhook URL Mismatch
**Symptom:** `Wrong response from the webhook: 404 Not Found`  
**Fix:** Ensure webhook URL exactly matches deployed proxy endpoint

### ❌ Supabase Function Not Deployed
**Symptom:** `Function not found`  
**Fix:** Deploy Supabase functions: `supabase functions deploy telegram-webhook`

## 🧪 TESTING PROCEDURES

### 1. Test Proxy Endpoint
```bash
curl -X POST "https://fitlinkbot.netlify.app/api/telegram-webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```
**Expected:** `{"ok":true}`

### 2. Test Direct Supabase (with auth)
```bash
curl -X POST "https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ANON_KEY_HERE" \
  -d '{"test": "data"}'
```
**Expected:** `{"ok":true}`

### 3. Test Bot Response
Send `/start` to `@the_fitlink_bot`  
**Expected:** Immediate response with welcome message

### 4. Manual Message Processing (Emergency Fallback)
If webhook fails, process messages manually:
```bash
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI"
node -e "
const BOT_TOKEN = '$BOT_TOKEN';
// Manual processing script here
"
```

## 📈 MONITORING & ALERTS

### Health Check Endpoints
- **Webhook:** `https://fitlinkbot.netlify.app/api/telegram-webhook` (POST with test data)
- **Supabase:** `https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook/health`

### Key Metrics to Monitor
1. **Webhook Response Time** < 5 seconds
2. **Error Rate** < 1%
3. **Pending Updates** should be 0
4. **Bot Response Time** < 2 seconds

## 🔄 RECOVERY PROCEDURES

### If Bot Stops Responding

1. **Check Webhook Status**
   ```bash
   curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo" | jq '.result | {url, pending_update_count, last_error_message}'
   ```

2. **Test Proxy Endpoint**
   ```bash
   curl -X POST "https://fitlinkbot.netlify.app/api/telegram-webhook" -d '{"test":"data"}'
   ```

3. **Check Netlify Function Logs**
   - Go to Netlify dashboard → Functions → Logs

4. **Emergency: Switch to Polling**
   ```bash
   # Delete webhook
   curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook"
   
   # Run polling bot locally
   node bot-polling.js
   ```

## 💡 LESSONS LEARNED

### What Breaks This Setup
1. **Supabase anon key expires/changes**
2. **Netlify function deployment fails**
3. **Environment variables not set**
4. **Wrong webhook URL format**
5. **Supabase function not deployed**

### What Makes It Robust
1. **Error handling in proxy returns 200 OK to prevent Telegram retries**
2. **Hardcoded config values (not env vars) for reliability**
3. **Simple proxy logic with minimal dependencies**
4. **Clear separation between webhook delivery and bot logic**

## 🎯 SUCCESS METRICS

When everything works correctly:
- ✅ `/start` responds in < 2 seconds
- ✅ All buttons work instantly
- ✅ No 401/404 errors in webhook
- ✅ Pending update count stays at 0
- ✅ Bot handles multiple concurrent users

---

## 📞 EMERGENCY CONTACTS

**If bot completely fails:**
1. Check this document first
2. Test proxy endpoint
3. Check Supabase anon key validity
4. Switch to manual polling as last resort

**Never again spend days debugging webhook auth issues!**