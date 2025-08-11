-- Row Level Security policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_sleep ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE env_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE brief_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user_id from JWT
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
    -- In Supabase Edge Functions, we'll set this via RPC
    -- For now, allow service role access
    IF auth.role() = 'service_role' THEN
        RETURN NULL; -- Service role can access all data
    END IF;
    
    -- For authenticated users, extract user_id from JWT custom claims
    RETURN (auth.jwt() ->> 'user_id')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (id = get_current_user_id() OR auth.role() = 'service_role');

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = get_current_user_id() OR auth.role() = 'service_role');

CREATE POLICY "Service role can insert users" ON users
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Providers policies
CREATE POLICY "Users can view own providers" ON providers
    FOR ALL USING (user_id = get_current_user_id() OR auth.role() = 'service_role');

-- Sleep data policies
CREATE POLICY "Users can view own sleep data" ON oura_sleep
    FOR ALL USING (user_id = get_current_user_id() OR auth.role() = 'service_role');

-- Activities policies
CREATE POLICY "Users can view own activities" ON activities
    FOR ALL USING (user_id = get_current_user_id() OR auth.role() = 'service_role');

-- Environmental data policies
CREATE POLICY "Users can view own environmental data" ON env_daily
    FOR ALL USING (user_id = get_current_user_id() OR auth.role() = 'service_role');

-- Brief logs policies
CREATE POLICY "Users can view own brief logs" ON brief_logs
    FOR SELECT USING (user_id = get_current_user_id() OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage brief logs" ON brief_logs
    FOR ALL USING (auth.role() = 'service_role');

-- User settings policies
CREATE POLICY "Users can manage own settings" ON user_settings
    FOR ALL USING (user_id = get_current_user_id() OR auth.role() = 'service_role');

-- Grant permissions to authenticated users
GRANT SELECT ON weekly_load_view TO authenticated;
GRANT SELECT ON sleep_recent_view TO authenticated;
GRANT SELECT ON todays_conditions_view TO authenticated;

-- Grant full access to service role (Edge Functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
