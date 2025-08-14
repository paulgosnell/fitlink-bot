 # Fitlink Bot & WebApp — Product Requirements Document (PRD)

Status: Source of truth for delivery. Keep updated with any change.
Last Updated: 2025-08-14

## 1. Purpose & Goals
- Provide a Telegram-first coaching experience with OAuth integrations (Oura, Strava) and a lightweight WebApp dashboard.
- Maintain a stable two-layer architecture: Netlify Edge Function proxies + Supabase Edge Functions (business logic).

Success Criteria:
- Telegram webhook responds < 1000 ms with 200 OK.
- OAuth start/callback flows succeed end-to-end and store tokens.
- Dashboard loads authenticated UI for a Telegram user within 2s; shows empty state if no data.

## 2. High-Level Architecture
- Netlify Edge Functions (proxies) add Authorization header and forward public traffic to Supabase Edge Functions.
- Supabase Edge Functions contain all business logic and DB access.
- Supabase Postgres stores users, providers, health data, logs; RLS enforced; service role used by functions.

See diagram at `docs/diagrams/architecture.mmd`.

## 3. Functional Scope
### 3.0 MVP Features & Functions (Phase 1)
- Morning AI Briefing (7:00 user local time)
  - Inputs: Oura (sleep, readiness, HR), Strava (recent activities), user profile (age, training_goal), location (city/timezone), recent history (last 30 days), weather (today)
  - Engine: Supabase function `daily-briefings` uses `shared/ai/briefing.ts` and `shared/ai/health-summarizer.ts`
  - Output: concise briefing (120–180 words) + 2–3 micro‑habits; tone supportive; links/buttons if relevant
  - Delivery: Telegram message to the user
  - Logging: `brief_logs` row with success/error, tokens used
  - Fallbacks: If no provider data, send “authenticated but no data” variant with connect prompts
  - Config: default hour 7; per‑user `users.briefing_hour` respected

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

### 3.1 Telegram Bot
- Receives messages via webhook: `/api/telegram-webhook` (Netlify proxy → Supabase `telegram-webhook`).
- Commands: `/start`, `/connect_oura`, `/connect_strava`, `/status`, feedback actions.
- Uses Supabase service role (inside function) to read/write DB.

### 3.2 OAuth Integrations
- Oura: `/oauth-oura/start` → provider → `/oauth-oura/callback` → store tokens.
- Strava: `/oauth-strava/start` → provider → `/oauth-strava/callback` → store tokens.
- Redirect to Telegram deep link `https://t.me/the_fitlink_bot?start=status` on success.

### 3.3 WebApp Dashboard
- Hosted at Netlify (`web/public`).
- Auth: derives Telegram user ID from WebApp context; POSTs to `oauth-test/user-lookup` (via proxy or direct if JWT disabled) to fetch profile + health snapshot; shows empty state when none.

## 4. Non-Functional Requirements
- Availability: 99.9% monthly; proxies must not be removed.
- Security: No credentials in client code; tokens encrypted at rest; JWT disabled only for public endpoints.
- Observability: Minimal logging in functions; health endpoints for probes.

## 5. Interfaces & Routes
### Public (via Netlify)
- POST `/api/telegram-webhook` → Supabase `telegram-webhook`
- GET `/oauth-oura/start|/callback` → Supabase `oauth-oura`
- GET `/oauth-strava/start|/callback` → Supabase `oauth-strava`

### Supabase Edge Functions
- `telegram-webhook`: POST updates, `POST /set-webhook`, `GET /healthz`
- `oauth-oura`: `GET /start`, `GET /callback`
- `oauth-strava`: `GET /start`, `GET /callback`
- `data-sync-oura`: POST service-only sync; supports `{ user_id, days_back }` (1–30, default 2) for targeted/backfill sync; used before briefings
- `data-sync-strava`: POST service-only sync; supports `{ user_id }` for targeted sync; used before briefings
- `pre-briefing-sync`: POST service-only cron at :50 past each hour to prefetch per-user data 10 minutes before briefing
- `oauth-test`: `POST /user-lookup` (service role DB access)

## 6. Configuration
- Netlify: `netlify.toml` maps edge functions for routes above.
- Supabase functions: each has `config.toml` with `verify_jwt=false` and explicit routing when public.
- Secrets: stored in Supabase project; CI uses `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

## 7. CI/CD
- Push to `main` triggers GitHub Actions to deploy all Supabase functions with appropriate flags; Netlify auto-builds proxies + static.

Schedules (configure in Supabase Scheduled Triggers):
- `daily-briefings`: `0 * * * *` (hourly). Generates briefings for users whose local hour matches `users.briefing_hour`.
- `pre-briefing-sync`: `50 * * * *` (hourly at :50). Pulls Oura/Strava data for users whose local time is 10 minutes before their `briefing_hour`.
 - `data-sync-oura`: `10 3 * * *` (daily 03:10 UTC). Refreshes Oura `daily_sleep`/`daily_readiness` for all active Oura users with `days_back=2` by default. A deeper initial backfill (`days_back=30`) is triggered automatically post‑OAuth.

## 8. Operational Playbooks
### 8.1 Telegram webhook set
- Preferred: call `POST /api/telegram-webhook` once proxies live, or call Supabase function `/set-webhook`.

### 8.2 Health checks
- `GET https://fitlinkbot.netlify.app/api/telegram-webhook` (POST returns 200 ok)
- `GET https://fitlinkbot.netlify.app/oauth-oura/start?user_id=TEST` → 302

