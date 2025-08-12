# 🚀 Deployment Guide

## Prerequisites

1. **Supabase Account**: Create at [supabase.com](https://supabase.com)
2. **Telegram Bot**: Create via [@BotFather](https://t.me/BotFather)
3. **API Keys**: Get credentials from:
   - [Anthropic Console](https://console.anthropic.com/)
   - [Oura Cloud](https://cloud.ouraring.com/oauth/applications)
   - [Strava Developers](https://developers.strava.com/)
   - [OpenWeatherMap](https://openweathermap.org/api)

## Step-by-Step Deployment

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/fitlink-bot.git
cd fitlink-bot
```

### 2. Setup Supabase Project
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize project
supabase init

# Create new project or link existing
supabase projects create fitlink-bot
# OR
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Configure Database
```bash
# Apply database schema
supabase db push

# Or manually run schema.sql in Supabase Dashboard
```

### 4. Environment Setup
```bash
# Copy template
cp .env.example .env.local

# Edit with your credentials
nano .env.local
```

**Required Environment Variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key from Supabase
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `ANTHROPIC_API_KEY` - Claude API key
- `OURA_CLIENT_ID` & `OURA_CLIENT_SECRET` - Oura API credentials
- `STRAVA_CLIENT_ID` & `STRAVA_CLIENT_SECRET` - Strava API credentials
- `OPENWEATHER_API_KEY` - Weather API key
- `ENCRYPTION_KEY` - 32-character random string

### 5. Deploy Edge Functions
```bash
# Deploy all functions
supabase functions deploy telegram --project-ref YOUR_PROJECT_REF
supabase functions deploy oauth-oura --project-ref YOUR_PROJECT_REF
supabase functions deploy oauth-strava --project-ref YOUR_PROJECT_REF
```

### 6. Set Function Environment Variables
In Supabase Dashboard → Edge Functions → Environment Variables:
Add all variables from your `.env.local` file.

### 7. Configure Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://{PROJECT_REF}.supabase.co/functions/v1/telegram/webhook/{WEBHOOK_SECRET}"
  }'
```

### 8. Configure OAuth Redirect URIs

**Oura Application Settings:**
- Redirect URI: `https://{PROJECT_REF}.supabase.co/functions/v1/oauth-oura`

**Strava Application Settings:**
- Authorization Callback Domain: `{PROJECT_REF}.supabase.co`
- Redirect URI: `https://{PROJECT_REF}.supabase.co/functions/v1/oauth-strava`

### 9. Test Deployment
1. Find your bot on Telegram: `@your_bot_username`
2. Send `/start` command
3. Test health question: "How did I sleep?"
4. Connect Oura/Strava accounts
5. Request daily briefing

## Monitoring

- **Function Logs**: Supabase Dashboard → Edge Functions → Logs
- **Database**: Supabase Dashboard → Table Editor
- **API Usage**: Check provider dashboards (Anthropic, Oura, Strava)

## Troubleshooting

### Common Issues

**Function deployment fails:**
- Check Supabase CLI version: `supabase --version`
- Verify project linking: `supabase status`

**Webhook not receiving messages:**
- Verify webhook URL is set correctly
- Check function logs for errors
- Ensure TELEGRAM_WEBHOOK_SECRET matches

**OAuth not working:**
- Verify redirect URIs in provider settings
- Check environment variables are set
- Test OAuth URLs manually

**AI not responding:**
- Verify ANTHROPIC_API_KEY is valid
- Check function logs for Claude API errors
- Ensure sufficient API credits

### Support

- Check [SMART_AI_SYSTEM.md](SMART_AI_SYSTEM.md) for AI logic
- Review function logs in Supabase Dashboard
- Test individual endpoints with curl

## Production Checklist

- [ ] Database schema applied
- [ ] All environment variables set
- [ ] Functions deployed successfully  
- [ ] Telegram webhook configured
- [ ] OAuth redirect URIs set
- [ ] Bot responds to `/start`
- [ ] Health questions trigger AI
- [ ] OAuth flows work end-to-end
- [ ] Daily briefings generate correctly

**Your Fitlink Bot should now be live and ready for users!** 🎉
