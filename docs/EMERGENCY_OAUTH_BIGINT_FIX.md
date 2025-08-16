# 🚨 EMERGENCY: OAuth "bigint" Error Response Guide

## Immediate Action Required

If you see: `invalid input syntax for type bigint: "<uuid>"`

### ⚡ Quick Fix (5 minutes)

1. **Run this SQL immediately**:
```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'providers' 
        AND column_name = 'user_id' 
        AND data_type != 'uuid'
    ) THEN
        ALTER TABLE providers DROP COLUMN IF EXISTS user_id;
        ALTER TABLE providers ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_user_id_provider_key;
        ALTER TABLE providers ADD CONSTRAINT providers_user_id_provider_key UNIQUE(user_id, provider);
        RAISE NOTICE 'EMERGENCY FIX: providers.user_id now UUID';
    END IF;
END $$;
```

2. **Test OAuth flow immediately** - should work now

3. **Document what happened** in incident log

### 🔍 Verification
Run this to confirm fix:
```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'providers' AND column_name = 'user_id';
```
Should return: `providers | user_id | uuid`

### 📚 Full Details
See: `docs/CRITICAL_BUG_FIX_OAUTH_BIGINT_20250816.md`