## 9. Change Control
- Any change affecting routes, proxies, or JWT must update this PRD and `FITLINK_ARCHITECTURE.md`.

## 10. Related Documents & Links
- Bot Commands: `docs/BOT_COMMANDS.md`
- Integration Guide: `docs/INTEGRATION_GUIDE.md`
- Integration Status: `docs/INTEGRATION_STATUS.md`
- Future Integrations (Roadmap): `docs/FUTURE_INTEGRATIONS.md`

## 11. Bot Commands (MVP Scope & Hook‑up Status)
- `/start` — welcome + status check [MVP: wire to `telegram-webhook`]
 - `/status` — show provider connections, last sync, and token expiry [MVP]
- `/connect_oura` — returns OAuth start link [MVP]
- `/connect_strava` — returns OAuth start link [MVP]
- `/help` — list commands [MVP]
- Feedback actions (from dashboard) — deliver to bot inbox [MVP]

See full command list and planned behaviors in `docs/BOT_COMMANDS.md`.

## 12. Integration Status (Executive Summary)
- Oura: start/callback implemented; storing tokens in `providers`; proxy route in Netlify; config `verify_jwt=false` present.
- Strava: start/callback implemented similarly; proxy plus config in place.
- Telegram Webhook: `telegram-webhook` function live; Netlify proxy path `/api/telegram-webhook`.
- Dashboard: uses `oauth-test/user-lookup` for snapshot; empty-state handling in place when 404/401.

Detailed status with owners and dates: `docs/INTEGRATION_STATUS.md`.

## 13. Integration Guide (Build/Run)
Follow `docs/INTEGRATION_GUIDE.md` for provider app setup, environment variables, and local testing steps.

## 14. Future Integrations (Roadmap)
Planned: Whoop, Garmin, Polar, Apple Health (via HealthKit export), Google Fit. See `docs/FUTURE_INTEGRATIONS.md` for sequence and scoping.

## 15. Known Bugs & Issues
- Public functions sometimes redeploy without `verify_jwt=false` → 401. Mitigation: configs added; CI uses `--no-verify-jwt`.
  - Dashboard now calls server via Netlify proxy (`/oauth-test/user-lookup`); no Supabase keys in client. Anon/service role use is confined to server functions.
- Netlify Edge proxies currently use a hardcoded anon key; move to Netlify env var immediately.
- ~~Telegram webhook secret validation disabled; re‑enable once stable via header/secret.~~ ✅ Fixed: Now validates via X-Telegram-Bot-Api-Secret-Token header.
 - ~~Oura data sync lacks scheduled cron; only manual sync via bot.~~ ✅ Fixed: Daily schedule configured (03:10 UTC) and post‑OAuth backfill enabled.
- Migration history drift previously observed; ensure `supabase migration repair` reflects real state.

## 16. MVP Launch Task List
  - [ ] Replace hardcoded anon key in Netlify Edge proxies with env var; rotate keys (oauth proxies already use `SUPABASE_ANON_KEY` env; ensure set in Netlify)
- [x] Remove any service role usage from dashboard client code
- [x] Verify CI deploys all public endpoints with JWT disabled and configs included
- [x] Re‑enable Telegram webhook secret validation and set webhook to pretty route
- [ ] Configure Supabase schedules: `daily-briefings` (0 * * * *), `pre-briefing-sync` (50 * * * *)
- [x] Deploy and verify `data-sync-oura`, `data-sync-strava`, `pre-briefing-sync` functions
- [x] Configure Supabase schedule: daily `data-sync-oura` (03:10 UTC)
- [ ] Validate pre-briefing sync pulls Oura/Strava data 10 minutes before each user’s `briefing_hour` (timezone correct)
- [ ] Validate token refresh and DB update on expiry for Oura and Strava
- [x] Verify initial backfill triggers post-OAuth for both providers
- [x] Verify manual sync commands: `/sync_oura`, `/sync_strava`
- [x] Complete `/status` command implementation to surface connection health
  - [ ] Finish dashboard integration status cards and error handling
  - [x] Route dashboard data via Netlify proxy `oauth-test-proxy` and remove Supabase SDK from client
- [ ] Smoke tests: OAuth start/callback (Oura/Strava), webhook POST 200, dashboard load <2s
- [ ] Create runbook: rollback, rotate secrets, redeploy


