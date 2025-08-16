# 🏃‍♂️ Fitlink Bot - AI-Powered Health Assistant

> **Complete Telegram bot that combines Oura Ring sleep data, Strava activities, and Claude AI to provide intelligent health insights.**

[![Deploy](https://img.shields.io/badge/Deploy-Supabase-green)](https://supabase.com)
[![AI](https://img.shields.io/badge/AI-Claude%203%20Haiku-blue)](https://anthropic.com)
[![Health](https://img.shields.io/badge/Health-Oura%20%7C%20Strava-orange)](https://cloud.ouraring.com)

## 🎯 What It Does

- **🟢 Oura Integration**: Sleep quality, HRV, readiness scores
- **🔴 Strava Integration**: Activities, training load, performance metrics  
- **🧠 Claude AI**: Personalized health advice and daily briefings
- **🌤️ Weather Data**: Activity recommendations based on conditions
- **💬 Smart Chat**: Only uses AI when needed (cost-efficient)

## 🚀 Features

### 🧠 **Smart AI System**
- **Keyword Detection**: Automatically detects health-related questions
- **Conversation States**: Manages Q&A sessions efficiently  
- **Cost Optimization**: 80-90% reduction in AI API calls
- **Multiple Triggers**: Commands, buttons, or natural conversation

### 📊 **Health Insights**
- Daily AI-generated briefings with actionable advice
- **Deep Health Analysis**: 30-day trend analysis with predictive insights
- Sleep analysis with recovery recommendations and pattern recognition
- Training load assessment and workout planning with adaptation cycles
- Weather-aware exercise suggestions
- Personalized health Q&A with context
- **Predictive Health Alerts**: Early warning for illness and overtraining
- **Peak Performance Windows**: AI-predicted optimal training days
- **Micro-Habit Suggestions**: Specific, time-bound interventions
- **User Profile Collection**: Age, sex, height, weight for personalized recommendations

### 🔐 **Enterprise Ready**
- Row Level Security (RLS) on all data
- Encrypted OAuth token storage
- GDPR-compliant data handling
- Secure webhook validation

## 📱 **User Experience**

```
User: "I'm feeling tired today"
Bot: 🏃‍♂️ I noticed you mentioned feeling tired! 
     Would you like me to analyze your data?
     [🧠 Yes, get AI advice] [📊 Daily briefing]

User: *clicks AI button*
Bot: 🧠 Health Question Mode Activated
     Ask me anything about health, fitness, or training!

User: "Should I workout today?"
Bot: 🧠 Based on your 6.5h sleep (78% efficiency) and yesterday's 
     45min run, I recommend light active recovery today...
     [🔄 Ask another] [✅ End session]
```

## 🛠️ **Tech Stack**

- **Runtime**: Supabase Edge Functions (Deno + TypeScript)
- **Database**: PostgreSQL with Row Level Security
- **AI**: Claude 3 Haiku via Anthropic API
- **Integrations**: Telegram Bot API, Oura API, Strava API
- **Weather**: OpenWeatherMap API
- **Security**: JWT tokens, encrypted storage, webhook validation

## ⚡ **Quick Deploy**

### 1. **Prerequisites**
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Telegram Bot Token](https://core.telegram.org/bots/tutorial)
- [Anthropic API Key](https://console.anthropic.com/)
- [Oura API Credentials](https://cloud.ouraring.com/oauth/applications)
- [Strava API Credentials](https://developers.strava.com/)

### 2. **Setup Database**
```bash
# Initialize Supabase project
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run database migrations
supabase db push
```

### 3. **Configure Environment**
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your API keys
nano .env.local
```

### 4. **Deploy Functions**
```bash
# Deploy all Edge Functions
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy oauth-oura --no-verify-jwt  
supabase functions deploy oauth-strava --no-verify-jwt
```

### 5. **Validate Schema (Recommended)**
```bash
# Run schema validation to prevent data mismatches
./scripts/validate-schema.sh

# Should show: "✅ Schema validation completed successfully"
```

### 6. **Set Telegram Webhook**
```bash
curl -X POST "https://api.telegram.org/bot{BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://{PROJECT_REF}.supabase.co/functions/v1/telegram-webhook/{WEBHOOK_SECRET}"}'
```

## 📋 **Environment Variables**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret

# OAuth Providers  
OURA_CLIENT_ID=your-oura-client-id
OURA_CLIENT_SECRET=your-oura-client-secret
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret

# External APIs
OPENWEATHER_API_KEY=your-weather-api-key
ANTHROPIC_API_KEY=your-claude-api-key

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
BASE_URL=https://your-project.supabase.co/functions/v1
```

## 🤖 **Available Commands**

- `/start` - Welcome message and setup
- `/brief` - Generate AI daily health summary
- `/deepbrief` - Deep health analysis with 30-day trends
- `/settings` - Manage connections and preferences
- `/help` - Show available commands
- `/pause [days]` - Pause daily briefings
- `/resume` - Resume daily briefings

## 🔍 **Smart AI Detection**

The bot intelligently detects health-related conversations:

**Triggers AI:**
- "I'm tired", "Should I workout?", "How was my sleep?"
- Keywords: sleep, energy, workout, training, recovery, etc.

**Doesn't Trigger:**
- General chat, greetings, thank you messages

## 🔐 **Security Features**

- **Row Level Security**: Users can only see their own data
- **Token Encryption**: OAuth tokens encrypted before storage
- **Webhook Validation**: Secure Telegram webhook endpoint
- **Environment Isolation**: Secrets managed via Supabase Edge Functions

## 🧪 **Testing**

Find your bot on Telegram: `@your_bot_username`

**Test Flow:**
1. Send `/start` to setup
2. Connect Oura and/or Strava accounts
3. Ask: "How did I sleep last night?"
4. Try: "Should I exercise today?"
5. Request: `/brief` for daily summary

## 📚 **Documentation & Schema Reference**

- **[Database Schema Reference](docs/DATABASE_SCHEMA.md)** - Complete table definitions and field mappings
- **[Schema Quick Reference](docs/SCHEMA_QUICK_REF.md)** - Developer quick-start guide
- **[Schema Validation](scripts/validate-schema.sh)** - Prevent data mismatch bugs
- **[Architecture Guide](docs/FITLINK_ARCHITECTURE.md)** - System architecture overview
- **[Deployment Checklist](docs/DEPLOYMENT_SAFETY_CHECKLIST.md)** - Pre-deployment validation

## 🌐 **Web Dashboard**

A beautiful landing page showcasing your bot's features:

### **Deploy Web Dashboard** (Optional)
```bash
# Quick deploy to Vercel/Netlify
./deploy-web.sh

# Or manually upload web/public/ to any static host
```

**Hosting Options:**
- **Vercel** (recommended) - Free tier with custom domains
- **Netlify** - Free tier with form handling
- **GitHub Pages** - Free with GitHub integration  
- **Supabase Storage** - Keep everything in Supabase
- **Any static host** - Just upload the `web/public/` folder

The web dashboard is **purely informational** - all bot functionality runs serverlessly on Supabase Edge Functions. No backend hosting required!

## �️ **Development & Troubleshooting**

### **Schema Validation Tools**
Prevent data mismatch bugs with automated validation:

```bash
# Validate database schema against TypeScript interfaces
./scripts/validate-schema.sh

# Check critical configuration
./scripts/validate-critical-config.sh

# Run post-deployment smoke tests
./scripts/smoke-tests.sh
```

### **Common Issues**
- **"Invalid input syntax for type bigint"** - Check field mappings in [Database Schema](docs/DATABASE_SCHEMA.md)
- **OAuth redirect failures** - Verify URLs in [Architecture Guide](docs/FITLINK_ARCHITECTURE.md)
- **Data sync errors** - Run schema validation and check field transformations

### **Key Developer Files**
- `docs/DATABASE_SCHEMA.md` - Complete schema reference
- `docs/SCHEMA_QUICK_REF.md` - Quick field mapping guide
- `supabase/functions/shared/types.ts` - TypeScript interfaces
- `scripts/validate-schema.sh` - Schema validation tool

## �🚀 **Zero-Server Architecture**

Your entire Fitlink Bot runs without traditional servers:

- **Bot Logic**: Supabase Edge Functions (serverless)
- **Database**: Supabase PostgreSQL (managed)
- **AI Processing**: Claude API (serverless)
- **OAuth Flows**: Edge Functions (serverless)
- **Web Dashboard**: Static files (any CDN)

**Total hosting cost**: Just pay for usage (API calls, database storage)

---

**Built with ❤️ for the health and fitness community**

*Fitlink Bot - Where health data meets AI intelligence* 🚀