# 🚨 DEPLOYMENT SAFETY CHECKLIST 🚨

**⚠️ NEVER DEPLOY WITHOUT COMPLETING THIS CHECKLIST ⚠️**

This checklist prevents the common issues that break Fitlink Bot. **Check every box before deployment.**

## 🔍 **STEP 1: Run Validation Script (REQUIRED)**

```bash
./scripts/validate-critical-config.sh
```

**Result must be:** ✅ `System should work` or `ALL CHECKS PASSED`

❌ **If you see "CRITICAL ERRORS FOUND" - STOP! Fix errors before proceeding.**

---

## 🛡️ **STEP 2: Manual Safety Checks**

### ✅ **OAuth URL Verification**
- [ ] Check `supabase/functions/oauth-oura/index.ts` contains: `"https://fitlinkbot.netlify.app"`
- [ ] Check `supabase/functions/oauth-strava/index.ts` contains: `"https://fitlinkbot.netlify.app"`
- [ ] **NEVER** contains: `Deno.env.get('BASE_URL')` in OAuth context

### ✅ **Netlify Proxy Verification** 
- [ ] `netlify/edge-functions/oauth-oura-proxy.js` exists and has multiple env var fallbacks
- [ ] `netlify/edge-functions/oauth-strava-proxy.js` exists and has multiple env var fallbacks
- [ ] `netlify/edge-functions/telegram-proxy.js` exists and has auth header injection

### ✅ **Environment Variables**
- [ ] Netlify dashboard has `VITE_SUPABASE_ANON_KEY` set (not just `SUPABASE_ANON_KEY`)
- [ ] Supabase has all required secrets: `TELEGRAM_BOT_TOKEN`, OAuth client IDs/secrets

---

## 🧪 **STEP 3: Pre-Deployment Tests**

### ✅ **Quick Health Checks**
Run these commands and verify responses:

```bash
# 1. Telegram webhook proxy (should return 200)
curl -X POST https://fitlinkbot.netlify.app/api/telegram-webhook -d '{"test":1}'

# 2. OAuth start endpoints (should redirect - expect 302)
curl -I https://fitlinkbot.netlify.app/oauth-oura/start?user_id=12345
curl -I https://fitlinkbot.netlify.app/oauth-strava/start?user_id=12345
```

**Expected Results:**
- Telegram webhook: Returns `200 OK` or valid JSON response
- OAuth endpoints: Return `302 Found` with `Location:` header to provider

❌ **If any return 401, 500, or missing headers - STOP! Fix proxy issues.**

---

## 🚀 **STEP 4: Deployment**

### ✅ **Deploy in Correct Order**
1. [ ] Deploy Supabase functions first: `supabase functions deploy --no-verify-jwt`
2. [ ] Deploy Netlify (auto-triggers on git push to main)
3. [ ] Verify deployment with health checks above

### ✅ **Post-Deployment Verification**
- [ ] Webhook receives messages: Send test message to bot
- [ ] OAuth flows work: Click "Connect Oura" button from bot
- [ ] Dashboard loads: Visit https://fitlinkbot.netlify.app

---

## 🚨 **CRITICAL FAILURE SYMPTOMS**

**If you see any of these - IMMEDIATELY ROLLBACK:**

❌ **OAuth shows raw HTML instead of styled page**
- **Cause:** Content-Type headers not fixed by proxy
- **Fix:** Check proxy Content-Type handling

❌ **OAuth redirect URI not found error**  
- **Cause:** Using BASE_URL instead of hardcoded URL
- **Fix:** Ensure hardcoded `"https://fitlinkbot.netlify.app"` in OAuth functions

❌ **401 Unauthorized from Supabase**
- **Cause:** Missing auth headers or wrong env var name
- **Fix:** Check `VITE_SUPABASE_ANON_KEY` in Netlify dashboard

❌ **Bot responds to its own messages (infinite loop)**
- **Cause:** Missing `is_bot` check
- **Fix:** Add `if (message.from?.is_bot) return;` to telegram handler

❌ **Uncaught exception in edge function**
- **Cause:** Environment variable access failure
- **Fix:** Check multiple env var access methods in proxies

---

## 🔄 **ROLLBACK PROCEDURE**

If deployment breaks:

1. **Immediate:** Revert git commit: `git revert HEAD && git push`
2. **Verify:** Run health checks above
3. **Debug:** Compare with working version, check validation script
4. **Re-deploy:** Only after fixing and passing all checks

---

## 📝 **COMMON GOTCHAS CHECKLIST**

- [ ] **Never** use `BASE_URL` env var in OAuth functions (breaks everything)
- [ ] **Always** use `VITE_SUPABASE_ANON_KEY` in Netlify (not `SUPABASE_ANON_KEY`)
- [ ] **Always** use hardcoded `"https://fitlinkbot.netlify.app"` for OAuth
- [ ] **Never** remove Netlify proxy functions (breaks auth)
- [ ] **Always** deploy Supabase functions with `--no-verify-jwt` flag
- [ ] **Never** bypass validation script before deployment

---

## ✅ **FINAL SIGN-OFF**

**I confirm that:**
- [ ] Validation script shows ✅ `System should work` or `ALL CHECKS PASSED`
- [ ] All manual safety checks completed above
- [ ] Pre-deployment tests pass
- [ ] I understand the rollback procedure
- [ ] **I will not modify OAuth URLs or proxy patterns without consulting this checklist**

**Deployed by:** _________________ **Date:** _________ **Time:** _________

---

**🎯 Remember: This system is fragile by design. The proxy pattern, hardcoded URLs, and env var handling are interconnected. Changing one piece breaks everything.**

**When in doubt, run `./scripts/validate-critical-config.sh` and follow this checklist!**
