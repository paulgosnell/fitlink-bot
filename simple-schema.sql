-- Simple working schema for Fitlink Bot
-- This can be applied manually to fix the dashboard issues

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (basic structure)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    timezone TEXT DEFAULT 'UTC',
    city TEXT,
    briefing_hour INTEGER DEFAULT 7 CHECK (briefing_hour >= 0 AND briefing_hour <= 23),
    training_goal TEXT DEFAULT 'general_fitness',
    is_active BOOLEAN DEFAULT true,
    paused_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic fitness data tables
CREATE TABLE IF NOT EXISTS public.oura_sleep (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_sleep_duration DECIMAL(5,2), -- in hours
    deep_sleep_duration DECIMAL(5,2), -- in hours
    rem_sleep_duration DECIMAL(5,2), -- in hours
    light_sleep_duration DECIMAL(5,2), -- in hours
    sleep_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.strava_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(500),
    distance DECIMAL(10,2), -- in meters
    moving_time INTEGER, -- in seconds
    elapsed_time INTEGER, -- in seconds
    total_elevation_gain DECIMAL(8,2), -- in meters
    activity_type VARCHAR(100),
    start_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    distance DECIMAL(8,2) DEFAULT 0, -- in meters
    active_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_oura_sleep_user_date ON public.oura_sleep(user_id, date DESC);
CREATE INDEX idx_strava_activities_user_date ON public.strava_activities(user_id, start_date DESC);
CREATE INDEX idx_activities_user_date ON public.activities(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oura_sleep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow service role to access all data)
CREATE POLICY "Service role can access all data" ON public.users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON public.oura_sleep
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON public.strava_activities
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all data" ON public.activities
    FOR ALL USING (auth.role() = 'service_role');

-- Insert sample user for testing
INSERT INTO public.users (telegram_id, username, first_name) 
VALUES (5269737203, 'g00zzy', 'Test User')
ON CONFLICT (telegram_id) DO NOTHING;

-- Insert sample fitness data for testing
INSERT INTO public.activities (user_id, date, steps, calories, distance, active_minutes)
SELECT 
    u.id,
    CURRENT_DATE - INTERVAL '1 day' * generate_series(0, 6),
    floor(random() * 10000 + 5000), -- Random steps between 5000-15000
    floor(random() * 300 + 200), -- Random calories between 200-500
    floor(random() * 5000 + 3000), -- Random distance between 3-8km
    floor(random() * 60 + 30) -- Random active minutes between 30-90
FROM public.users u
WHERE u.telegram_id = 5269737203
ON CONFLICT DO NOTHING;

-- Insert sample sleep data
INSERT INTO public.oura_sleep (user_id, date, total_sleep_duration, deep_sleep_duration, rem_sleep_duration, light_sleep_duration, sleep_score)
SELECT 
    u.id,
    CURRENT_DATE - INTERVAL '1 day' * generate_series(0, 6),
    round((random() * 2 + 6)::numeric, 2), -- Random sleep between 6-8 hours
    round((random() * 1 + 1)::numeric, 2), -- Random deep sleep between 1-2 hours
    round((random() * 1.5 + 1.5)::numeric, 2), -- Random REM sleep between 1.5-3 hours
    round((random() * 2 + 2)::numeric, 2), -- Random light sleep between 2-4 hours
    floor(random() * 30 + 70) -- Random sleep score between 70-100
FROM public.users u
WHERE u.telegram_id = 5269737203
ON CONFLICT DO NOTHING;
