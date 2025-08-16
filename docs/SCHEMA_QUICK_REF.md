# 🚀 Fitlink Schema Quick Reference

> **Keep this handy during development!**

## 🎯 Core Patterns

### Sleep Data (Most Common)
```typescript
// ✅ CORRECT
{
  total_sleep_minutes: Math.round(sleep.total_sleep_duration / 60),
  deep_sleep_minutes: Math.round(sleep.deep_sleep_duration / 60),
  // Database: _minutes | API: _duration | Convert: /60
}
```

### User Lookup
```typescript
// ✅ CORRECT  
const telegramId = parseInt(userId);
const user = await getUserByTelegramId(supabase, telegramId);
// Use: user.id (UUID) for all DB operations
```

### Provider Creation
```typescript
// ✅ CORRECT
{
  user_id: user.id,          // UUID from user lookup
  provider: 'oura',          // String enum
  provider_user_id: id?.toString()  // Convert to string
}
```

## ⚠️ Never Do This

```typescript
// ❌ WRONG - Field naming
total_sleep_duration: sleep.total_sleep_duration  // NO!

// ❌ WRONG - Time conversion  
seconds / 3600  // NO! Use seconds / 60

// ❌ WRONG - ID usage
user_id: telegramId  // NO! Use user.id (UUID)
```

## 📋 Field Types Quick Check

| Context | Type | Example |
|---------|------|---------|
| Primary Keys | `UUID` | `user.id` |
| Telegram IDs | `BIGINT` | `telegram_id` |
| Time Minutes | `INTEGER` | `sleep_minutes` |
| API Seconds | `number` | `sleep_duration` |
| External IDs | `TEXT` | `provider_user_id` |

## 🔧 Quick Validation

```bash
# Before any DB changes
./scripts/validate-schema.sh

# Quick check
./scripts/quick-schema-check.sh
```

## 📖 Full Documentation

See [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) for complete reference.
