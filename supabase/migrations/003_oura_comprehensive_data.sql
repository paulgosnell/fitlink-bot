-- Additional Oura data tables for comprehensive health tracking

-- Daily activity data from Oura
CREATE TABLE oura_daily_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    activity_score INTEGER CHECK (activity_score >= 0 AND activity_score <= 100),
    steps INTEGER,
    active_calories INTEGER,
    total_calories INTEGER,
    target_calories INTEGER,
    equivalent_walking_distance DECIMAL(8,2), -- meters
    high_activity_minutes INTEGER,
    medium_activity_minutes INTEGER,
    low_activity_minutes INTEGER,
    non_wear_minutes INTEGER,
    rest_minutes INTEGER,
    inactive_minutes INTEGER,
    inactivity_alerts INTEGER,
    average_met DECIMAL(4,2),
    met_1min JSONB, -- Array of MET values per minute
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Daily stress data from Oura  
CREATE TABLE oura_daily_stress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    stress_high INTEGER, -- minutes in high stress
    stress_recovery INTEGER, -- minutes in recovery
    stress_day_summary TEXT, -- stressed, balanced, restored
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Heart rate data from Oura (can be multiple entries per day)
CREATE TABLE oura_heart_rate (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    heart_rate INTEGER NOT NULL,
    source TEXT, -- workout, sleep, etc
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SPO2 (blood oxygen) data from Oura
CREATE TABLE oura_daily_spo2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spo2_percentage JSONB, -- Object with average, trend data
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Temperature data from Oura
CREATE TABLE oura_temperature (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    temperature_deviation DECIMAL(3,2), -- deviation from baseline
    temperature_trend_deviation DECIMAL(3,2),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Workout sessions from Oura
CREATE TABLE oura_workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- Oura workout ID
    activity TEXT, -- workout type
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    intensity TEXT, -- easy, moderate, hard
    load DECIMAL(6,2), -- workout load score
    average_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories INTEGER,
    day DATE, -- date for the workout
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, external_id)
);

-- Sessions (meditation, breathing, etc) from Oura
CREATE TABLE oura_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- Oura session ID
    session_type TEXT, -- meditation, breathing, etc
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    mood TEXT, -- user mood after session
    tags TEXT[], -- session tags
    day DATE, -- date for the session
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, external_id)
);

-- Indexes for performance
CREATE INDEX idx_oura_daily_activity_user_date ON oura_daily_activity(user_id, date DESC);
CREATE INDEX idx_oura_daily_stress_user_date ON oura_daily_stress(user_id, date DESC);
CREATE INDEX idx_oura_heart_rate_user_timestamp ON oura_heart_rate(user_id, timestamp DESC);
CREATE INDEX idx_oura_daily_spo2_user_date ON oura_daily_spo2(user_id, date DESC);
CREATE INDEX idx_oura_temperature_user_date ON oura_temperature(user_id, date DESC);
CREATE INDEX idx_oura_workouts_user_date ON oura_workouts(user_id, start_datetime DESC);
CREATE INDEX idx_oura_sessions_user_date ON oura_sessions(user_id, start_datetime DESC);