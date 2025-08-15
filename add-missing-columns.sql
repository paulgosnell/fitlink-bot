-- Add missing columns to users table
-- Run this in Supabase SQL Editor

-- Add missing columns to users table if they don't exist
DO $$ 
BEGIN
    -- Add timezone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'timezone') THEN
        ALTER TABLE public.users ADD COLUMN timezone TEXT DEFAULT 'UTC';
    END IF;
    
    -- Add city column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
        ALTER TABLE public.users ADD COLUMN city TEXT;
    END IF;
    
    -- Add briefing_hour column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'briefing_hour') THEN
        ALTER TABLE public.users ADD COLUMN briefing_hour INTEGER DEFAULT 7 CHECK (briefing_hour >= 0 AND briefing_hour <= 23);
    END IF;
    
    -- Add training_goal column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'training_goal') THEN
        ALTER TABLE public.users ADD COLUMN training_goal TEXT DEFAULT 'general_fitness';
    END IF;
    
    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
        ALTER TABLE public.users ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- Add paused_until column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'paused_until') THEN
        ALTER TABLE public.users ADD COLUMN paused_until DATE;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Update existing users to have is_active = true if it's null
UPDATE public.users SET is_active = true WHERE is_active IS NULL;