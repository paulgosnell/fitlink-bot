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

### **Layer 1: Netlify (Proxy + Static Hosting)**
- **Purpose**: Authentication proxy + static web dashboard hosting
- **Location**: `fitlinkbot.netlify.app`
- **Functions**:
  - `netlify/edge-functions/telegram-proxy.js` → Telegram webhook proxy
  - `netlify/edge-functions/oauth-oura-proxy.js` → Oura OAuth proxy
  - `netlify/edge-functions/oauth-strava-proxy.js` → Strava OAuth proxy
- **Static Files**: `web/public/` → Web dashboard

### **Layer 2: Supabase Edge Functions (Business Logic)**
- **Purpose**: All bot logic, OAuth processing, data operations
- **Location**: `umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/`
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
         → umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/telegram-webhook
         → Bot processes message and responds
```

### **2. Oura OAuth Flow**
```
User clicks "Connect Oura" 
  ↓ 
fitlinkbot.netlify.app/oauth-oura/start?user_id=X
  ↓ (Netlify proxy adds auth header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-oura/start
  ↓ (Generates OAuth URL + 302 redirect)  
Netlify proxy passes 302 through
  ↓
Browser redirects to: cloud.ouraring.com/oauth/authorize?...
  ↓ (User authorizes)
Oura redirects to: fitlinkbot.netlify.app/oauth-oura/callback?code=XXX
  ↓ (Netlify proxy adds auth header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-oura/callback
  ↓ (Exchanges code for tokens, stores in database)
Shows success/error page
```

### **3. Strava OAuth Flow** 
```
User clicks "Connect Strava"
  ↓
fitlinkbot.netlify.app/oauth-strava/start?user_id=X
  ↓ (Same proxy pattern as Oura)
Strava authorization → callback → token storage
```

### **4. Weather & Location Data**
- **Location Storage**: User location stored in database via Telegram bot
- **Weather API**: OpenWeather API integration for training recommendations  
- **Integration**: Weather data combined with health data for AI briefings

## 🛠️ DEPLOYMENT PROCESS

### **Netlify Edge Functions**
```bash
git add netlify/edge-functions/
git commit -m "Update edge functions"
git push origin main  # GitHub Actions deploys automatically
```

### **Supabase Edge Functions**  
```bash
git add supabase/functions/
git commit -m "Update Supabase functions"  
git push origin main  # GitHub Actions deploys automatically
```

### **Static Web Files**
```bash
git add web/public/
git commit -m "Update web dashboard"
git push origin main  # GitHub Actions deploys automatically
```

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

### **Netlify Proxy Authentication**
```javascript
// Each proxy adds this header before forwarding:
headers: {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
}
```

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
4. ✅ Proxy uses `redirect: 'manual'` to pass through 302 responses

### **For Location & Weather**
1. ✅ User location stored via Telegram bot commands
2. ✅ Weather fetched via OpenWeather API using stored location
3. ✅ Combined with health data for personalized recommendations

## ❌ COMMON MISTAKES TO AVOID

### **Wrong URL Usage**
- ❌ Don't use Supabase URLs directly in user-facing links
- ❌ Don't bypass Netlify proxy for OAuth flows
- ❌ Don't forget proxy adds auth headers

### **Deployment Confusion**  
- ❌ Don't deploy Netlify functions via CLI (use GitHub Actions only)
- ❌ Don't deploy Supabase functions manually (use GitHub Actions)

### **Architecture Misunderstanding**
- ❌ Don't remove Netlify proxy layer (breaks authentication)
- ❌ Don't assume direct Supabase access works (requires auth)
- ❌ Don't create duplicate authentication systems

## 🎯 HEALTH CHECK ENDPOINTS

### **Verify System Health**
```bash
# Telegram webhook
curl -X POST https://fitlinkbot.netlify.app/api/telegram-webhook -d '{"test":1}'

# Oura OAuth start  
curl https://fitlinkbot.netlify.app/oauth-oura/start?user_id=12345

# Strava OAuth start
curl https://fitlinkbot.netlify.app/oauth-strava/start?user_id=12345
```

---

## 🔍 **BEFORE MAKING CHANGES, ASK:**
1. **Does this change affect the proxy layer?** → Update Netlify edge functions
2. **Does this change affect bot logic?** → Update Supabase functions  
3. **Does this change affect OAuth flows?** → Verify both proxy and callback URLs
4. **Am I using the correct URLs?** → Always use fitlinkbot.netlify.app for user-facing
5. **Will authentication work?** → Proxy must add auth headers for Supabase

**🚨 ALWAYS REFERENCE THIS DOCUMENT BEFORE MAJOR ARCHITECTURAL CHANGES 🚨**