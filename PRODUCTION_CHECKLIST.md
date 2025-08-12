# ✅ Production Deployment Checklist

## Pre-Deployment

### 1. API Credentials Setup
- [ ] Telegram Bot Token obtained from @BotFather
- [ ] Anthropic API Key (Claude) with sufficient credits
- [ ] Oura API Client ID & Secret configured
- [ ] Strava API Client ID & Secret configured  
- [ ] OpenWeatherMap API Key obtained
- [ ] Supabase project created and configured

### 2. Environment Configuration
- [ ] `.env.local` created with all required variables
- [ ] ENCRYPTION_KEY generated (32 characters)
- [ ] WEBHOOK_SECRET created (secure random string)
- [ ] BASE_URL points to your Supabase project

### 3. Database Setup
- [ ] Supabase project linked via CLI
- [ ] `schema.sql` executed successfully
- [ ] Row Level Security policies active
- [ ] Database tables created and accessible

## Deployment Steps

### 4. Edge Functions
- [ ] `telegram` function deployed successfully
- [ ] `oauth-oura` function deployed successfully
- [ ] `oauth-strava` function deployed successfully
- [ ] All environment variables set in Supabase Dashboard

### 5. External Integrations
- [ ] Telegram webhook URL configured
- [ ] Oura OAuth redirect URI set to: `https://{PROJECT_REF}.supabase.co/functions/v1/oauth-oura`
- [ ] Strava OAuth redirect URI set to: `https://{PROJECT_REF}.supabase.co/functions/v1/oauth-strava`

## Post-Deployment Testing

### 6. Basic Functionality
- [ ] Bot responds to `/start` command
- [ ] Menu buttons work correctly
- [ ] Health keyword detection triggers AI suggestions
- [ ] "Ask Health Question" button activates AI mode

### 7. OAuth Flows
- [ ] Oura Ring connection completes successfully
- [ ] Strava account connection completes successfully
- [ ] OAuth tokens stored securely in database
- [ ] Connected devices show in `/status` command

### 8. AI Integration
- [ ] Claude AI responds to health questions
- [ ] Daily briefings generate successfully
- [ ] Conversation state management works
- [ ] Session timeouts function correctly

### 9. Security Verification
- [ ] Webhook secret validation working
- [ ] RLS policies preventing data leaks
- [ ] OAuth tokens encrypted in database
- [ ] Error messages don't expose sensitive data

## Monitoring Setup

### 10. Observability
- [ ] Supabase function logs accessible
- [ ] Database queries monitored
- [ ] API usage tracking configured
- [ ] Error alerting setup (optional)

## Performance Optimization

### 11. Cost Management
- [ ] AI keyword detection reducing unnecessary Claude calls
- [ ] Database indexes on frequently queried columns
- [ ] Function cold start times acceptable
- [ ] API rate limits respected

## Production Launch

### 12. Go Live
- [ ] Bot username shared with users
- [ ] Documentation links provided
- [ ] Support channels established
- [ ] Backup procedures documented

---

## Quick Health Check Commands

```bash
# Test bot API
curl "https://api.telegram.org/bot{BOT_TOKEN}/getMe"

# Test webhook endpoint
curl "https://{PROJECT_REF}.supabase.co/functions/v1/telegram/health"

# Test database connection
# (Run in Supabase SQL editor)
SELECT COUNT(*) FROM users;
```

## Emergency Procedures

**If bot stops responding:**
1. Check Supabase function logs
2. Verify webhook is still set: `/getWebhookInfo`
3. Redeploy functions if needed
4. Check API quotas (Anthropic, Oura, Strava)

**If OAuth fails:**
1. Verify redirect URIs in provider settings
2. Check environment variables in Supabase
3. Test OAuth URLs manually
4. Review function logs for errors

**If AI not working:**
1. Check Anthropic API key and credits
2. Verify environment variables
3. Test with simple health question
4. Review Claude API logs

---

**✅ All items checked = Production ready!** 🚀
