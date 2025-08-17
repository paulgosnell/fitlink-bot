 # Fitlink Bot & WebApp — Product Requirements Document (PRD)

Status: Source of truth for delivery. Keep updated with any change.
Last Updated: 2025-08-17

## 1. Purpose & Goals
- Provide a Telegram-first AI health coaching experience with OAuth integrations (Oura, Strava) and a lightweight WebApp dashboard.
- Maintain a stable two-layer architecture: Netlify Edge Function proxies + Supabase Edge Functions (business logic).
- Deliver personalized morning briefings using real health data from connected devices.

Success Criteria:
- Telegram webhook responds < 1000 ms with 200 OK.
- OAuth start/callback flows succeed end-to-end and store tokens.
- Dashboard loads authenticated UI for a Telegram user within 2s; shows data when available.
- Morning briefings successfully use real sleep and activity data for personalized recommendations.

## 2. High-Level Architecture

### Two-Layer Proxy Architecture (CRITICAL - DO NOT MODIFY)
```
External Requests → Netlify Edge Functions (add auth) → Supabase Edge Functions (business logic) → PostgreSQL
```

**Why this architecture exists:** External services (Telegram webhooks, OAuth providers) cannot send custom `Authorization: Bearer` headers that Supabase Edge Functions require. Netlify proxies solve this by adding authentication headers before forwarding requests.

### Core Components
- **Netlify Edge Functions** (Authentication Proxies): Add Authorization header and forward traffic to Supabase
  - `oauth-oura-proxy.js` - Handles Oura OAuth flows  
  - `oauth-strava-proxy.js` - Handles Strava OAuth flows
  - `telegram-proxy.js` - Handles Telegram webhook traffic
  - **CRITICAL**: All proxies use hardcoded Supabase URLs and multiple environment variable access patterns

- **Supabase Edge Functions** (Business Logic): All application logic and database access
  - `daily-briefings` - Generates AI-powered morning briefings (scheduled hourly)
  - `pre-briefing-sync` - Syncs health data before briefings (scheduled :50 past hour)
  - `telegram-webhook` - Processes bot commands and interactions
  - `oauth-oura` / `oauth-strava` - Complete OAuth flows with token storage
  - `data-sync-oura` / `data-sync-strava` - Manual and automatic data synchronization

- **Supabase PostgreSQL**: Data persistence with Row Level Security (RLS)
  - Health data tables with mixed UUID/bigint ID patterns
  - OAuth token storage with automatic refresh capabilities
  - Briefing logs and analytics tracking

### Data Flow Examples
1. **OAuth Flow**: User clicks → Netlify proxy (adds auth) → Supabase function → Provider API → Token storage
2. **Telegram Commands**: Webhook → Netlify proxy → Supabase telegram-webhook → Database → Response
3. **Morning Briefings**: Cron trigger → Pre-sync health data → AI analysis → Telegram delivery
4. **Dashboard**: WebApp → Netlify proxy → Supabase user-lookup → Database → JSON response

### Scheduled Operations
- **Daily Briefings**: `0 * * * *` (hourly) - Checks each user's local time against their `briefing_hour`
- **Pre-briefing Sync**: `50 * * * *` (hourly at :50) - Syncs health data 10 minutes before briefings

**Architecture Documentation**: See `docs/FITLINK_ARCHITECTURE.md` for detailed technical specifications.

## 3. Current Database Schema

### Core Tables (Production Schema)
- **`users`**: `id` (uuid), `telegram_id` (bigint), timezone, briefing_hour, training_goal
- **`providers`**: OAuth tokens and status for Oura/Strava connections  
- **`oura_sleep`**: Sleep data with `total_sleep_duration` (numeric hours), `sleep_score`
- **`strava_activities`**: Activity data with `activity_id` (bigint), `start_date`, `moving_time`
- **`env_daily`**: Weather data for exercise recommendations (uses `user_id` as bigint = telegram_id)

### Key Schema Notes
- **Mixed ID Types**: Core tables use UUID for `user_id`, but some auxiliary tables (`env_daily`, legacy tables) use `telegram_id` (bigint)
- **Duration Fields**: Sleep data stored as `*_duration` in decimal hours, not `*_minutes` as originally planned
- **Activity Tables**: Uses `strava_activities` table, not generic `activities` table

## 4. Functional Scope
### 3.0 MVP Features & Functions (Phase 1)
#### Morning AI Briefing (Personalized Health Coaching)
- **Trigger**: Supabase cron job `daily-briefings` runs hourly, sends briefings to users at their local `briefing_hour`
- **Data Sources**: 
  - **Oura Ring**: Sleep metrics from `oura_sleep` table (sleep_score, total_sleep_duration, sleep_efficiency)
  - **Strava**: Recent activities from `strava_activities` table (moving_time, average_heartrate, training load)
  - **Weather**: Today's conditions from `env_daily` table (temperature, conditions for exercise timing)
  - **User Profile**: Age, training goals, timezone, preferences from `users` table
