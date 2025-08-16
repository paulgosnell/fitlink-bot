# Fitlink Bot Database Schema Reference

> **📋 Single Source of Truth for Database Schema**  
> Last Updated: August 16, 2025  
> Always reference this document before adding new fields or modifying existing ones.

## 🎯 Quick Reference

### Core Tables
- [`users`](#users-table) - User accounts and settings
- [`providers`](#providers-table) - OAuth connections (Oura, Strava)
- [`activities`](#activities-table) - Workout/training data
- [`oura_sleep`](#oura_sleep-table) - Sleep tracking data

### Oura Extended Tables
- [`oura_daily_activity`](#oura_daily_activity-table) - Daily activity metrics
- [`oura_daily_stress`](#oura_daily_stress-table) - Stress measurements
- [`oura_heart_rate`](#oura_heart_rate-table) - Heart rate data points
- [`oura_daily_spo2`](#oura_daily_spo2-table) - Blood oxygen levels
- [`oura_temperature`](#oura_temperature-table) - Body temperature
- [`oura_workouts`](#oura_workouts-table) - Oura workout sessions
- [`oura_sessions`](#oura_sessions-table) - Meditation/breathing sessions

---

## 📊 Core Tables

### `users` Table

**Purpose**: Core user accounts and configuration

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | `UUID` | ✅ | Primary key (auto-generated) | `123e4567-e89b-12d3-a456-426614174000` |
| `telegram_id` | `BIGINT` | ✅ | Telegram user ID (unique) | `5269737203` |
| `username` | `TEXT` | ❌ | Telegram username | `@johndoe` |
| `first_name` | `TEXT` | ❌ | User's first name | `John` |
| `timezone` | `TEXT` | ✅ | User timezone | `UTC`, `America/New_York` |
| `city` | `TEXT` | ❌ | User's city for weather | `New York` |
| `briefing_hour` | `INTEGER` | ✅ | Daily briefing time (0-23) | `7` |
| `training_goal` | `TEXT` | ✅ | Training objective | `general_fitness` |
| `is_active` | `BOOLEAN` | ✅ | Account status | `true` |
| `paused_until` | `DATE` | ❌ | Pause briefings until | `2025-08-20` |
| `created_at` | `TIMESTAMPTZ` | ✅ | Account creation | Auto-set |
| `updated_at` | `TIMESTAMPTZ` | ✅ | Last modification | Auto-set |

**Relationships**:
- One-to-many with `providers`
- One-to-many with `activities`
- One-to-many with all `oura_*` tables

**TypeScript Interface**:
```typescript
interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  timezone: string;
  city?: string;
  briefing_hour: number;
  training_goal: string;
  is_active: boolean;
  paused_until?: string;
  created_at: string;
  updated_at: string;
}
```

---

### `providers` Table

**Purpose**: OAuth connections to health platforms

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | `UUID` | ✅ | Primary key | `123e4567-e89b-12d3-a456-426614174000` |
| `user_id` | `UUID` | ✅ | FK to users.id | `123e4567-e89b-12d3-a456-426614174000` |
| `provider` | `provider_type` | ✅ | Platform name | `oura`, `strava` |
| `access_token` | `TEXT` | ✅ | Encrypted OAuth token | `encrypted_data` |
| `refresh_token` | `TEXT` | ❌ | Encrypted refresh token | `encrypted_data` |
| `expires_at` | `TIMESTAMPTZ` | ❌ | Token expiration | `2025-09-16T08:00:00Z` |
| `provider_user_id` | `TEXT` | ❌ | Platform's user ID | `ABCD1234` |
| `scopes` | `TEXT[]` | ❌ | Granted permissions | `["email", "personal", "daily"]` |
| `is_active` | `BOOLEAN` | ✅ | Connection status | `true` |
| `created_at` | `TIMESTAMPTZ` | ✅ | Connection date | Auto-set |
| `updated_at` | `TIMESTAMPTZ` | ✅ | Last token refresh | Auto-set |

**Constraints**:
- `UNIQUE(user_id, provider)` - One connection per platform per user
- `ON DELETE CASCADE` - Remove when user deleted

**TypeScript Interface**:
```typescript
interface Provider {
  id: string;
  user_id: string;
  provider: 'oura' | 'strava';
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  provider_user_id?: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

---

### `activities` Table

**Purpose**: Cross-platform workout/training data

| Column | Type | Required | Description | Example |
|--------|------|----------|-------------|---------|
| `id` | `UUID` | ✅ | Primary key | `123e4567-e89b-12d3-a456-426614174000` |
| `user_id` | `UUID` | ✅ | FK to users.id | `123e4567-e89b-12d3-a456-426614174000` |
| `source` | `TEXT` | ✅ | Data source | `oura`, `strava` |
| `external_id` | `TEXT` | ✅ | Source platform ID | `12345678` |
| `activity_type` | `TEXT` | ✅ | Activity category | `run`, `ride`, `swim` |
| `name` | `TEXT` | ❌ | Activity name | `Morning Run` |
| `start_time` | `TIMESTAMPTZ` | ✅ | Start timestamp | `2025-08-16T06:00:00Z` |
| `duration_seconds` | `INTEGER` | ✅ | Total duration | `3600` |
| `distance_meters` | `INTEGER` | ❌ | Distance covered | `5000` |
| `elevation_gain_meters` | `INTEGER` | ❌ | Elevation climbed | `100` |
| `average_heart_rate` | `INTEGER` | ❌ | Avg HR during activity | `150` |
| `max_heart_rate` | `INTEGER` | ❌ | Peak HR | `180` |
| `average_power` | `INTEGER` | ❌ | Avg watts (cycling) | `250` |
| `weighted_power` | `INTEGER` | ❌ | Normalized power | `260` |
| `tss_estimated` | `DECIMAL(5,1)` | ❌ | Training stress score | `85.5` |
| `intensity_factor` | `DECIMAL(3,2)` | ❌ | Intensity ratio | `0.85` |
| `raw_data` | `JSONB` | ❌ | Original platform data | `{}` |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, source, external_id)` - No duplicate imports

---

## 🏃‍♂️ Oura Sleep Data

### `oura_sleep` Table

**Purpose**: Daily sleep metrics from Oura Ring

| Column | Type | Required | Description | API Source | Conversion |
|--------|------|----------|-------------|------------|------------|
| `id` | `UUID` | ✅ | Primary key | - | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | - | From user lookup |
| `date` | `DATE` | ✅ | Sleep date | `day` | Direct |
| `total_sleep_minutes` | `INTEGER` | ❌ | Total sleep time | `total_sleep_duration` | `seconds / 60` |
| `sleep_efficiency` | `INTEGER` | ❌ | Sleep quality (0-100) | `score` | Direct |
| `deep_sleep_minutes` | `INTEGER` | ❌ | Deep sleep time | `deep_sleep_duration` | `seconds / 60` |
| `light_sleep_minutes` | `INTEGER` | ❌ | Light sleep time | `light_sleep_duration` | `seconds / 60` |
| `rem_sleep_minutes` | `INTEGER` | ❌ | REM sleep time | `rem_sleep_duration` | `seconds / 60` |
| `awake_minutes` | `INTEGER` | ❌ | Awake time in bed | `awake_duration` | `seconds / 60` |
| `bedtime_start` | `TIMESTAMPTZ` | ❌ | Sleep start time | `bedtime_start` | Direct |
| `bedtime_end` | `TIMESTAMPTZ` | ❌ | Sleep end time | `bedtime_end` | Direct |
| `hrv_avg` | `DECIMAL(5,2)` | ❌ | Heart rate variability | `hrv_average` | Direct |
| `resting_heart_rate` | `INTEGER` | ❌ | Resting HR | `heart_rate_average` | Direct |
| `temperature_deviation` | `DECIMAL(3,2)` | ❌ | Temp from baseline | `temperature_deviation` | Direct |
| `respiratory_rate` | `DECIMAL(4,2)` | ❌ | Breathing rate | `respiratory_rate` | Direct |
| `readiness_score` | `INTEGER` | ❌ | Readiness (0-100) | `score` (readiness) | Direct |
| `raw_data` | `JSONB` | ❌ | Original API response | - | Full response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | - | Auto-set |

**⚠️ Critical Field Naming Convention**:
```typescript
// ✅ CORRECT: Database uses _minutes
{
  total_sleep_minutes: sleep.total_sleep_duration / 60,
  deep_sleep_minutes: sleep.deep_sleep_duration / 60,
  light_sleep_minutes: sleep.light_sleep_duration / 60,
  rem_sleep_minutes: sleep.rem_sleep_duration / 60
}

// ❌ WRONG: Never use _duration for database fields
{
  total_sleep_duration: sleep.total_sleep_duration  // NO!
}
```

**Constraints**:
- `UNIQUE(user_id, date)` - One sleep record per user per day

---

## 🏃‍♂️ Oura Extended Data Tables

### `oura_daily_activity` Table

**Purpose**: Daily activity and movement metrics

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `date` | `DATE` | ✅ | Activity date | `day` |
| `activity_score` | `INTEGER` | ❌ | Activity score (0-100) | `score` |
| `steps` | `INTEGER` | ❌ | Step count | `steps` |
| `active_calories` | `INTEGER` | ❌ | Active calories burned | `active_calories` |
| `total_calories` | `INTEGER` | ❌ | Total daily calories | `total_calories` |
| `target_calories` | `INTEGER` | ❌ | Calorie target | `target_calories` |
| `equivalent_walking_distance` | `DECIMAL(8,2)` | ❌ | Walking distance (meters) | `equivalent_walking_distance` |
| `high_activity_minutes` | `INTEGER` | ❌ | High intensity minutes | `high_activity_minutes` |
| `medium_activity_minutes` | `INTEGER` | ❌ | Medium intensity minutes | `medium_activity_minutes` |
| `low_activity_minutes` | `INTEGER` | ❌ | Low intensity minutes | `low_activity_minutes` |
| `non_wear_minutes` | `INTEGER` | ❌ | Ring not worn | `non_wear_minutes` |
| `rest_minutes` | `INTEGER` | ❌ | Rest time | `rest_minutes` |
| `inactive_minutes` | `INTEGER` | ❌ | Sedentary time | `inactive_minutes` |
| `inactivity_alerts` | `INTEGER` | ❌ | Inactivity alert count | `inactivity_alerts` |
| `average_met` | `DECIMAL(4,2)` | ❌ | Average metabolic equivalent | `average_met` |
| `met_1min` | `JSONB` | ❌ | Minute-by-minute MET | `met_1min` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, date)`

---

### `oura_daily_stress` Table

**Purpose**: Daily stress measurements

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `date` | `DATE` | ✅ | Measurement date | `day` |
| `stress_high` | `INTEGER` | ❌ | High stress minutes | `stress_high` |
| `stress_recovery` | `INTEGER` | ❌ | Recovery minutes | `stress_recovery` |
| `stress_day_summary` | `TEXT` | ❌ | Day summary | `day_summary` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, date)`

---

### `oura_heart_rate` Table

**Purpose**: Heart rate data points throughout the day

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `timestamp` | `TIMESTAMPTZ` | ✅ | Measurement time | `timestamp` |
| `heart_rate` | `INTEGER` | ✅ | BPM reading | `bpm` |
| `source` | `TEXT` | ❌ | Measurement context | `source` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Note**: Can have multiple entries per day per user

---

### `oura_daily_spo2` Table

**Purpose**: Daily blood oxygen saturation

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `date` | `DATE` | ✅ | Measurement date | `day` |
| `spo2_percentage` | `JSONB` | ❌ | SpO2 data object | `spo2_percentage` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, date)`

---

### `oura_temperature` Table

**Purpose**: Body temperature measurements

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `date` | `DATE` | ✅ | Measurement date | `day` |
| `temperature_deviation` | `DECIMAL(3,2)` | ❌ | Deviation from baseline | `temperature_deviation` |
| `temperature_trend_deviation` | `DECIMAL(3,2)` | ❌ | Trend deviation | `temperature_trend_deviation` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, date)`

---

### `oura_workouts` Table

**Purpose**: Oura-detected workout sessions

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `external_id` | `TEXT` | ✅ | Oura workout ID | `id` |
| `activity` | `TEXT` | ❌ | Workout type | `activity` |
| `start_datetime` | `TIMESTAMPTZ` | ✅ | Workout start | `start_datetime` |
| `end_datetime` | `TIMESTAMPTZ` | ✅ | Workout end | `end_datetime` |
| `intensity` | `TEXT` | ❌ | Intensity level | `intensity` |
| `load` | `DECIMAL(6,2)` | ❌ | Workout load score | `load` |
| `average_heart_rate` | `INTEGER` | ❌ | Average HR | `average_heart_rate` |
| `max_heart_rate` | `INTEGER` | ❌ | Maximum HR | `max_heart_rate` |
| `calories` | `INTEGER` | ❌ | Calories burned | `calories` |
| `day` | `DATE` | ❌ | Workout date | `day` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, external_id)`

---

### `oura_sessions` Table

**Purpose**: Meditation, breathing, and recovery sessions

| Column | Type | Required | Description | API Source |
|--------|------|----------|-------------|------------|
| `id` | `UUID` | ✅ | Primary key | Auto-generated |
| `user_id` | `UUID` | ✅ | FK to users.id | From user lookup |
| `external_id` | `TEXT` | ✅ | Oura session ID | `id` |
| `session_type` | `TEXT` | ❌ | Session category | `type` |
| `start_datetime` | `TIMESTAMPTZ` | ✅ | Session start | `start_datetime` |
| `end_datetime` | `TIMESTAMPTZ` | ✅ | Session end | `end_datetime` |
| `mood` | `TEXT` | ❌ | Post-session mood | `mood` |
| `tags` | `TEXT[]` | ❌ | Session tags | `tags` |
| `day` | `DATE` | ❌ | Session date | `day` |
| `raw_data` | `JSONB` | ❌ | Full API response | Complete response |
| `created_at` | `TIMESTAMPTZ` | ✅ | Import timestamp | Auto-set |

**Constraints**:
- `UNIQUE(user_id, external_id)`

---

## 🚨 Critical Naming Conventions

### Time Duration Fields

| Context | Naming Pattern | Example | Conversion |
|---------|----------------|---------|------------|
| **Database Storage** | `*_minutes` | `total_sleep_minutes` | `Math.round(seconds / 60)` |
| **API Response** | `*_duration` | `total_sleep_duration` | Direct from API |
| **TypeScript** | `*_seconds` | `duration_seconds` | Direct storage |

### ID Fields

| Context | Type | Pattern | Example |
|---------|------|---------|---------|
| **Primary Keys** | `UUID` | `id` | `123e4567-e89b-12d3-a456-426614174000` |
| **Foreign Keys** | `UUID` | `*_id` | `user_id`, `provider_id` |
| **External IDs** | `TEXT` | `external_id` | `"12345678"` |
| **Telegram IDs** | `BIGINT` | `telegram_id` | `5269737203` |

### Boolean Fields

| Pattern | Example | Description |
|---------|---------|-------------|
| `is_*` | `is_active` | State/status |
| `has_*` | `has_sleep` | Capability/feature |
| Boolean columns should always have defaults |

---

## 🔧 Data Transformation Patterns

### Sleep Data Transformation

```typescript
// ✅ CORRECT: OAuth/Data Sync Pattern
const sleepRecord = {
  user_id: userId,                          // UUID from user lookup
  date: date,                               // DATE string
  total_sleep_minutes: Math.round(
    sleep.total_sleep_duration / 60         // Convert seconds to minutes
  ),
  deep_sleep_minutes: Math.round(
    sleep.deep_sleep_duration / 60
  ),
  light_sleep_minutes: Math.round(
    sleep.light_sleep_duration / 60
  ),
  rem_sleep_minutes: Math.round(
    sleep.rem_sleep_duration / 60
  ),
  sleep_efficiency: readiness?.score,       // Direct assignment
  bedtime_start: sleep.bedtime_start,       // ISO timestamp
  bedtime_end: sleep.bedtime_end,           // ISO timestamp
  raw_data: sleep                           // Full API response
};
```

### Provider Creation Pattern

```typescript
// ✅ CORRECT: Provider OAuth Pattern
await createOrUpdateProvider(supabase, {
  user_id: user.id,                         // UUID from getUserByTelegramId()
  provider: 'oura',                         // Enum value
  access_token: tokens.access_token,        // Encrypted automatically
  refresh_token: tokens.refresh_token,      // Encrypted automatically
  expires_at: tokens.expires_at,            // ISO timestamp
  provider_user_id: tokens.user_id?.toString(), // Convert to string
  scopes: ['email', 'personal', 'daily']   // String array
});
```

### User Lookup Pattern

```typescript
// ✅ CORRECT: Telegram ID to UUID Pattern
const telegramId = parseInt(userId);       // Extract from state
if (isNaN(telegramId)) {
  throw new Error(`Invalid user ID: ${userId}`);
}

const user = await getUserByTelegramId(supabase, telegramId);
if (!user) {
  throw new Error(`User not found: ${telegramId}`);
}

// Now use user.id (UUID) for all database operations
const providerId = user.id;
```

---

## 🛡️ Data Validation Rules

### Required Validations

```typescript
// User ID validation
if (!user_id || typeof user_id !== 'string') {
  throw new Error('user_id must be a valid UUID string');
}

// Telegram ID validation  
if (!telegram_id || typeof telegram_id !== 'number') {
  throw new Error('telegram_id must be a valid number');
}

// Date validation
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  throw new Error('date must be in YYYY-MM-DD format');
}

// Provider validation
if (!['oura', 'strava'].includes(provider)) {
  throw new Error('provider must be oura or strava');
}
```

### Time Conversion Validation

```typescript
// Sleep duration conversion
const convertSleepDuration = (seconds: number): number => {
  if (typeof seconds !== 'number' || seconds < 0) {
    throw new Error('Duration must be a positive number');
  }
  return Math.round(seconds / 60); // Convert to minutes
};
```

---

## 📚 Development Guidelines

### Before Adding New Fields

1. **Check this document** for existing patterns
2. **Run schema validation**: `./scripts/validate-schema.sh`
3. **Update TypeScript interfaces** in `shared/types.ts`
4. **Add migration file** with proper constraints
5. **Update this documentation**

### Before Modifying Existing Fields

1. **Verify no breaking changes** in dependent code
2. **Check foreign key relationships**
3. **Update all references** in functions
4. **Test with validation scripts**
5. **Update documentation**

### Common Pitfalls to Avoid

❌ **Using API field names in database**
```typescript
// WRONG
total_sleep_duration: sleep.total_sleep_duration
```

❌ **Incorrect time conversions**
```typescript
// WRONG - converts to hours, not minutes
seconds / 3600
```

❌ **Missing user validation**
```typescript
// WRONG - no validation
const user = await getUserByTelegramId(supabase, userId);
// Use user.id directly without checking if user exists
```

❌ **Wrong ID types in foreign keys**
```typescript
// WRONG - using telegram_id instead of user.id
user_id: telegramId  // This is a number, not UUID
```

✅ **Correct patterns documented above**

---

## 🔍 Quick Commands

```bash
# Validate schema before changes
./scripts/validate-schema.sh

# Quick schema check
./scripts/quick-schema-check.sh

# Test database connectivity
curl https://fitlinkbot.netlify.app/test-schema/

# Generate TypeScript types (if needed)
supabase gen types typescript --local > types.ts
```

---

*📝 Remember to update this document when adding new tables, fields, or changing naming conventions.*
