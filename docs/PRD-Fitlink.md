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
- `oauth-test`: `POST /user-lookup` (service role DB access)

## 6. Configuration
- Netlify: `netlify.toml` maps edge functions for routes above.
- Supabase functions: each has `config.toml` with `verify_jwt=false` and explicit routing when public.
- Secrets: stored in Supabase project; CI uses `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

## 7. CI/CD
- Push to `main` triggers GitHub Actions to deploy all Supabase functions with appropriate flags; Netlify auto-builds proxies + static.

## 8. Operational Playbooks
### 8.1 Telegram webhook set
- Preferred: call `POST /api/telegram-webhook` once proxies live, or call Supabase function `/set-webhook`.

### 8.2 Health checks
- `GET https://fitlinkbot.netlify.app/api/telegram-webhook` (POST returns 200 ok)
- `GET https://fitlinkbot.netlify.app/oauth-oura/start?user_id=TEST` → 302

## 9. Change Control
- Any change affecting routes, proxies, or JWT must update this PRD and `FITLINK_ARCHITECTURE.md`.


