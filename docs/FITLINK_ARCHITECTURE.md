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
- **Proxy Functions (Edge Functions)**: Minimal Netlify Edge Functions add the required `Authorization` header and forward to Supabase. No business logic lives here.
- **Static Files**: `web/public/` → Web dashboard
- **Important**: Netlify Edge Functions are REQUIRED as thin proxies for public inbound traffic (Telegram webhooks, OAuth start/callback). Do not remove.

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
  ↓ (Netlify proxy adds Authorization header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-strava/start
  ↓ (Generates OAuth URL + 302 redirect)  
Netlify proxy passes 302 through to browser
  ↓
Browser redirects to: www.strava.com/oauth/authorize?...
  ↓ (User authorizes)
Strava redirects to: fitlinkbot.netlify.app/oauth-strava/callback?code=XXX
  ↓ (Netlify proxy adds Authorization header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-strava/callback
  ↓ (Exchanges code for tokens, stores in database)
Shows success page: "✅ Strava Connected!"
  ↓ (After 2 seconds, JavaScript redirect)
Opens Telegram: https://t.me/the_fitlink_bot?start=status
  ↓ (Triggers /start status command)
Bot shows user's connection status automatically
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

### **6. Adding New Provider Integrations (Whoop, Garmin, etc.)**

#### **🚨 CRITICAL: OAuth Integration Pattern - DO NOT DEVIATE 🚨**
All new health/fitness providers MUST follow this EXACT pattern. Any deviation will break the OAuth flow.

```
User clicks "Connect [Provider]" 
  ↓ 
fitlinkbot.netlify.app/oauth-[provider]/start?user_id=X
  ↓ (Netlify proxy adds Authorization header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-[provider]/start
  ↓ (Generates OAuth URL + 302 redirect)  
Netlify proxy passes 302 through to browser
  ↓
Browser redirects to: [provider-oauth-url]
  ↓ (User authorizes)
Provider redirects to: fitlinkbot.netlify.app/oauth-[provider]/callback?code=XXX
  ↓ (Netlify proxy adds Authorization header)
umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-[provider]/callback
  ↓ (Exchanges code for tokens, stores in database)
Shows success page: "✅ [Provider] Connected!"
  ↓ (After 2 seconds, JavaScript redirect)
Opens Telegram: https://t.me/the_fitlink_bot?start=status
```

**⚠️ COMMON MISTAKES THAT BREAK OAUTH:**
1. ❌ Using BASE_URL from environment variables (MUST hardcode fitlinkbot.netlify.app)
2. ❌ Setting redirect_uri to Supabase URL (MUST use Netlify URL)
3. ❌ Missing Content-Type detection in proxy (HTML shows as plain text)
4. ❌ Not handling redirects with `redirect: 'manual'` (OAuth flow fails)
5. ❌ Using only one env var access method (causes "uncaught exception")
6. ❌ Forgetting CORS headers (dashboard can't access API)

#### **Required Components for New Providers**

**1. Netlify Edge Function Proxy:** `netlify/edge-functions/oauth-[provider]-proxy.js`
```javascript
// COPY EXACTLY FROM oauth-oura-proxy.js - DO NOT MODIFY THE PATTERN
// Only change: replace 'oauth-oura' with 'oauth-[provider]' in path replacements
```

**2. Supabase Edge Function:** `supabase/functions/oauth-[provider]/index.ts`
```typescript
// CRITICAL: OAuth URLs MUST use Netlify URLs
const baseUrl = "https://fitlinkbot.netlify.app"; // NEVER use BASE_URL env var
const redirectUri = `${baseUrl}/oauth-[provider]/callback`;

// Start endpoint - generates authorization URL
if (path.endsWith('/start')) {
  // Build OAuth URL with Netlify callback
  return Response.redirect(providerAuthUrl);
}

// Callback endpoint - exchange code for tokens
if (path.endsWith('/callback')) {
  // Exchange code with SAME redirectUri used in /start
  // Return HTML with Telegram deep link
  return new Response(successHtml, {
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'text/html; charset=UTF-8' // CRITICAL
    }
  });
}
```

**2. Database Integration:**
- Uses existing `providers` table with provider-specific `provider` field
- Stores encrypted OAuth tokens using shared encryption utilities
- Links to user via `user_id` foreign key

**3. Telegram Bot Commands:**
- Add `/connect_[provider]` command to shared/telegram.ts
- Update status command to show new provider connection
- Follow existing button/keyboard patterns

**4. Data Sync Function:** `supabase/functions/data-sync-[provider]/index.ts`
- Fetches provider's API data using stored tokens
- Transforms data to common schema
- Stores in provider-specific database tables
- Handles token refresh if needed

#### **Provider-Specific Considerations**

**Whoop Integration:**
- OAuth 2.0 with scopes: `read:recovery`, `read:workout`, `read:sleep`
- API: `https://api.prod.whoop.com/developer/v1/`
- Data: Recovery scores, HRV, strain, sleep efficiency
- Tables: `whoop_recovery`, `whoop_workouts`, `whoop_sleep`

**Garmin Connect Integration:**
- OAuth 1.0a (different from OAuth 2.0 pattern)
- API: `https://apis.garmin.com/wellness-api/rest/`
- Data: Daily activities, sleep, heart rate, stress
- Tables: `garmin_activities`, `garmin_sleep`, `garmin_wellness`

**Polar Integration:**
- OAuth 2.0 with scopes: `accesslink.read_all`
- API: `https://www.polar.com/accesslink-api/v3/`
- Data: Training sessions, physical info, sleep
- Tables: `polar_exercises`, `polar_sleep`, `polar_physical`

#### **Integration Checklist - MUST COMPLETE ALL**

**🔴 Critical Setup (Breaking if Wrong):**
- [ ] Register app with EXACT redirect URI: `https://fitlinkbot.netlify.app/oauth-[provider]/callback`
- [ ] Add `VITE_SUPABASE_ANON_KEY` to Netlify environment variables
- [ ] Copy `oauth-oura-proxy.js` EXACTLY (only change provider name in paths)
- [ ] Hardcode `baseUrl = "https://fitlinkbot.netlify.app"` in Supabase function
- [ ] Add to `netlify.toml`: `[[edge_functions]] function = "oauth-[provider]-proxy" path = "/oauth-[provider]/*"`

**🟡 Function Development:**
- [ ] Create Netlify proxy: `netlify/edge-functions/oauth-[provider]-proxy.js`
- [ ] Create Supabase function: `supabase/functions/oauth-[provider]/`
- [ ] Add `config.toml` with `verify_jwt = false`
- [ ] Test env var access works (VITE_SUPABASE_ANON_KEY)
- [ ] Test redirect handling (302 responses)
- [ ] Test HTML rendering (not plain text)

**🟢 Standard Integration:**
- [ ] Add connect command to Telegram handler
- [ ] Update status command to include new provider
- [ ] Create data sync function
- [ ] Add provider to daily briefing AI prompts

**✅ Verification Steps:**
1. Click connect link → Should redirect to provider
2. Authorize → Should redirect back to Netlify
3. Success page → Should show HTML (not raw code)
4. Auto-redirect → Should open Telegram with status
5. Check tokens → Should be stored encrypted in DB

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

### **Netlify Edge Functions Policy**
- This project uses Netlify Edge Functions strictly as authentication proxies
- Keep proxies minimal; all business logic remains in Supabase Edge Functions
- Required proxies are: `/api/telegram-webhook`, `/oauth-oura/*`, `/oauth-strava/*`
- **Environment Variables**: Netlify Edge Functions require `VITE_SUPABASE_ANON_KEY` to be set in Netlify dashboard
  - The variable is named `VITE_SUPABASE_ANON_KEY` (not `SUPABASE_ANON_KEY`) in Netlify environment
  - All proxies check for `context.env.VITE_SUPABASE_ANON_KEY` first, with fallback to `context.env.SUPABASE_ANON_KEY`

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
2. Netlify edge function (proxy) intercepts request
3. Proxy adds `Authorization: Bearer <anon-key>` header
4. Request forwarded to corresponding Supabase function
5. Supabase function processes with proper authentication
6. **CRITICAL**: Proxy preserves response Content-Type headers for proper HTML rendering

#### **Netlify Edge Function Configuration - CRITICAL FOR ALL INTEGRATIONS**

**⚠️ NEVER MODIFY WITHOUT UNDERSTANDING - THIS PATTERN IS REQUIRED FOR ALL OAUTH PROVIDERS ⚠️**

```javascript
// netlify/edge-functions/oauth-[provider]-proxy.js
export default async (request, context) => {
  try {
    // CRITICAL: Environment variable access - MUST support all methods
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    const SUPABASE_ANON_KEY = 
      context?.env?.VITE_SUPABASE_ANON_KEY || 
      context?.env?.SUPABASE_ANON_KEY ||
      Deno?.env?.get?.('VITE_SUPABASE_ANON_KEY') ||
      Deno?.env?.get?.('SUPABASE_ANON_KEY') ||
      '';

    if (!SUPABASE_ANON_KEY) {
      return new Response('Missing VITE_SUPABASE_ANON_KEY environment variable', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Build target URL - MUST proxy to Supabase Edge Function
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/oauth-[provider]/, '/oauth-[provider]');
    const targetUrl = `${SUPABASE_URL}/functions/v1${path}${url.search}`;

    // Proxy the request with auth header
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      redirect: 'manual' // CRITICAL: Must be manual to handle redirects
    });
    
    // CRITICAL: Handle OAuth redirects (302) properly
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        return Response.redirect(location, response.status);
      }
    }
    
    // CRITICAL: Fix Content-Type for HTML responses
    const contentType = response.headers.get('Content-Type') || '';
    const body = await response.text();
    
    const headers = new Headers();
    
    // Preserve CORS headers
    const corsHeaders = ['Access-Control-Allow-Origin', 'Access-Control-Allow-Headers'];
    corsHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });
    
    // CRITICAL: Detect and fix HTML Content-Type
    if (contentType.includes('text/html') || body.trim().startsWith('<!DOCTYPE html>')) {
      headers.set('Content-Type', 'text/html; charset=UTF-8');
    } else {
      headers.set('Content-Type', contentType || 'text/plain');
    }
    
    headers.set('Cache-Control', 'no-cache');
    
    return new Response(body, {
      status: response.status,
      headers
    });
  } catch (err) {
    console.error('OAuth proxy error:', err);
    return new Response(`Proxy error: ${err?.message || err}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

// CRITICAL: Path configuration MUST match netlify.toml
export const config = {
  path: ['/oauth-[provider]', '/oauth-[provider]/*']
};
```

**🚨 CRITICAL REQUIREMENTS FOR OAUTH PROXIES:**
1. **Environment Variables**: MUST check both `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
2. **Multiple Access Methods**: MUST try `context.env` AND `Deno.env.get` for compatibility
3. **Redirect Handling**: MUST use `redirect: 'manual'` and handle 3xx status codes
4. **Content-Type Fix**: MUST detect HTML and override Content-Type (Supabase bug workaround)
5. **CORS Headers**: MUST preserve Access-Control headers from Supabase
6. **Error Handling**: MUST wrap everything in try/catch to prevent uncaught exceptions

#### **Netlify Configuration (netlify.toml)**
```toml
# CRITICAL: Explicit edge function mappings
[[edge_functions]]
  function = "oauth-oura-proxy"
  path = "/oauth-oura/*"

[[edge_functions]]
  function = "oauth-strava-proxy"
  path = "/oauth-strava/*"

[[edge_functions]]
  function = "telegram-proxy"
  path = "/api/telegram-webhook"

# Global redirect AFTER edge functions
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### **Required Environment Variables**
- **Netlify Environment**: 
  - `VITE_SUPABASE_ANON_KEY` - Supabase anon key (used by Edge Functions)
- **Supabase Environment**: 
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`  
  - `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`
  - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
  - `OPENWEATHER_API_KEY`
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

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
- ❌ Don't remove Netlify edge function proxies (breaks authentication)
- ❌ Don't put business logic in Netlify edge functions (all logic stays in Supabase)
- ❌ Don't create additional Netlify edge functions beyond the required proxies

### **HTML Rendering Issues**
- ❌ Don't ignore Content-Type headers in proxy responses
- ❌ Don't cache HTML responses (use `Cache-Control: no-cache`)
- ❌ Don't rely on config exports only (use explicit netlify.toml mappings)
- ❌ Don't forget `redirect: 'manual'` for OAuth flows

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

## 🔧 TROUBLESHOOTING GUIDE

### **Problem: OAuth Success Page Shows Raw HTML**
```
Symptoms: User sees HTML code instead of styled success page
Root Cause: Netlify proxy not preserving Content-Type headers
```

**Solution Checklist:**
1. ✅ Verify `Content-Type: text/html; charset=UTF-8` in Supabase function
2. ✅ Ensure Netlify proxy preserves `response.headers.get('Content-Type')`
3. ✅ **CRITICAL**: Netlify proxy fallback Content-Type must include charset:
   ```javascript
   const contentType = response.headers.get('Content-Type') || 'text/html; charset=UTF-8';
   ```
   NOT: `|| 'text/html'` (missing charset causes browser to show raw HTML)
4. ✅ Add `Cache-Control: no-cache` to prevent browser caching
5. ✅ Check explicit edge function mappings in `netlify.toml`
6. ✅ Verify edge function `config.path` matches netlify.toml paths

**Debug Steps:**
```bash
# Check Content-Type being returned
curl -v https://fitlinkbot.netlify.app/oauth-oura/callback?code=test&state=123_test

# Should show: Content-Type: text/html; charset=UTF-8
# Should NOT show: Content-Type: text/plain
```

### **Problem: OAuth Redirect URI Invalid**
```
Symptoms: "redirect_uri not found in application redirect URIs"
Root Cause: Provider OAuth function using wrong callback URL
```

**Solution Checklist:**
1. ✅ Use Netlify proxy URL: `https://fitlinkbot.netlify.app/oauth-[provider]/callback`
2. ✅ NOT direct Supabase URL: `umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/...`
3. ✅ Update both authorization URL generation AND token exchange
4. ✅ Verify provider app settings match exact callback URL

### **Problem: Missing Authorization Header (401)**
```
Symptoms: "Missing authorization header" from Supabase
Root Cause: Direct calls bypassing Netlify proxy
```

**Solution Checklist:**
1. ✅ All user-facing URLs must use `fitlinkbot.netlify.app`
2. ✅ Netlify edge functions must add `Authorization: Bearer <anon-key>`
3. ✅ Check edge function configuration and deployment
4. ✅ Verify `VITE_SUPABASE_ANON_KEY` is set in Netlify environment variables
5. ✅ Ensure proxies check for `VITE_SUPABASE_ANON_KEY` first, then fallback to `SUPABASE_ANON_KEY`

### **Problem: Uncaught Exception in Edge Function**
```
Symptoms: "uncaught exception during edge function invocation"
Root Cause: Missing environment variable in Netlify
```

**Solution Checklist:**
1. ✅ Check Netlify dashboard → Site settings → Environment variables
2. ✅ Ensure `VITE_SUPABASE_ANON_KEY` is set (not just `SUPABASE_ANON_KEY`)
3. ✅ Verify the anon key value is correct and not expired
4. ✅ Edge functions should use: `context.env.VITE_SUPABASE_ANON_KEY || context.env.SUPABASE_ANON_KEY`

### **Problem: OAuth Shows HTML as Plain Text**
```
Symptoms: Success page shows raw HTML code instead of rendering
Root Cause: Content-Type header is text/plain instead of text/html
```

**Solution Checklist:**
1. ✅ Proxy MUST detect HTML content: `body.trim().startsWith('<!DOCTYPE html>')`
2. ✅ Force Content-Type when HTML detected: `headers.set('Content-Type', 'text/html; charset=UTF-8')`
3. ✅ Supabase function must return with: `'Content-Type': 'text/html; charset=UTF-8'`
4. ✅ Never trust Content-Type from upstream - always verify and fix

### **Problem: OAuth Redirect URI Mismatch**
```
Symptoms: "redirect uri not found in application redirect URIs"
Root Cause: Using Supabase URL instead of Netlify URL
```

**Solution Checklist:**
1. ✅ NEVER use BASE_URL environment variable
2. ✅ ALWAYS hardcode: `const baseUrl = "https://fitlinkbot.netlify.app"`
3. ✅ Provider app settings must have: `https://fitlinkbot.netlify.app/oauth-[provider]/callback`
4. ✅ Both /start and token exchange must use SAME redirect URI

---

## 🔍 **BEFORE MAKING CHANGES, ASK:**
1. **Does this change affect OAuth flows?** → All OAuth URLs must use Netlify proxy
2. **Does this change affect bot logic?** → Update Supabase functions  
3. **Am I using the correct URLs?** → Always use fitlinkbot.netlify.app for user-facing
4. **Will authentication work?** → Netlify proxy must add auth headers for Supabase
5. **Am I creating Netlify Edge Functions?** → DON'T - this project doesn't use them
6. **Does OAuth success page redirect properly?** → Should redirect to `t.me/the_fitlink_bot?start=status`
7. **Adding new provider?** → Follow the established OAuth integration pattern and checklist

**🚨 ALWAYS REFERENCE THIS DOCUMENT BEFORE ARCHITECTURAL CHANGES 🚨**

---

## 🤖 **CRITICAL: TELEGRAM BOT LOOP PREVENTION**

### **The Problem**
Without proper bot detection, the Telegram bot will respond to its own messages, creating an infinite loop:
1. User: "How did I sleep last night?"
2. Bot: "Hi! I'm your Fitlink Bot..."
3. Bot receives its own message as a new update
4. Bot: "Hi! I'm your Fitlink Bot..."
5. Infinite loop continues...

### **The Solution**
**EVERY** Telegram message handler MUST check if the sender is a bot:

```typescript
// CRITICAL: Ignore messages from bots to prevent infinite loops
if (message.from?.is_bot) {
  console.log("Ignoring message from bot:", message.from.username);
  return;
}
```

### **Where This Check Is Required**
1. `/supabase/functions/shared/telegram/handler.ts` - Main handler (NEW)
2. `/supabase/functions/shared/telegram.ts` - Legacy handler (OLD)
3. Any other file that processes Telegram messages

### **Why This Happened**
- There were TWO different telegram handlers in the codebase
- The webhook was importing the OLD handler without bot protection
- Even after adding bot check to one file, the other was still causing loops

### **Prevention**
1. Always check `is_bot` field before processing any Telegram message
2. Ensure webhook imports from the correct handler file
3. Add bot checks to ALL message handlers as defensive programming
4. Test with actual bot messages to ensure loop prevention works