- **AI Engine**: 
  - Primary: `shared/ai/briefing.ts` with Claude 3.5 Sonnet or GPT-4 for personalized insights
  - Advanced: `shared/ai/health-summarizer.ts` for 30-day pattern analysis and trend detection
  - Generates data-driven insights, training recommendations, and actionable micro-habits
- **Output**: 
  - Concise briefing (120-180 words) with personalized health insights
  - 2-3 specific micro-habits with timing ("at 2pm", "before bed")
  - Weather-integrated exercise recommendations
  - Early warning system for overtraining/illness signals
- **Delivery**: Telegram message with inline keyboard for feedback collection
- **Logging**: `brief_logs` table tracks success/error status, AI model used, data sources available
- **Fallbacks**: If no provider data available, sends generic health tips with connection prompts

#### Health Data Integration & Sync
- **OAuth Flow**: Secure token storage with automatic refresh handling for Oura and Strava
- **Data Sync Strategy**: 
  - **Pre-briefing sync**: `pre-briefing-sync` function runs 50 minutes past each hour to fetch fresh data
  - **Manual sync**: `/sync_oura` and `/sync_strava` commands for immediate updates
  - **Automatic refresh**: Token refresh handled automatically when tokens near expiry
- **Data Storage**: Comprehensive health metrics in normalized tables (oura_sleep, strava_activities, env_daily)

#### WebApp Dashboard (Health Overview)
- **Authentication**: Telegram WebApp context with secure user lookup via service role
- **Data Display**: 
  - Recent sleep trends (up to 30 days from `oura_sleep`)
  - Recent activities (up to 50 from `strava_activities`) 
  - Provider connection status with troubleshooting guidance
  - Empty state guidance when no data available
- **Technical Implementation**: Uses `oauth-test/user-lookup` via Netlify proxy for data fetching
- **Actions**: Send feedback, reconnect providers, view detailed metrics

#### Telegram Bot Interface
- **Core Commands**: 
  - `/start` - Welcome message and system status overview
  - `/status` - Provider connection health and last sync times
  - `/connect_oura` - Initiate Oura OAuth flow
  - `/connect_strava` - Initiate Strava OAuth flow
  - `/brief` - Request immediate morning briefing (bypasses schedule)
  - `/sync_oura` / `/sync_strava` - Manual data sync triggers
- **Interactive Features**: Inline keyboards, callback handling, rich messaging with provider status
- **Webhook Architecture**: Receives updates via Netlify proxy at `/api/telegram-webhook`

#### Feedback Collection & Analytics
- **Collection Method**: Dashboard feedback sent via Telegram WebApp bridge to bot
- **Storage**: Logged to `brief_logs` with structured feedback fields
- **Analytics**: Track briefing effectiveness and user engagement patterns

- Health Data View (WebApp Dashboard)
  - Data shown: recent sleep (≤30 days), recent activities (≤50), integration status, empty state if none
  - Source: `oauth-test/user-lookup` service role query; rendered by `web/public/dashboard.js`
  - Actions: send feedback; link back to bot; retry auth

- OAuth Integrations
  - Oura: `/oauth-oura/start` → provider → `/oauth-oura/callback` → store tokens in `providers`
  - Strava: `/oauth-strava/start` → provider → `/oauth-strava/callback` → store tokens
  - Success pages deep‑link back to Telegram `/start=status`

- Telegram Chat Basics
  - Commands: `/start`, `/status`, `/connect_oura`, `/connect_strava`
  - Ad‑hoc Q&A: MVP responds using available metrics and canned analyses; later can route to AI for free‑form chat

- Feedback Collection
  - From dashboard: sends structured payload back to the bot via Telegram WebApp bridge
  - Logged to `brief_logs` (feedback fields) and/or separate feedback table

Acceptance Criteria (MVP)
- Briefing sent at 07:00 ±5m local for active users; ≥99% success day‑over‑day
- If no connected data, user still receives a useful morning message with connect CTA
- Dashboard loads within 2s; if no data, shows “Authenticated – connect devices” state
- OAuth start/callback work end‑to‑end; tokens persisted and encrypted
- Telegram webhook returns 200 to provider test pings and real traffic

### 4.1 Telegram Bot
- Receives messages via webhook: `/api/telegram-webhook` (Netlify proxy → Supabase `telegram-webhook`).
- Commands: `/start`, `/connect_oura`, `/connect_strava`, `/status`, feedback actions.
- Uses Supabase service role (inside function) to read/write DB.
- Provider status detection: centralized via `getUserProviderStatus()` helper in `shared/database/provider-status.ts` that returns `{oura: boolean, strava: boolean}` from single DB query.

