# Fitlink Bot 🏃‍♂️

Your AI health brief in Telegram — combining your sleep (Oura), training (Strava), and today's conditions (weather/location) into one actionable morning message.

## 🎯 Core Features

- **Morning Briefings**: Personalised daily health summaries at 07:00 local time
- **Multi-Source Data**: Oura Ring sleep metrics + Strava training load + weather conditions
- **Smart Recommendations**: Evidence-based training plans with safety guardrails
- **Telegram Native**: Full bot experience + lightweight WebApp dashboard
- **Privacy First**: Encrypted tokens, minimal data retention, GDPR compliance

## 🏗️ Architecture

- **Runtime**: Supabase Edge Functions (Deno + TypeScript)
- **Framework**: Hono for HTTP routing
- **Database**: PostgreSQL with Row Level Security
- **Auth**: Telegram user ID + OAuth for health providers
- **Scheduling**: Supabase cron for per-user briefing times
- **AI**: OpenAI/Claude with structured JSON prompts

## 📊 Data Flow

```
Oura Ring ──┐
            ├──► Supabase DB ──► AI Briefing ──► Telegram
Strava ─────┤
            └──► Weather API
```

## 🚀 Quick Start

### Prerequisites
- Supabase account + project
- Telegram Bot Token (via @BotFather)
- Oura + Strava OAuth apps
- OpenWeatherMap API key

### Environment Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Clone and setup
git clone <repo>
cd fitlink-bot
cp .env.example .env.local

# Configure secrets (see .env.example)
# Deploy to Supabase
supabase start
supabase db push
supabase functions deploy
```

### Local Development

```bash
# Start local Supabase
supabase start

# Run edge functions locally
supabase functions serve --env-file .env.local

# Test webhook
curl -X POST http://localhost:54321/functions/v1/telegram/webhook/your-secret \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"/start","chat":{"id":123},"from":{"id":123,"first_name":"Test"}}}'
```

## 🗄️ Database Schema

### Core Tables
- `users` - Telegram user profiles + preferences
- `providers` - OAuth tokens for Oura/Strava
- `oura_sleep` - Sleep metrics + HRV data
- `activities` - Strava workouts + estimated TSS
- `env_daily` - Weather conditions + air quality
- `brief_logs` - Delivery tracking + feedback

### Views
- `weekly_load_view` - Training load summaries
- `sleep_recent_view` - Sleep trends (7-day rolling)

## 🤖 Bot Commands

- `/start` - Connect accounts + set briefing time
- `/brief` - Get today's briefing on-demand
- `/settings` - Manage connections + preferences
- `/pause` - Temporarily disable daily briefs
- `/help` - Usage guide + privacy info

## 📱 WebApp Dashboard

- Real-time health scorecards
- 7-day trend sparklines (HRV, RHR, activity)
- Connection status + re-auth flows
- Briefing history + feedback

## 🔐 Privacy & Security

- **Minimal Data**: Only essential health metrics stored
- **Encryption**: All OAuth tokens encrypted at rest
- **Retention**: Raw API payloads purged after processing
- **User Control**: `/delete` command for immediate data purge
- **No Sharing**: Zero third-party data sharing

## 📈 AI Briefing Structure

```
Good morning Paul 👋
Sleep: 7h 42m (efficiency 89%). HRV trending ↑.
Readiness: 78 (↑ 6 vs avg) — green day.
Training: 4 sessions / 210 TSS this week. Yesterday: 8km easy.
Weather: 14–22°C, ideal for outdoor run 06:30–08:30.
Plan: 40–50 min aerobic (Z2). If short on time: 20 min + strides.
Actions: 500ml water on waking • 5 min mobility.
```

## 🛡️ Safety Guardrails

- Never invent missing data points
- Flag illness/overtraining signals
- Prioritise recovery over performance
- No medical claims - coaching guidance only
- Conservative recommendations for edge cases

## 🎯 Roadmap

### MVP (Current)
- [x] Telegram bot + OAuth flows
- [x] Daily briefing scheduler
- [x] Oura + Strava integration
- [x] Weather API + caching
- [x] Basic WebApp dashboard

### v1 (Next)
- [ ] Advanced training load (TRIMP)
- [ ] HRV trend analysis + warnings
- [ ] Air quality integration
- [ ] Calendar-aware scheduling
- [ ] Weekly progress reports

### v2 (Future)
- [ ] Apple Health / Google Fit
- [ ] Social challenges (opt-in)
- [ ] Habit tracking integration
- [ ] Advanced AI coaching personas

## 🧪 Testing

```bash
# Unit tests
deno test --allow-all

# Integration tests
npm run test:integration

# Load test briefing generation
./scripts/load-test-briefings.sh
```

## 📝 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for evidence-based health optimization.
