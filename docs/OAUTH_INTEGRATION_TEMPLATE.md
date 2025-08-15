# OAuth Integration Template for New Providers

**⚠️ CRITICAL: Follow this template EXACTLY. Any deviation will break the OAuth flow. ⚠️**

This template shows how to add a new OAuth provider (e.g., Whoop, Garmin, Polar) to Fitlink Bot.

## Prerequisites

1. **Provider Developer Account**
   - Register your application with the provider
   - Obtain Client ID and Client Secret
   - Set redirect URI to: `https://fitlinkbot.netlify.app/oauth-[provider]/callback`

2. **Environment Setup**
   - Add to Supabase secrets: `[PROVIDER]_CLIENT_ID`, `[PROVIDER]_CLIENT_SECRET`
   - Ensure Netlify has: `VITE_SUPABASE_ANON_KEY`

## Step 1: Create Netlify Edge Function Proxy

Create file: `netlify/edge-functions/oauth-[provider]-proxy.js`

```javascript
// COPY THIS EXACTLY - Only change [provider] to your provider name
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

export const config = {
  path: ['/oauth-[provider]', '/oauth-[provider]/*']
};
```

## Step 2: Update netlify.toml

Add to `netlify.toml`:

```toml
[[edge_functions]]
  function = "oauth-[provider]-proxy"
  path = "/oauth-[provider]/*"
```

## Step 3: Create Supabase Edge Function

Create directory: `supabase/functions/oauth-[provider]/`

### index.ts

```typescript
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createOrUpdateProvider } from "../shared/database/providers.ts";
import { getUserByTelegramId } from "../shared/database/users.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // OAuth callback
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (code && state) {
      try {
        // Parse state to get user_id
        const [userId, _] = state.split('_');
        
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code);
        
        // Get user from database
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const user = await getUserByTelegramId(supabase, parseInt(userId));
        if (!user) {
          throw new Error('User not found');
        }

        // Store tokens in database
        await createOrUpdateProvider(supabase, {
          user_id: user.id,
          provider: '[provider]',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          provider_user_id: tokens.user_id?.toString(),
          scopes: ['your', 'required', 'scopes']
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Provider] Connected</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { margin-top: 0; font-size: 2rem; }
        p { font-size: 1.1rem; opacity: 0.9; }
        .success { color: #4ade80; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ [Provider] Connected!</h1>
        <p>Your [Provider] has been successfully connected to Fitlink Bot.</p>
        <p class="success">Redirecting you back to Telegram to check your status...</p>
    </div>
    <script>
        // CRITICAL: Redirect to Telegram bot with /status command
        setTimeout(() => {
            window.location.href = 'https://t.me/the_fitlink_bot?start=status';
        }, 2000);
        
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
</body>
</html>`;
      
        return new Response(html, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/html; charset=UTF-8' // CRITICAL
          }
        });
      } catch (error) {
        console.error('Error in [Provider] OAuth callback:', error);
        
        const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connection Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #ef4444 0%, #fca5a5 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 2rem;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { margin-top: 0; font-size: 2rem; }
        p { font-size: 1.1rem; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Connection Failed</h1>
        <p>Sorry, we couldn't connect your [Provider].</p>
        <p>Please try again or contact support if the problem persists.</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 5000);
    </script>
</body>
</html>`;

        return new Response(errorHtml, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/html; charset=UTF-8'
          }
        });
      }
    }
  }

  // OAuth start
  if (path.endsWith('/start')) {
    try {
      const userId = url.searchParams.get('user_id');
      const clientId = Deno.env.get("[PROVIDER]_CLIENT_ID");
      
      // CRITICAL: NEVER use BASE_URL - always hardcode
      const baseUrl = "https://fitlinkbot.netlify.app";
      
      if (!userId) return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: corsHeaders });
      if (!clientId) return new Response(JSON.stringify({ error: 'Missing [PROVIDER]_CLIENT_ID' }), { status: 500, headers: corsHeaders });

      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-[provider]/callback`;
      
      // Build provider's OAuth URL
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'your required scopes',
        state: state,
      });
      
      const authUrl = `https://[provider-oauth-domain]/oauth/authorize?${params.toString()}`;
      
      console.log('Redirecting to [Provider] OAuth:', authUrl);
      return Response.redirect(authUrl);
    } catch (e) {
      console.error('OAuth start error ([Provider]):', e);
      return new Response(JSON.stringify({ error: 'OAuth start failed' }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Not found", { status: 404 });
});

async function exchangeCodeForTokens(code: string) {
  const clientId = Deno.env.get('[PROVIDER]_CLIENT_ID');
  const clientSecret = Deno.env.get('[PROVIDER]_CLIENT_SECRET');
  
  // CRITICAL: Use same redirect URI as in /start
  const baseUrl = "https://fitlinkbot.netlify.app";
  const redirectUri = `${baseUrl}/oauth-[provider]/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Missing [Provider] credentials');
  }

  const response = await fetch('https://[provider-api-domain]/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
    user_id: data.user_id || data.athlete?.id // Adjust based on provider
  };
}
```

### config.toml

```toml
verify_jwt = false

[functions.oauth-[provider]]
  route = "/oauth-[provider]/{path:.*}"
```

## Step 4: Add Telegram Bot Command

In `supabase/functions/shared/telegram/handler.ts`, add:

```typescript
case '/connect_[provider]':
  const [providerButton] = createOAuthButtons(userId, '[provider]');
  await sendMessage(chatId, 
    '🔗 *Connect Your [Provider]*\n\n' +
    'Click the button below to connect your [Provider] account:',
    {
      reply_markup: {
        inline_keyboard: [[providerButton]]
      }
    }
  );
  break;
```

## Step 5: Update Status Command

Add [provider] to the status display in the same handler file.

## Step 6: Test Checklist

- [ ] Environment variable `VITE_SUPABASE_ANON_KEY` is set in Netlify
- [ ] Provider credentials are in Supabase secrets
- [ ] Netlify proxy file created and paths match
- [ ] netlify.toml updated with edge function mapping
- [ ] Supabase function created with config.toml
- [ ] Test OAuth flow:
  1. Click connect link → Redirects to provider ✓
  2. Authorize → Redirects back to Netlify ✓
  3. Success page → Shows as HTML (not raw text) ✓
  4. Auto-redirect → Opens Telegram ✓
  5. Check database → Tokens stored encrypted ✓

## Common Issues

### "Uncaught exception during edge function invocation"
- Check `VITE_SUPABASE_ANON_KEY` is set in Netlify
- Verify all env var access methods are included

### HTML shows as plain text
- Ensure proxy has Content-Type detection logic
- Check Supabase function returns `'Content-Type': 'text/html; charset=UTF-8'`

### "redirect uri not found"
- Verify provider app has: `https://fitlinkbot.netlify.app/oauth-[provider]/callback`
- Check baseUrl is hardcoded (not using BASE_URL env var)

## DO NOT:
- ❌ Use BASE_URL environment variable
- ❌ Skip the Content-Type detection in proxy
- ❌ Remove any env var access methods
- ❌ Change the redirect: 'manual' setting
- ❌ Use Supabase URLs in redirect URIs