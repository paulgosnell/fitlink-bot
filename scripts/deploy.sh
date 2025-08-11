#!/bin/bash

# Deploy script for Fitlink Bot

echo "🚀 Deploying Fitlink Bot to Supabase..."

# Check if logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Run: supabase login"
    exit 1
fi

# Link to existing project or create new one
if [ ! -f .supabase/config.toml ]; then
    echo "🔗 Link to your Supabase project:"
    supabase link
fi

# Push database changes
echo "📊 Pushing database migrations..."
supabase db push

# Deploy Edge Functions
echo "⚡ Deploying Edge Functions..."
supabase functions deploy telegram
supabase functions deploy oauth-oura  
supabase functions deploy oauth-strava
supabase functions deploy daily-briefings

# Set up environment variables
echo "🔧 Setting environment variables..."
echo "Please set the following secrets in your Supabase dashboard:"
echo ""
echo "Required secrets:"
echo "- TELEGRAM_BOT_TOKEN"
echo "- TELEGRAM_WEBHOOK_SECRET" 
echo "- OURA_CLIENT_ID"
echo "- OURA_CLIENT_SECRET"
echo "- STRAVA_CLIENT_ID"
echo "- STRAVA_CLIENT_SECRET"
echo "- OPENWEATHER_API_KEY"
echo "- OPENAI_API_KEY"
echo "- ENCRYPTION_KEY"
echo "- BASE_URL (your project URL)"
echo "- WEBAPP_URL (if using web dashboard)"
echo ""

# Get project URL
PROJECT_URL=$(supabase status | grep "API URL" | awk '{print $3}')
echo "📡 Your project URL: $PROJECT_URL"
echo ""
echo "🤖 Set up your Telegram webhook:"
echo "curl -X POST \"https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"url\":\"$PROJECT_URL/functions/v1/telegram/webhook/<YOUR_SECRET>\"}'"
echo ""

# Set up cron job for daily briefings
echo "⏰ Don't forget to set up the cron job for daily briefings in your Supabase dashboard:"
echo "Function: daily-briefings"
echo "Schedule: 0 * * * * (every hour)"
echo ""

echo "✅ Deployment complete!"
echo "🎉 Your Fitlink Bot is now live!"
