-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create oauth_tokens table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Create sleep_data table
CREATE TABLE IF NOT EXISTS sleep_data (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  bedtime_start TIMESTAMP WITH TIME ZONE,
  bedtime_end TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- seconds
  efficiency DECIMAL(5,2), -- percentage
  score INTEGER,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create activity_data table
CREATE TABLE IF NOT EXISTS activity_data (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  activity_type TEXT,
  distance DECIMAL(10,2), -- meters
  duration INTEGER, -- seconds
  calories INTEGER,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weather_data table
CREATE TABLE IF NOT EXISTS weather_data (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  location TEXT,
  temperature DECIMAL(5,2),
  condition TEXT,
  humidity INTEGER,
  wind_speed DECIMAL(5,2),
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create briefings table
CREATE TABLE IF NOT EXISTS briefings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  data_sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data" ON users 
  FOR ALL USING (telegram_id = CAST(current_setting('app.current_user_telegram_id', true) AS BIGINT));

CREATE POLICY "Users can view their own tokens" ON oauth_tokens 
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = CAST(current_setting('app.current_user_telegram_id', true) AS BIGINT)));

CREATE POLICY "Users can view their own sleep data" ON sleep_data 
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = CAST(current_setting('app.current_user_telegram_id', true) AS BIGINT)));

CREATE POLICY "Users can view their own activity data" ON activity_data 
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = CAST(current_setting('app.current_user_telegram_id', true) AS BIGINT)));

CREATE POLICY "Users can view their own weather data" ON weather_data 
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = CAST(current_setting('app.current_user_telegram_id', true) AS BIGINT)));

CREATE POLICY "Users can view their own briefings" ON briefings 
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE telegram_id = CAST(current_setting('app.current_user_telegram_id', true) AS BIGINT)));
