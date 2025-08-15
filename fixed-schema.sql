-- Fixed schema for Fitlink Bot - drops existing tables and recreates with correct types
-- This will resolve the foreign key constraint error

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (to avoid data type conflicts)
DROP TABLE IF EXISTS public.strava_activities CASCADE;
DROP TABLE IF EXISTS public.oura_sleep CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Recreate users table with correct structure
CREATE TABLE public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recreate fitness data tables with CORRECT data types
CREATE TABLE public.oura_sleep (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL, -- Explicitly UUID type
    date DATE NOT NULL,
    total_sleep_duration DECIMAL(5,2),
    deep_sleep_duration DECIMAL(5,2),
    rem_sleep_duration DECIMAL(5,2),
    light_sleep_duration DECIMAL(5,2),
    sleep_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.strava_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL, -- Explicitly UUID type
    activity_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(500),
    distance DECIMAL(10,2),
    moving_time INTEGER,
    elapsed_time INTEGER,
    total_elevation_gain DECIMAL(8,2),
    activity_type VARCHAR(100),
    start_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL, -- Explicitly UUID type
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    distance DECIMAL(8,2) DEFAULT 0,
    active_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOW add the foreign key constraints with explicit type checking
ALTER TABLE public.oura_sleep 
    ADD CONSTRAINT oura_sleep_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.strava_activities 
    ADD CONSTRAINT strava_activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.activities 
    ADD CONSTRAINT activities_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_oura_sleep_user_date ON public.oura_sleep(user_id, date DESC);
CREATE INDEX idx_strava_activities_user_date ON public.strava_activities(user_id, start_date DESC);
CREATE INDEX idx_activities_user_date ON public.activities(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oura_sleep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for service role access
CREATE POLICY "Service role can access all data" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON public.oura_sleep
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON public.strava_activities
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON public.activities
    FOR ALL USING (auth.role() = 'service_role');

-- Insert your user
INSERT INTO public.users (telegram_id, username, first_name) 
VALUES (5269737203, 'g00zzy', 'Test User')
ON CONFLICT (telegram_id) DO NOTHING;

-- Insert sample data for testing
INSERT INTO public.activities (user_id, date, steps, calories, distance, active_minutes)
SELECT 
    u.id,
    CURRENT_DATE - INTERVAL '1 day' * generate_series(0, 6),
    floor(random() * 10000 + 5000),
    floor(random() * 300 + 200),
    floor(random() * 5000 + 3000),
    floor(random() * 60 + 30)
FROM public.users u
WHERE u.telegram_id = 5269737203;

-- Insert sample sleep data
INSERT INTO public.oura_sleep (user_id, date, total_sleep_duration, deep_sleep_duration, rem_sleep_duration, light_sleep_duration, sleep_score)
SELECT 
    u.id,
    CURRENT_DATE - INTERVAL '1 day' * generate_series(0, 6),
    round((random() * 2 + 6)::numeric, 2),
    round((random() * 1 + 1)::numeric, 2),
    round((random() * 1.5 + 1.5)::numeric, 2),
    round((random() * 2 + 2)::numeric, 2),
    floor(random() * 30 + 70)
FROM public.users u
WHERE u.telegram_id = 5269737203;
