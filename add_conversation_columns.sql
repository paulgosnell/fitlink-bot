-- Add conversation state columns to existing users table
-- Run this manually in Supabase SQL Editor if the columns don't exist

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS conversation_state TEXT,
ADD COLUMN IF NOT EXISTS state_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS detected_question TEXT;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_conversation 
ON users(telegram_id, conversation_state, state_expires_at);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('conversation_state', 'state_expires_at', 'detected_question');