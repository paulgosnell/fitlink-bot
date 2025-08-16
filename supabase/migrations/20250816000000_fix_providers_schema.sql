-- Fix providers table schema - ensure user_id is UUID not bigint
-- Created: 2025-08-16 to fix OAuth bigint error

BEGIN;

-- Check current schema and fix if needed
DO $$
BEGIN
    -- Check if user_id column exists and what type it is
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'providers' 
        AND column_name = 'user_id' 
        AND data_type != 'uuid'
    ) THEN
        -- If user_id is not UUID, we need to fix it
        RAISE NOTICE 'Fixing providers.user_id column type from % to UUID', 
            (SELECT data_type FROM information_schema.columns 
             WHERE table_name = 'providers' AND column_name = 'user_id');
        
        -- Drop and recreate the column as UUID
        ALTER TABLE providers DROP COLUMN IF EXISTS user_id;
        ALTER TABLE providers ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        
        -- Recreate the unique constraint
        ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_user_id_provider_key;
        ALTER TABLE providers ADD CONSTRAINT providers_user_id_provider_key UNIQUE(user_id, provider);
        
        RAISE NOTICE 'Fixed providers.user_id column to UUID type';
    ELSE
        RAISE NOTICE 'providers.user_id is already UUID type - no fix needed';
    END IF;
END $$;

COMMIT;
