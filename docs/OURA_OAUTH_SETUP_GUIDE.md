# Oura OAuth Setup Guide - Complete Working Solution

**Status:** 🔄 IN PROGRESS - Debugging redirect URI mismatch  
**Last Updated:** 2025-01-13  

## 🚨 CRITICAL SUCCESS FACTORS

### 1. The Root Problem
**Oura OAuth redirect URIs must be registered in the developer app settings and match exactly**  
**Landing on Oura main site instead of auth page = redirect URI mismatch**

### 2. Oura OAuth Flow Requirements
```
1. User clicks Connect Oura button
2. Redirect to: https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=CALLBACK_URL&scope=email+personal+daily&state=USER_STATE
3. User authorizes → Oura redirects to callback URL with code
4. Exchange code for access token at https://api.ouraring.com/oauth/token
```

## 📋 OURA API DOCUMENTATION SUMMARY

### Authorization Endpoint
```
https://cloud.ouraring.com/oauth/authorize
```

### Required Parameters
- `response_type`: `code` (for server-side flow)
- `client_id`: Your Oura app client ID
- `redirect_uri`: **Must exactly match registered URI**
- `scope`: `email personal daily` (space-separated)
- `state`: Random string for security

### Token Exchange Endpoint
```
https://api.ouraring.com/oauth/token
```

### Available Scopes
- `email` - Email address of the user
- `personal` - Personal information (gender, age, height, weight)  
- `daily` - Daily summaries of sleep, activity and readiness
- `heartrate` - Time series heart rate for Gen 3 users
- `workout` - Workout summaries
- `tag` - User entered tags
- `session` - Guided and unguided sessions
- `spo2Daily` - SpO2 Average recorded during sleep

## 🔧 CURRENT CONFIGURATION

### Our Implementation
```javascript
// In oauth-oura/index.ts
const redirectUri = `https://fitlinkbot.netlify.app/oauth-oura/callback`;
const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=email personal daily&state=${state}`;
```

### Required Oura App Settings
**In Oura Developer Portal (https://cloud.ouraring.com/applications):**
- **Redirect URI**: `https://fitlinkbot.netlify.app/oauth-oura/callback`
- **Scopes**: Email, Personal, Daily

### Environment Variables
```
OURA_CLIENT_ID=<your_client_id>
OURA_CLIENT_SECRET=<your_client_secret>
```

## 🚨 CRITICAL FAILURE POINTS

### ❌ Redirect URI Mismatch
**Symptom:** Landing on Oura main site (cloud.ouraring.com) with blank page + chat widget  
**Cause:** Redirect URI in code doesn't match registered URI in Oura app  
**Fix:** Update Oura app settings to match: `https://fitlinkbot.netlify.app/oauth-oura/callback`

### ❌ Missing Client ID
**Symptom:** Function returns 404 or doesn't redirect  
**Cause:** OURA_CLIENT_ID not set in Supabase secrets  
**Fix:** Set secret in Supabase dashboard

### ❌ Supabase Function Not Deployed
**Symptom:** Old redirect URIs still in use  
**Cause:** Updated function code not deployed  
**Fix:** `supabase functions deploy oauth-oura --no-verify-jwt`

## 🧪 TESTING PROCEDURES

### 1. Test Authorization URL Generation
```bash
# Should redirect to Oura auth page, not main site
curl -v "https://fitlinkbot.netlify.app/oauth-oura/start?user_id=12345"
```

### 2. Expected OAuth URL Format
```
https://cloud.ouraring.com/oauth/authorize?
response_type=code&
client_id=YOUR_CLIENT_ID&
redirect_uri=https%3A//fitlinkbot.netlify.app/oauth-oura/callback&
scope=email%20personal%20daily&
state=12345_RANDOM_UUID
```

### 3. Successful Authorization Flow
1. ✅ Click "Connect Oura" → Shows Oura authorization page (not blank page)
2. ✅ User grants permissions → Redirects to callback with `code` parameter  
3. ✅ Callback exchanges code for tokens → Shows success page
4. ✅ Tokens stored in database → User can access Oura data

## 🔄 ARCHITECTURE FLOW

```
Telegram Bot 
  ↓ (User clicks Connect Oura)
Netlify Proxy (/oauth-oura/start)
  ↓ (Adds auth header)
Supabase Function (oauth-oura)
  ↓ (Redirects to Oura)
Oura Authorization Page
  ↓ (User authorizes)
Netlify Proxy (/oauth-oura/callback)  
  ↓ (Adds auth header)
Supabase Function (oauth-oura/callback)
  ↓ (Exchanges code for tokens)
Database Storage + Success Page
```

## 📞 TROUBLESHOOTING CHECKLIST

### If OAuth shows blank Oura page:
1. ✅ Check Oura app redirect URI matches exactly: `https://fitlinkbot.netlify.app/oauth-oura/callback`
2. ✅ Verify OURA_CLIENT_ID is set in Supabase secrets
3. ✅ Deploy updated Supabase function: `supabase functions deploy oauth-oura`
4. ✅ Test with fresh browser session (clear cookies)
5. ✅ Check browser network tab for actual redirect URL

### If callback fails:
1. ✅ Verify Netlify OAuth proxy is deployed
2. ✅ Check Supabase function processes callback correctly
3. ✅ Verify database permissions for storing tokens

## 🎯 SUCCESS METRICS

When OAuth works correctly:
- ✅ "Connect Oura" shows proper authorization page (not blank page)
- ✅ User can grant/deny specific permissions
- ✅ Successful authorization shows branded success page
- ✅ Tokens stored in database and accessible
- ✅ User sees "Oura Ring Connected" in bot status

---

**Next Action:** Update Oura app redirect URI to match our implementation!