# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `deno task dev` - Start local Supabase Edge Functions server with env vars
- `deno task deploy` - Deploy all functions to Supabase
- `deno task test` - Run all unit tests with Deno
- `deno task lint` - Lint TypeScript code 
- `deno task fmt` - Format TypeScript code

### Database Operations  
- `supabase start` - Start local Supabase instance
- `supabase db reset` - Reset local database to migrations
- `supabase db push` - Push schema changes to remote

### Testing & Scripts
- `./scripts/setup.sh` - Initial project setup
- `./scripts/deploy.sh` - Production deployment
- `./scripts/test.sh` - Comprehensive test runner
- `./test-polling.sh` - Test Telegram polling webhook

## Architecture Overview

### Runtime Environment
- **Platform**: Supabase Edge Functions (Deno runtime)
- **Language**: TypeScript with strict mode
- **Framework**: Hono for HTTP routing and middleware
- **Database**: PostgreSQL with Row Level Security

### Function Structure
```
supabase/functions/
├── telegram-webhook/     # Main bot webhook handler
├── telegram-poll/        # Polling fallback for webhooks  
├── daily-briefings/      # Cron job for scheduled briefings
├── oauth-oura/          # Oura Ring OAuth flow
├── oauth-strava/        # Strava OAuth flow
└── shared/              # Common utilities and types
    ├── types.ts         # TypeScript interfaces
    ├── telegram/        # Bot API and message handling
    ├── database/        # Database operations
    ├── ai/             # AI briefing generation
    └── utils/          # Encryption and utilities
```

### Data Architecture
- **Users**: Telegram profiles with timezone and preferences
- **Providers**: Encrypted OAuth tokens for Oura/Strava
- **Sleep Data**: Oura Ring metrics (HRV, efficiency, readiness)
- **Activities**: Strava workouts with TSS estimation
- **Environmental**: Weather data with exercise windows
- **Briefing Logs**: AI generation tracking and user feedback

### Key Design Patterns

#### Shared Module System
All functions import from `../shared/` for consistency:
- `types.ts` - Complete TypeScript interfaces
- `telegram.ts` - Bot API wrapper with error handling
- `database/` - Typed database operations with RLS
- `ai/briefing.ts` - Structured AI prompt generation

#### Security Model
- OAuth tokens encrypted with AES-256 at rest
- Row Level Security enforces user data isolation
- Telegram webhook requires secret token validation
- Environment variables for all sensitive configuration

#### Error Handling
- Functions return proper HTTP status codes
- Database operations wrapped in try/catch
- Telegram API failures logged but don't crash functions
- AI generation failures fall back to basic templates

### Testing Strategy
- Unit tests in `tests/unit/` using Deno test framework
- Integration tests focus on webhook endpoints
- Encryption utilities have comprehensive test coverage
- Database operations tested against local Supabase instance

## Health Data Pipeline

### Oura Integration
- OAuth flow handles token refresh automatically
- Sleep data fetched nightly via cron job
- HRV trends calculated with 7-day rolling averages
- Temperature deviation flags potential illness

### Strava Integration  
- Real-time activity webhooks for immediate data
- TSS (Training Stress Score) estimated from duration/heart rate
- Weekly load comparisons against user averages
- Activity type classification for appropriate recommendations

### AI Briefing Generation
- Structured prompts combine sleep, training, and weather data
- Safety guardrails prevent overtraining recommendations
- Personalized based on user's training goals and history
- Feedback loop improves recommendations over time

## Environment Configuration

### Required Environment Variables
- `TELEGRAM_BOT_TOKEN` - Bot API token from @BotFather
- `WEBHOOK_SECRET` - Secret for webhook URL validation
- `OURA_CLIENT_ID` / `OURA_CLIENT_SECRET` - OAuth credentials
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` - OAuth credentials  
- `OPENWEATHER_API_KEY` - Weather data API
- `OPENAI_API_KEY` - AI briefing generation
- `ENCRYPTION_KEY` - AES-256 key for token encryption

### Database Configuration
- RLS policies enforce user data isolation
- Migrations in `supabase/migrations/` 
- Views for performance optimization (weekly_load_view, sleep_recent_view)
- Cron jobs configured in Supabase dashboard for daily briefings