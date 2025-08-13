# 🏗️ FITLINK BOT ARCHITECTURE - MASTER REFERENCE

**⚠️ READ THIS BEFORE ANY MAJOR CHANGES ⚠️**  
**Status:** Current and Accurate  
**Last Updated:** 2025-01-13  

## 🚨 CRITICAL UNDERSTANDING

### **Core Problem Solved**
- **Supabase Edge Functions** require `Authorization: Bearer <token>` headers
- **Telegram webhooks** and **OAuth callbacks** cannot send custom headers
- **Solution:** Netlify acts as authentication proxy, adding headers before forwarding to Supabase

### **Two-Layer Architecture**
```
External Requests → Netlify Proxy (adds auth) → Supabase Edge Functions (business logic)
```

## 📋 SYSTEM COMPONENTS

### **Layer 1: Netlify (Authentication Proxy + Static Hosting)**
- **Purpose**: Authentication proxy + static web dashboard hosting
- **Location**: `fitlinkbot.netlify.app`
- **Proxy Functions**: Add Authorization headers and forward to Supabase
- **Static Files**: `web/public/` → Web dashboard
- **⚠️ NOTE**: NO Netlify Edge Functions exist in this project - it's pure proxy/static hosting

### **Layer 2: Supabase Edge Functions (All Business Logic)**
- **Purpose**: ALL bot logic, OAuth processing, data operations
- **Location**: `umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/`
- **Runtime**: Deno with TypeScript
- **Functions**:
  - `telegram-webhook/` → Bot message processing
  - `oauth-oura/` → Oura OAuth flow (start + callback)  
  - `oauth-strava/` → Strava OAuth flow (start + callback)
  - `daily-briefings/` → AI briefing generation
  - `data-sync-oura/` → Sync Oura health data
  - `shared/` → Common utilities and types

## 🔄 CRITICAL FLOWS

### **1. Telegram Bot Messages**
```
Telegram → fitlinkbot.netlify.app/api/telegram-webhook
         → (Netlify adds Authorization header)
         → umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook
         → Bot processes message and responds
```

### **2. Oura OAuth Flow**
```
User clicks "Connect Oura" 
  ↓ 
fitlinkbot.netlify.app/oauth-oura/start?user_id=X
  ↓ (Netlify proxy adds Authorization header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-oura/start
  ↓ (Generates OAuth URL + 302 redirect)  
Netlify proxy passes 302 through to browser
  ↓
Browser redirects to: cloud.ouraring.com/oauth/authorize?...
  ↓ (User authorizes)
Oura redirects to: fitlinkbot.netlify.app/oauth-oura/callback?code=XXX
  ↓ (Netlify proxy adds Authorization header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-oura/callback
  ↓ (Exchanges code for tokens, stores in database)
Shows success page: "✅ Oura Ring Connected!"
  ↓ (After 2 seconds, JavaScript redirect)
Opens Telegram: https://t.me/the_fitlink_bot?start=status
  ↓ (Triggers /start status command)
Bot shows user's connection status automatically
```

### **3. Strava OAuth Flow** 
```
User clicks "Connect Strava"
  ↓
fitlinkbot.netlify.app/oauth-strava/start?user_id=X
  ↓ (Same proxy pattern as Oura)
Strava authorization → callback → token storage → success page → redirect to Telegram
```

### **4. Seamless OAuth User Experience**
```
Complete OAuth Journey:
Telegram Bot → Web OAuth → Authorization → Success Page → Back to Telegram → Status Confirmed
```
- **Deep Link Integration**: Success pages use `https://t.me/the_fitlink_bot?start=status`
- **Automatic Status Check**: Bot detects `start=status` parameter and shows connection status  
- **No Manual Steps**: User doesn't need to manually run `/status` after OAuth
- **Immediate Confirmation**: User sees "✅ Oura Ring Connected" status in Telegram

### **5. Weather & Location Data**
- **Location Storage**: User location stored in database via Telegram bot
- **Weather API**: OpenWeather API integration for training recommendations  
- **Integration**: Weather data combined with health data for AI briefings

## 🛠️ DEPLOYMENT PROCESS

### **Supabase Edge Functions (All Backend Logic)**  
```bash
git add supabase/functions/
git commit -m "Update Supabase functions"  
git push origin main  # GitHub Actions deploys automatically
```