### 4.2 OAuth Integrations
- Oura: `/oauth-oura/start` → provider → `/oauth-oura/callback` → store tokens.
- Strava: `/oauth-strava/start` → provider → `/oauth-strava/callback` → store tokens.
- Redirect to Telegram deep link `https://t.me/the_fitlink_bot?start=status` on success.

### 4.3 WebApp Dashboard
- Hosted at Netlify (`web/public`).
- Auth: derives Telegram user ID from WebApp context; POSTs to `oauth-test/user-lookup` (via proxy or direct if JWT disabled) to fetch profile + health snapshot; shows empty state when none.

## 5. Non-Functional Requirements
- Availability: 99.9% monthly; proxies must not be removed.
- Security: No credentials in client code; tokens encrypted at rest; JWT disabled only for public endpoints.
- Observability: Minimal logging in functions; health endpoints for probes.

## 6. Interfaces & Routes
### Public (via Netlify)
- POST `/api/telegram-webhook` → Supabase `telegram-webhook`
- GET `/oauth-oura/start|/callback` → Supabase `oauth-oura`
- GET `/oauth-strava/start|/callback` → Supabase `oauth-strava`

### Supabase Edge Functions
- `telegram-webhook`: POST updates, `POST /set-webhook`, `GET /healthz`
- `oauth-oura`: `GET /start`, `GET /callback`
- `oauth-strava`: `GET /start`, `GET /callback`
- `data-sync-oura`: POST service-only sync; supports `{ user_id }` for targeted sync; used before briefings
- `data-sync-strava`: POST service-only sync; supports `{ user_id }` for targeted sync; used before briefings
- `pre-briefing-sync`: POST service-only cron at :50 past each hour to prefetch per-user data 10 minutes before briefing
- `oauth-test`: `POST /user-lookup` (service role DB access)

## 7. Configuration
- Netlify: `netlify.toml` maps edge functions for routes above.
  - Environment: Requires `VITE_SUPABASE_ANON_KEY` set in Netlify dashboard (not `SUPABASE_ANON_KEY`)
- Supabase functions: each has `config.toml` with `verify_jwt=false` and explicit routing when public.
- Secrets: stored in Supabase project; CI uses `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

## 8. CI/CD
- Push to `main` triggers GitHub Actions to deploy all Supabase functions with appropriate flags; Netlify auto-builds proxies + static.

Schedules (configure in Supabase Scheduled Triggers):
- `daily-briefings`: `0 * * * *` (hourly). Generates briefings for users whose local hour matches `users.briefing_hour`.
- `pre-briefing-sync`: `50 * * * *` (hourly at :50). Pulls Oura/Strava data for users whose local time is 10 minutes before their `briefing_hour`.

## 9. Operational Playbooks
### 8.1 Telegram webhook set
- Preferred: call `POST /api/telegram-webhook` once proxies live, or call Supabase function `/set-webhook`.

### 8.2 Health checks
- `GET https://fitlinkbot.netlify.app/api/telegram-webhook` (POST returns 200 ok)
- `GET https://fitlinkbot.netlify.app/oauth-oura/start?user_id=TEST` → 302

## 10. Change Control
- Any change affecting routes, proxies, or JWT must update this PRD and `FITLINK_ARCHITECTURE.md`.

## 11. Related Documents & Links
- Bot Commands: `docs/BOT_COMMANDS.md`
- Integration Guide: `docs/INTEGRATION_GUIDE.md`
- Integration Status: `docs/INTEGRATION_STATUS.md`
- Future Integrations (Roadmap): `docs/FUTURE_INTEGRATIONS.md`

## 12. Bot Commands (MVP Scope & Hook‑up Status)
- `/start` — welcome + status check [MVP: wire to `telegram-webhook`]
- `/status` — show connected providers + last sync [MVP]
- `/connect_oura` — returns OAuth start link [MVP]
- `/connect_strava` — returns OAuth start link [MVP]
- `/help` — list commands [MVP]
- Feedback actions (from dashboard) — deliver to bot inbox [MVP]

See full command list and planned behaviors in `docs/BOT_COMMANDS.md`.

## 13. Integration Status (Executive Summary)
- Oura: start/callback implemented; storing tokens in `providers`; proxy route in Netlify; config `verify_jwt=false` present.
- Strava: start/callback implemented similarly; proxy plus config in place.
- Telegram Webhook: `telegram-webhook` function live; Netlify proxy path `/api/telegram-webhook`.
- Dashboard: uses `oauth-test/user-lookup` for snapshot; empty-state handling in place when 404/401.

Detailed status with owners and dates: `docs/INTEGRATION_STATUS.md`.

