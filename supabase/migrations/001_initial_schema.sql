-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE provider_type AS ENUM ('oura', 'strava');
CREATE TYPE activity_type AS ENUM ('run', 'ride', 'swim', 'walk', 'hike', 'other');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    city TEXT,
    briefing_hour INTEGER DEFAULT 7 CHECK (briefing_hour >= 0 AND briefing_hour <= 23),
    training_goal TEXT DEFAULT 'general_fitness',
    is_active BOOLEAN DEFAULT true,
    paused_until DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OAuth providers
CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider provider_type NOT NULL,
    access_token TEXT NOT NULL, -- encrypted
    refresh_token TEXT, -- encrypted
    expires_at TIMESTAMP WITH TIME ZONE,
    provider_user_id TEXT,
    scopes TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Oura sleep data
CREATE TABLE oura_sleep (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_sleep_minutes INTEGER,
    sleep_efficiency INTEGER CHECK (sleep_efficiency >= 0 AND sleep_efficiency <= 100),
    deep_sleep_minutes INTEGER,
    light_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    awake_minutes INTEGER,
    bedtime_start TIMESTAMP WITH TIME ZONE,
    bedtime_end TIMESTAMP WITH TIME ZONE,
    hrv_avg DECIMAL(5,2),
    resting_heart_rate INTEGER,
    temperature_deviation DECIMAL(3,2),
    respiratory_rate DECIMAL(4,2),
    readiness_score INTEGER CHECK (readiness_score >= 0 AND readiness_score <= 100),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Activities (Strava and future sources)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source provider_type NOT NULL,
    external_id TEXT NOT NULL,
    activity_type activity_type NOT NULL,
    name TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_seconds INTEGER NOT NULL,
    distance_meters DECIMAL(10,2),
    elevation_gain_meters DECIMAL(8,2),
    average_heart_rate INTEGER,
    max_heart_rate INTEGER,
    average_power INTEGER,
    weighted_power INTEGER,
    tss_estimated DECIMAL(6,2), -- Training Stress Score estimate
    intensity_factor DECIMAL(4,3),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, source, external_id)
);

-- Daily environmental data
CREATE TABLE env_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    city TEXT NOT NULL,
    temp_min_c DECIMAL(4,1),
    temp_max_c DECIMAL(4,1),
    humidity_percent INTEGER CHECK (humidity_percent >= 0 AND humidity_percent <= 100),
    wind_kph DECIMAL(5,2),
    precipitation_mm DECIMAL(6,2),
    air_quality_index INTEGER,
    sunrise_time TIME,
    sunset_time TIME,
    weather_description TEXT,
    best_exercise_windows JSONB, -- Array of {start_hour, end_hour, conditions}
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Brief delivery logs
CREATE TABLE brief_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    telegram_message_id INTEGER,
    ai_model TEXT,
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    feedback_rating INTEGER CHECK (feedback_rating IN (1, -1)), -- thumbs up/down
    feedback_text TEXT,
    briefing_data JSONB, -- The actual briefing content for debugging
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences and settings
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    units_metric BOOLEAN DEFAULT true,
    include_weather BOOLEAN DEFAULT true,
    include_air_quality BOOLEAN DEFAULT false,
    briefing_style TEXT DEFAULT 'concise' CHECK (briefing_style IN ('concise', 'detailed')),
    notification_sound BOOLEAN DEFAULT true,
    weekly_summary BOOLEAN DEFAULT true,
    share_achievements BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_providers_user_id ON providers(user_id);
CREATE INDEX idx_oura_sleep_user_date ON oura_sleep(user_id, date DESC);
CREATE INDEX idx_activities_user_start_time ON activities(user_id, start_time DESC);
CREATE INDEX idx_env_daily_user_date ON env_daily(user_id, date DESC);
CREATE INDEX idx_brief_logs_user_date ON brief_logs(user_id, date DESC);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