### **Netlify Static Files (Web Dashboard Only)**
```bash
git add web/public/
git commit -m "Update web dashboard"
git push origin main  # GitHub Actions deploys automatically
```

### **⚠️ NO NETLIFY EDGE FUNCTIONS**
- This project does NOT use Netlify Edge Functions
- Netlify only provides proxy/static hosting
- All function logic is in Supabase Edge Functions

## 📡 URL MAPPING

### **Public URLs (User-Facing)**
- **Bot**: `@the_fitlink_bot` on Telegram
- **Web Dashboard**: `https://fitlinkbot.netlify.app`
- **Oura Connect**: `https://fitlinkbot.netlify.app/oauth-oura/start?user_id=X`
- **Strava Connect**: `https://fitlinkbot.netlify.app/oauth-strava/start?user_id=X`

### **Internal URLs (Proxy Targets)**
- **Telegram**: `https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook`
- **Oura OAuth**: `https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-oura/`
- **Strava OAuth**: `https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-strava/`

## 🔐 AUTHENTICATION FLOW

### **How Netlify Proxy Works**
1. External request hits `fitlinkbot.netlify.app`
2. Netlify proxy adds `Authorization: Bearer <anon-key>` header
3. Request forwarded to corresponding Supabase function
4. Supabase function processes with proper authentication

### **Required Environment Variables**
- **Supabase**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Telegram**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`  
- **Oura**: `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`
- **Strava**: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
- **Weather**: `OPENWEATHER_API_KEY`
- **AI**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

## 🚨 CRITICAL SUCCESS FACTORS

### **For Telegram Webhook**
1. ✅ Webhook URL: `https://fitlinkbot.netlify.app/api/telegram-webhook`
2. ✅ Netlify proxy adds auth header before forwarding to Supabase
3. ✅ Returns 200 OK to prevent Telegram retries

### **For OAuth Flows**  
1. ✅ Start URLs use Netlify proxy (adds auth for Supabase calls)
2. ✅ Callback URLs use Netlify proxy (adds auth for token storage)
3. ✅ Redirect URIs in app settings must match Netlify URLs exactly
4. ✅ Netlify proxy passes through 302 responses from Supabase
5. ✅ Success pages automatically redirect back to Telegram with status deep link
6. ✅ Deep link parameter triggers `/status` command showing connection status

### **For Location & Weather**
1. ✅ User location stored via Telegram bot commands
2. ✅ Weather fetched via OpenWeather API using stored location
3. ✅ Combined with health data for personalized recommendations

## ❌ COMMON MISTAKES TO AVOID

### **Wrong URL Usage**
- ❌ Don't use Supabase URLs directly in user-facing links
- ❌ Don't bypass Netlify proxy for OAuth flows
- ❌ Don't assume direct Supabase access works (needs auth headers)

### **Architecture Confusion**  
- ❌ Don't create Netlify Edge Functions (this project doesn't use them)
- ❌ Don't remove Netlify proxy layer (breaks authentication)
- ❌ Don't put business logic in Netlify (all logic is in Supabase)

### **Deployment Mistakes**
- ❌ Don't deploy functions via CLI during development (use GitHub Actions)
- ❌ Don't forget that Netlify is just proxy + static files

## 🎯 HEALTH CHECK ENDPOINTS

### **Verify System Health**
```bash
# Telegram webhook (via proxy)
curl -X POST https://fitlinkbot.netlify.app/api/telegram-webhook -d '{"test":1}'

# Oura OAuth start (via proxy)
curl https://fitlinkbot.netlify.app/oauth-oura/start?user_id=12345

# Strava OAuth start (via proxy)  
curl https://fitlinkbot.netlify.app/oauth-strava/start?user_id=12345
```

---

## 🔍 **BEFORE MAKING CHANGES, ASK:**
1. **Does this change affect OAuth flows?** → All OAuth URLs must use Netlify proxy
2. **Does this change affect bot logic?** → Update Supabase functions  
3. **Am I using the correct URLs?** → Always use fitlinkbot.netlify.app for user-facing
4. **Will authentication work?** → Netlify proxy must add auth headers for Supabase
5. **Am I creating Netlify Edge Functions?** → DON'T - this project doesn't use them
6. **Does OAuth success page redirect properly?** → Should redirect to `t.me/the_fitlink_bot?start=status`

**🚨 ALWAYS REFERENCE THIS DOCUMENT BEFORE ARCHITECTURAL CHANGES 🚨**