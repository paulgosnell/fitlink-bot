-- User feedback and admin communication system
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('bug_report', 'feature_request', 'general_feedback', 'complaint', 'compliment')),
    category TEXT, -- 'briefing', 'dashboard', 'connections', 'general'
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- optional 1-5 star rating
    context JSONB, -- Additional context like current page, error details, etc.
    
    -- Telegram integration
    user_telegram_id BIGINT NOT NULL,
    user_message_id INTEGER, -- Original user message ID
    admin_notified_at TIMESTAMP WITH TIME ZONE,
    admin_telegram_message_id INTEGER, -- Message ID when forwarded to admin
    
    -- Admin response
    admin_response TEXT,
    admin_response_at TIMESTAMP WITH TIME ZONE,
    admin_user_telegram_id BIGINT, -- Which admin responded
    response_forwarded_at TIMESTAMP WITH TIME ZONE,
    
    -- Status tracking
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags TEXT[], -- For categorization: ['ui', 'performance', 'oura', 'strava', etc.]
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users table for multiple support staff
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    role TEXT DEFAULT 'support' CHECK (role IN ('admin', 'support', 'developer')),
    is_active BOOLEAN DEFAULT true,
    can_receive_feedback BOOLEAN DEFAULT true,
    notification_types TEXT[] DEFAULT ARRAY['bug_report', 'complaint', 'urgent'], -- What types to notify about
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback analytics view
CREATE VIEW feedback_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    type,
    category,
    status,
    COUNT(*) as count,
    AVG(rating) as avg_rating,
    COUNT(*) FILTER (WHERE admin_response IS NOT NULL) as response_rate,
    AVG(EXTRACT(EPOCH FROM (admin_response_at - created_at))/3600) as avg_response_hours
FROM user_feedback 
GROUP BY DATE_TRUNC('day', created_at), type, category, status;

-- Indexes
CREATE INDEX idx_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX idx_feedback_status ON user_feedback(status) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_feedback_type_category ON user_feedback(type, category);
CREATE INDEX idx_admin_users_telegram_id ON admin_users(telegram_id);

-- Updated at trigger
CREATE TRIGGER update_feedback_updated_at 
    BEFORE UPDATE ON user_feedback 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert your admin user (you'll need to replace 123456789 with your actual Telegram ID)
-- You can get your Telegram ID by messaging @userinfobot or checking your Telegram settings
-- For now using placeholder - UPDATE THIS AFTER DEPLOYMENT with your real Telegram ID
INSERT INTO admin_users (telegram_id, first_name, role, is_active, can_receive_feedback) 
VALUES (123456789, 'Paul', 'admin', true, true);

-- Sample data for testing
COMMENT ON TABLE user_feedback IS 'Stores all user feedback with admin response capabilities';
COMMENT ON TABLE admin_users IS 'Admin users who can receive and respond to feedback';
COMMENT ON COLUMN user_feedback.context IS 'JSON context like {"page": "dashboard", "error": "timeout", "user_agent": "..."}';
COMMENT ON COLUMN user_feedback.tags IS 'Array of tags for filtering: ["ui", "performance", "oura", "strava"]';