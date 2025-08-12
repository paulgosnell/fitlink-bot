-- Create dashboard_tokens table for secure web dashboard access
CREATE TABLE IF NOT EXISTS public.dashboard_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Create index for performance
CREATE INDEX idx_dashboard_tokens_user_id ON public.dashboard_tokens(user_id);
CREATE INDEX idx_dashboard_tokens_token ON public.dashboard_tokens(token);
CREATE INDEX idx_dashboard_tokens_expires ON public.dashboard_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.dashboard_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see their own tokens
CREATE POLICY "Users can view their own dashboard tokens"
    ON public.dashboard_tokens FOR SELECT
    USING (user_id = auth.uid()::bigint);

-- Allow service role to manage tokens (for bot operations)
CREATE POLICY "Service role can manage dashboard tokens"
    ON public.dashboard_tokens FOR ALL
    USING (true);

-- Auto-cleanup expired tokens (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_dashboard_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.dashboard_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run cleanup daily (if pg_cron is available)
-- SELECT cron.schedule('cleanup-dashboard-tokens', '0 2 * * *', 'SELECT cleanup_expired_dashboard_tokens();');

COMMENT ON TABLE public.dashboard_tokens IS 'Secure tokens for web dashboard access with 24h expiry';