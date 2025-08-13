-- Add conversation state columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS conversation_state TEXT,
ADD COLUMN IF NOT EXISTS state_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS detected_question TEXT;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_conversation 
ON users(telegram_id, conversation_state, state_expires_at);