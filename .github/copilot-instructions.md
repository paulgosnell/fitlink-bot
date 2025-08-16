# GitHub Copilot Instructions for Fitlink Bot

## 🚨 **CRITICAL: This System is Architecturally Fragile**

**READ THIS FIRST:** Fitlink Bot has a deceptively complex architecture that breaks easily with small changes. Follow these instructions precisely to avoid breaking the system.

## 🏗️ **Architecture Overview**

### Two-Layer Architecture (NEVER CHANGE)
```
External Requests → Netlify Proxy (adds auth) → Supabase Edge Functions (business logic)
```

**Why this exists:** Supabase Edge Functions require `Authorization: Bearer <token>` headers, but external services (Telegram webhooks, OAuth callbacks) cannot send custom headers.

**Critical rule:** ALL user-facing URLs must go through Netlify proxies. NEVER use Supabase URLs directly in user-facing contexts.

## 🚫 **ABSOLUTE PROHIBITIONS**

### ❌ **NEVER DO THESE (System Will Break):**

1. **NEVER use `BASE_URL` env var in OAuth contexts**
   ```javascript
   // ❌ WRONG - Will break OAuth
   const baseUrl = Deno.env.get('BASE_URL');
   
   // ✅ CORRECT - Must be hardcoded
   const baseUrl = "https://fitlinkbot.netlify.app";
   ```

2. **NEVER use Supabase URLs for OAuth redirects**
   ```javascript
   // ❌ WRONG - OAuth providers reject this
   const redirectUri = "https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-oura/callback";
   
   // ✅ CORRECT - Must use Netlify proxy
   const redirectUri = "https://fitlinkbot.netlify.app/oauth-oura/callback";
   ```

3. **NEVER remove Netlify Edge Function proxies**
   - Required: `oauth-oura-proxy.js`, `oauth-strava-proxy.js`, `telegram-proxy.js`
   - These add authentication headers that Supabase requires

4. **NEVER simplify environment variable access**
   ```javascript
   // ❌ WRONG - Will fail in Netlify
   const key = context.env.SUPABASE_ANON_KEY;
   
   // ✅ CORRECT - Multiple fallbacks required
   const key = context?.env?.VITE_SUPABASE_ANON_KEY || 
               context?.env?.SUPABASE_ANON_KEY ||
               Deno?.env?.get?.('VITE_SUPABASE_ANON_KEY') ||
               Deno?.env?.get?.('SUPABASE_ANON_KEY');
   ```

5. **NEVER remove `is_bot` checks from Telegram handlers**
   ```javascript
   // ✅ REQUIRED - Prevents infinite bot loops
   if (message.from?.is_bot) {
     console.log("Ignoring message from bot:", message.from.username);
     return;
   }
   ```

## 🔒 **CRITICAL PATTERNS TO PRESERVE**

### OAuth Implementation Pattern
```javascript
// Supabase OAuth Functions - EXACT PATTERN REQUIRED

// Start endpoint
if (path.endsWith('/start')) {
  const clientId = Deno.env.get("PROVIDER_CLIENT_ID");
  // 🚨 CRITICAL: Always hardcoded Netlify URL
  const baseUrl = "https://fitlinkbot.netlify.app";
  const redirectUri = `${baseUrl}/oauth-provider/callback`;
  // ... rest of OAuth flow
}

// Callback endpoint  
if (path.endsWith('/callback')) {
  // 🚨 CRITICAL: Use SAME hardcoded URL for token exchange
  const baseUrl = "https://fitlinkbot.netlify.app";
  const redirectUri = `${baseUrl}/oauth-provider/callback`;
  // ... token exchange
}
```

### Netlify Proxy Pattern
```javascript
// netlify/edge-functions/oauth-provider-proxy.js - EXACT PATTERN REQUIRED

export default async (request, context) => {
  try {
    // 🚨 CRITICAL: Hardcoded Supabase URL (not env var)
    const SUPABASE_URL = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
    
    // 🚨 CRITICAL: Multiple env var access methods
    const SUPABASE_ANON_KEY = 
      context?.env?.VITE_SUPABASE_ANON_KEY || 
      context?.env?.SUPABASE_ANON_KEY ||
      Deno?.env?.get?.('VITE_SUPABASE_ANON_KEY') ||
      Deno?.env?.get?.('SUPABASE_ANON_KEY');

    // 🚨 CRITICAL: Manual redirect handling
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': request.headers.get('Content-Type') || 'application/json'
      },
      redirect: 'manual' // REQUIRED for OAuth
    });
    
    // 🚨 CRITICAL: Content-Type fixing for HTML
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) return Response.redirect(location, response.status);
    }
    
    // For HTML responses, we need to read the body and set headers explicitly
    const contentType = response.headers.get('Content-Type') || '';
    const body = await response.text();
    
    // Create new headers object
    const headers = new Headers();
    
    // Copy CORS headers
    const corsHeaders = ['Access-Control-Allow-Origin', 'Access-Control-Allow-Headers'];
    corsHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });
    
    // Set Content-Type explicitly
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
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
};
```

