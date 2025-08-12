# Integration Implementation Guide

## 🏗️ Architecture Overview

Fitlink Bot follows a modular architecture for integrations:

```
supabase/functions/
├── oauth-{provider}/          # OAuth flow for each provider
│   ├── index.ts               # Main OAuth handler
│   └── types.ts               # Provider-specific types
├── shared/
│   ├── database/              # Database operations
│   │   ├── providers.ts       # Provider management
│   │   └── users.ts           # User management
│   ├── types.ts               # Shared type definitions
│   └── utils/                 # Common utilities
└── data-sync-{provider}/      # Data synchronization (future)
```

## 🔐 OAuth Integration Pattern

### 1. Create OAuth Function

```typescript
// supabase/functions/oauth-{provider}/index.ts
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

  // OAuth start endpoint
  if (path.endsWith('/start')) {
    const userId = url.searchParams.get('user_id');
    const clientId = Deno.env.get('PROVIDER_CLIENT_ID');
    const baseUrl = Deno.env.get('BASE_URL');
    
    if (userId && clientId && baseUrl) {
      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-{provider}/callback`;
      
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'required_scopes_here',
        state,
        approval_prompt: 'auto',
      });

      const authUrl = `https://provider.com/oauth/authorize?${params.toString()}`;
      return Response.redirect(authUrl, 302);
    }
  }

  // OAuth callback endpoint
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (code && state) {
      try {
        const [userId, _] = state.split('_');
        const tokens = await exchangeCodeForTokens(code);
        
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const user = await getUserByTelegramId(supabase, parseInt(userId));
        if (!user) throw new Error('User not found');

        await createOrUpdateProvider(supabase, {
          user_id: user.id,
          provider: '{provider}',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expires_at,
          provider_user_id: tokens.user_id?.toString(),
          scopes: ['required', 'scopes']
        });

        return new Response(successHtml, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch (error) {
        console.error('OAuth error:', error);
        return new Response(errorHtml, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

async function exchangeCodeForTokens(code: string) {
  const clientId = Deno.env.get('PROVIDER_CLIENT_ID');
  const clientSecret = Deno.env.get('PROVIDER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing provider credentials');
  }

  const response = await fetch('https://provider.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : undefined,
    user_id: data.user_id
  };
}
```

### 2. Update Telegram Handler

```typescript
// supabase/functions/shared/telegram.ts
async function handleConnect{Provider}(chatId: number, userId: number, botToken: string): Promise<void> {
  const baseUrl = Deno.env.get("BASE_URL");
  const authUrl = `${baseUrl}/oauth-{provider}/start?user_id=${userId}`;
  
  const message = `🔗 *Connect Your {Provider} Account*

Click the button below to authorize Fitlink Bot to access your {Provider} data:`;

  const keyboard = {
    inline_keyboard: [[
      {
        text: "Connect {Provider}",
        url: authUrl
      }
    ]]
  };

  await sendTelegramMessage(botToken, chatId, message, keyboard);
}

async function handleDisconnect{Provider}(chatId: number, userId: number, supabase: any, botToken: string): Promise<void> {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      await sendTelegramMessage(botToken, chatId, "❌ User not found. Please use /start first.");
      return;
    }

    await supabase
      .from("providers")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("provider", "{provider}");

    await sendTelegramMessage(botToken, chatId, "🔌 *{Provider} Disconnected*\n\nYour {Provider} account has been disconnected from Fitlink Bot. You can reconnect anytime using /connect_{provider}.");
    
  } catch (error) {
    console.error("Error disconnecting {Provider}:", error);
    await sendTelegramMessage(botToken, chatId, "❌ Error disconnecting {Provider}. Please try again.");
  }
}
```

### 3. Add Callback Handlers

```typescript
// In handleCallbackQuery function
case "connect_{provider}":
  await handleConnect{Provider}(chatId, userId, botToken);
  break;

case "disconnect_{provider}":
  await handleDisconnect{Provider}(chatId, userId, supabase, botToken);
  break;
```

### 4. Update Types

```typescript
// supabase/functions/shared/types.ts
export interface Provider {
  id: string;
  user_id: string;
  provider: 'oura' | 'strava' | '{provider}'; // Add new provider
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  provider_user_id?: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

## 📊 Data Synchronization (Future)

### 1. Create Data Sync Function

```typescript
// supabase/functions/data-sync-{provider}/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getProviderByUserAndType } from "../shared/database/providers.ts";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active users with this provider
  const { data: providers } = await supabase
    .from("providers")
    .select("user_id, access_token, provider_user_id")
    .eq("provider", "{provider}")
    .eq("is_active", true);

  for (const provider of providers || []) {
    try {
      await syncUserData(supabase, provider);
    } catch (error) {
      console.error(`Error syncing data for user ${provider.user_id}:`, error);
    }
  }

  return new Response(JSON.stringify({ success: true }));
});

async function syncUserData(supabase: any, provider: any) {
  // Implement provider-specific data fetching
  // Store in appropriate tables (sleep_data, activity_data, etc.)
}
```

### 2. Data Storage Strategy

```typescript
// Standardized data storage
interface SleepData {
  user_id: string;
  date: string;
  total_sleep_minutes?: number;
  sleep_efficiency?: number;
  deep_sleep_minutes?: number;
  light_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  awake_minutes?: number;
  bedtime_start?: string;
  bedtime_end?: string;
  hrv_avg?: number;
  resting_heart_rate?: number;
  raw_data?: any;
}

interface ActivityData {
  user_id: string;
  date: string;
  source: 'oura' | 'strava' | '{provider}';
  activity_type: string;
  duration_seconds: number;
  distance_meters?: number;
  calories?: number;
  raw_data?: any;
}
```

## 🔧 Environment Variables

### Required for Each Provider

```bash
# Oura
OURA_CLIENT_ID=your_oura_client_id
OURA_CLIENT_SECRET=your_oura_client_secret

# Strava
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# New Provider
{PROVIDER}_CLIENT_ID=your_provider_client_id
{PROVIDER}_CLIENT_SECRET=your_provider_client_secret

# Common
BASE_URL=https://your-domain.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🧪 Testing Strategy

### 1. OAuth Flow Testing

```bash
# Test OAuth start
curl "https://your-domain.com/functions/v1/oauth-{provider}/start?user_id=123"

# Test OAuth callback (simulate with test code)
curl "https://your-domain.com/functions/v1/oauth-{provider}/callback?code=test_code&state=123_uuid"
```

### 2. Database Testing

```typescript
// Test provider creation
const provider = await createOrUpdateProvider(supabase, {
  user_id: "test-user-id",
  provider: "{provider}",
  access_token: "test-token",
  scopes: ["test-scope"]
});

// Test provider retrieval
const retrieved = await getProviderByUserAndType(supabase, "test-user-id", "{provider}");
```

### 3. Integration Testing

```typescript
// Test complete flow
async function testIntegration() {
  // 1. Start OAuth
  const authUrl = await startOAuth(userId);
  
  // 2. Simulate callback
  const tokens = await exchangeCodeForTokens(testCode);
  
  // 3. Store in database
  await storeProvider(userId, tokens);
  
  // 4. Verify storage
  const provider = await getProvider(userId);
  assert(provider.access_token === tokens.access_token);
}
```

## 🚀 Deployment Checklist

### Before Deploying

- [ ] Environment variables configured
- [ ] OAuth app registered with provider
- [ ] Redirect URIs configured
- [ ] Database schema supports new provider
- [ ] Error handling implemented
- [ ] Rate limiting considered
- [ ] Logging and monitoring added

### After Deploying

- [ ] Test OAuth flow end-to-end
- [ ] Verify database storage
- [ ] Check error handling
- [ ] Monitor API usage
- [ ] Test disconnect functionality
- [ ] Update documentation

## 📚 Provider-Specific Notes

### Oura Ring
- Uses form-encoded token exchange
- Scopes: `email personal daily`
- Token endpoint: `https://api.ouraring.com/oauth/token`

### Strava
- Uses JSON token exchange
- Scopes: `read,activity:read_all`
- Token endpoint: `https://www.strava.com/oauth/token`

### Garmin Connect (Future)
- Uses OAuth 1.0a (more complex)
- Requires consumer key and secret
- Token endpoint: `https://connect.garmin.com/oauth/access_token`

### Apple Health (Future)
- Uses HealthKit framework
- Requires iOS app integration
- No OAuth flow (direct API access)

## 🔒 Security Considerations

### Token Security
- All tokens encrypted before storage
- Use service role key for database operations
- Implement token refresh logic
- Monitor for token expiration

### Rate Limiting
- Respect provider API limits
- Implement exponential backoff
- Queue requests when limits exceeded
- Monitor API usage patterns

### Data Privacy
- Only request necessary scopes
- Implement data retention policies
- Provide user data export/deletion
- Comply with GDPR/CCPA

## 📈 Monitoring & Analytics

### Key Metrics
- OAuth success/failure rates
- Token refresh success rates
- API response times
- Error rates by provider
- User connection counts

### Alerts
- OAuth failures > 5%
- Token refresh failures
- API rate limit exceeded
- Database connection issues

This guide ensures consistent, secure, and maintainable integrations across all providers.
