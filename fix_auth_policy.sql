-- Fix authentication policy for dashboard
-- Run this in Supabase Dashboard SQL Editor

-- Add policy to allow anon users to query users table for telegram authentication
CREATE POLICY "Allow telegram authentication lookup" ON users
    FOR SELECT USING (auth.role() = 'anon');