#!/bin/bash

# Setup script for Fitlink Bot

echo "🚀 Setting up Fitlink Bot..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local with your actual values before continuing"
    exit 1
fi

# Start Supabase local development
echo "🏗️  Starting Supabase..."
supabase start

# Apply database migrations
echo "📊 Applying database migrations..."
supabase db push

# Get local Supabase details
echo "🔍 Getting Supabase connection details..."
supabase status

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Set up Telegram bot with @BotFather"
echo "3. Create Oura and Strava OAuth apps"
echo "4. Run: npm run dev"
echo ""
echo "🤖 Your Fitlink Bot will be available at:"
echo "   Telegram webhook: http://localhost:54321/functions/v1/telegram/webhook/your-secret"
echo "   OAuth URLs:"
echo "   - Oura: http://localhost:54321/functions/v1/oauth/oura/start"
echo "   - Strava: http://localhost:54321/functions/v1/oauth/strava/start"