## 14. Integration Guide (Build/Run)
Follow `docs/INTEGRATION_GUIDE.md` for provider app setup, environment variables, and local testing steps.

## 15. Future Integrations (Roadmap)
Planned: Whoop, Garmin, Polar, Apple Health (via HealthKit export), Google Fit. See `docs/FUTURE_INTEGRATIONS.md` for sequence and scoping.

## 16. Known Bugs & Issues (RESOLVED)
- ✅ OAuth redirect URI mismatch - FIXED: Hardcoded Netlify URLs in Supabase functions
- ✅ HTML showing as plain text - FIXED: Proxy detects and fixes Content-Type headers
- ✅ Uncaught exceptions in Edge Functions - FIXED: Multiple env var access methods
- ✅ Public functions sometimes redeploy without `verify_jwt=false` → 401. Mitigation: configs added; CI uses `--no-verify-jwt`.
- ✅ Dashboard now calls server via Netlify proxy (`/oauth-test/user-lookup`); no Supabase keys in client.
- ✅ Netlify Edge proxies require `VITE_SUPABASE_ANON_KEY` environment variable set in Netlify dashboard.
- ✅ Pre‑briefing sync job implemented/scheduled ([#9](https://github.com/paulgosnell/fitlink-bot/issues/9), [#12](https://github.com/paulgosnell/fitlink-bot/issues/12)).
- ✅ Strava data sync function added ([#10](https://github.com/paulgosnell/fitlink-bot/issues/10)).
- ✅ Token refresh implemented for Oura/Strava ([#11](https://github.com/paulgosnell/fitlink-bot/issues/11)).
- ✅ Provider connection status detection - FIXED: Added explicit `is_active: true` when creating new providers; centralized status checking via `getUserProviderStatus()` helper.

## 16.1 Critical OAuth Requirements (DO NOT BREAK)
- **Netlify Proxy Pattern**: ALL OAuth flows MUST go through Netlify Edge Function proxies
- **Hardcoded URLs**: NEVER use BASE_URL env var; always hardcode `https://fitlinkbot.netlify.app`
- **Content-Type Detection**: Proxies MUST detect HTML and override Content-Type header
- **Environment Variables**: Use VITE_SUPABASE_ANON_KEY with multiple access methods
- **Redirect Handling**: Must use `redirect: 'manual'` and handle 3xx status codes

## 17. MVP Launch Task List
  - [x] Replace hardcoded anon key in Netlify Edge proxies with env var; rotate keys (oauth proxies use `VITE_SUPABASE_ANON_KEY` env from Netlify) ([#1](https://github.com/paulgosnell/fitlink-bot/issues/1))
  - [x] Remove any service role usage from dashboard client code
  - [x] Verify CI deploys all public endpoints with JWT disabled and configs included
  - [x] Re‑enable Telegram webhook secret validation and set webhook to pretty route
  - [x] Configure Supabase schedules: `daily-briefings` (0 * * * *), `pre-briefing-sync` (50 * * * *) ([#12](https://github.com/paulgosnell/fitlink-bot/issues/12))
  - [x] Deploy and verify `data-sync-oura` function
  - [x] Implement, deploy and verify `data-sync-strava` function ([#10](https://github.com/paulgosnell/fitlink-bot/issues/10))
  - [x] Implement, deploy and verify `pre-briefing-sync` function ([#9](https://github.com/paulgosnell/fitlink-bot/issues/9))
  - [x] Configure Supabase schedule: daily `data-sync-oura` (03:10 UTC)
  - [x] Validate pre-briefing sync pulls Oura/Strava data 10 minutes before each user’s `briefing_hour` (timezone correct) ([#9](https://github.com/paulgosnell/fitlink-bot/issues/9)) — implemented; schedule configured
  - [x] Validate token refresh and DB update on expiry for Oura and Strava ([#11](https://github.com/paulgosnell/fitlink-bot/issues/11))
  - [x] Verify initial backfill triggers post-OAuth for both providers
  - [x] Verify manual sync commands: `/sync_oura`, `/sync_strava` (both call server functions via `BASE_URL`)
  - [x] Complete `/status` command implementation to surface connection health
  - [x] Finish dashboard integration status cards and error handling ([#13](https://github.com/paulgosnell/fitlink-bot/issues/13))
  - [x] Route dashboard data via Netlify proxy `oauth-test-proxy` and remove Supabase SDK from client
  - [x] Smoke tests: OAuth start/callback (Oura/Strava), webhook POST 200, dashboard load <2s ([#14](https://github.com/paulgosnell/fitlink-bot/issues/14)) — includes token refresh coverage
  - [ ] Create runbook: rollback, rotate secrets, redeploy ([#15](https://github.com/paulgosnell/fitlink-bot/issues/15))