## 🛠️ **Required Workflow Before Changes**

### 1. ALWAYS Run Validation Script
```bash
./scripts/validate-critical-config.sh
```
**Must show:** ✅ `System should work` or `ALL CHECKS PASSED`

### 2. Follow Deployment Checklist
See `docs/DEPLOYMENT_SAFETY_CHECKLIST.md` - complete ALL steps.

### 3. Run Smoke Tests After Deployment
```bash
./scripts/smoke-tests.sh
```

## 📋 **Environment Variables (Critical Names)**

### Netlify Environment (Edge Functions)
- `VITE_SUPABASE_ANON_KEY` ← **CRITICAL:** Must be this exact name in Netlify

### Supabase Environment (Edge Functions)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
- `OPENWEATHER_API_KEY`, `OPENAI_API_KEY`

## 🗂️ **File Organization & Responsibilities**

### Netlify Layer (`netlify/edge-functions/`)
- **Purpose:** Authentication proxies ONLY
- **Business Logic:** NONE (all in Supabase)
- **Pattern:** Add auth header, forward request, fix Content-Type

### Supabase Layer (`supabase/functions/`)
- **Purpose:** ALL business logic
- **Database Access:** Uses service role key
- **OAuth Processing:** Complete flows with token storage

### Static Files (`web/public/`)
- **Purpose:** Dashboard and landing pages
- **Authentication:** Via Telegram WebApp context

## 🔧 **Adding New Health Providers**

When adding providers (Garmin, Whoop, etc.), follow this EXACT pattern:

### 1. Create Netlify Proxy
```bash
# Copy existing proxy, change only provider name
cp netlify/edge-functions/oauth-oura-proxy.js netlify/edge-functions/oauth-newprovider-proxy.js
```

### 2. Create Supabase Function
```bash
# Use oauth-oura as template, change provider-specific details only
cp -r supabase/functions/oauth-oura supabase/functions/oauth-newprovider
```

### 3. Update netlify.toml
```toml
[[edge_functions]]
  function = "oauth-newprovider-proxy"
  path = "/oauth-newprovider/*"
```

### 4. NEVER Change Core Patterns
- Keep hardcoded Netlify URLs
- Keep multiple env var access methods  
- Keep manual redirect handling
- Keep Content-Type fixing

## 🚨 **Common Breaking Changes to Avoid**

### "Innocent" Changes That Break Everything:
- Using `BASE_URL` for "flexibility" (breaks OAuth)
- Simplifying env var access (breaks Netlify)
- Using Supabase URLs directly (breaks auth)
- Removing proxy Content-Type fixes (HTML shows as text)
- Forgetting `redirect: 'manual'` (breaks OAuth)
- Missing `verify_jwt = false` configs (causes 401s)

## 🧪 **Testing Requirements**

### Before Any Change:
1. Run validation script
2. Check that OAuth URLs are hardcoded
3. Verify proxy patterns intact

### After Deployment:
1. Test Telegram webhook responds
2. Test OAuth start endpoints redirect (302)
3. Test dashboard loads
4. Test actual OAuth flow end-to-end

## 📚 **Key Documentation Files**

- `docs/FITLINK_ARCHITECTURE.md` - Complete architecture reference
- `docs/DEPLOYMENT_SAFETY_CHECKLIST.md` - Pre-deployment requirements
- `docs/WHY_IT_KEEPS_BREAKING.md` - Root cause analysis
- `scripts/validate-critical-config.sh` - Validation tool
- `scripts/smoke-tests.sh` - Post-deployment verification

## 🎯 **Success Criteria for Changes**

1. ✅ Validation script passes
2. ✅ OAuth flows return 302 redirects
3. ✅ Dashboard loads with proper HTML
4. ✅ No 401 authentication errors
5. ✅ Bot doesn't respond to itself
6. ✅ Smoke tests pass

## 💡 **Philosophy for This Codebase**

**"Make the fragility visible and preventable, not invisible and surprising."**

This system is architecturally fragile by design (OAuth + proxy requirements). Instead of trying to make it robust (major rewrite), we make the fragility obvious through:
- Clear "DO NOT CHANGE" comments
- Validation scripts that catch issues
- Detailed documentation of failure modes
- Automated checks for common mistakes

When working on this codebase:
1. **Assume any change can break OAuth flows**
2. **Validate everything before deployment**
3. **Follow existing patterns exactly**
4. **When in doubt, ask or check validation script**

## 🚀 **For New Contributors**

1. **Read this file completely first**
2. **Run `./scripts/validate-critical-config.sh` to understand current state**
3. **Review `docs/FITLINK_ARCHITECTURE.md` for detailed context**
4. **Never modify OAuth or proxy patterns without deep understanding**
5. **Always follow the deployment checklist**

---

**Remember: This system works reliably when patterns are followed exactly. Small deviations cause mysterious failures that take hours to debug. The validation tools and checklists are your safety net - use them religiously.**
