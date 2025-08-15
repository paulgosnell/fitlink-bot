-- Migration: normalize providers.is_active values and set NOT NULL default
-- Created: 2025-08-15

BEGIN;

-- 1) Inspect current values (run this SELECT before applying updates)
-- SELECT id, user_id, provider, is_active, access_token, refresh_token, expires_at FROM providers ORDER BY updated_at DESC LIMIT 100;

-- 2) Set NULL is_active to true where tokens exist (safe heuristic)
UPDATE providers
SET is_active = true,
    updated_at = now()
WHERE is_active IS NULL
  AND (access_token IS NOT NULL OR refresh_token IS NOT NULL OR provider_user_id IS NOT NULL);

-- 3) For rows with clearly expired tokens, set is_active = false (optional)
-- UPDATE providers
-- SET is_active = false, updated_at = now()
-- WHERE is_active IS NULL
--   AND expires_at IS NOT NULL
--   AND expires_at <= now();

-- 4) Ensure future inserts default to true and column is NOT NULL
ALTER TABLE providers
ALTER COLUMN is_active SET DEFAULT true;

-- If your DB allows setting NOT NULL immediately, you can do so. Otherwise run it in a safe maintenance window.
-- ALTER TABLE providers
-- ALTER COLUMN is_active SET NOT NULL;

COMMIT;
