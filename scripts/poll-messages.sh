#!/bin/bash

# Direct polling script to process Telegram messages
BOT_TOKEN="8236325093:AAEswgzArS5Fk9DuqOG3c-HLo126OvVlyPI"

echo "🤖 Checking for new messages..."

# Get updates
updates=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getUpdates?limit=10")

# Check if there are any updates
count=$(echo "$updates" | jq '.result | length')

if [ "$count" -eq "0" ]; then
    echo "No new messages found."
else
    echo "Found $count message(s)"
    echo "$updates" | jq '.result[] | {message_id: .message.message_id, from: .message.from.first_name, text: .message.text}'
    
    # Process each update
    echo "$updates" | jq -c '.result[]' | while read -r update; do
        update_id=$(echo "$update" | jq '.update_id')
        chat_id=$(echo "$update" | jq '.message.chat.id')
        text=$(echo "$update" | jq -r '.message.text // empty')
        
        if [ ! -z "$text" ]; then
            echo "Processing message: $text"
            
            # Simple response based on command
            if [[ "$text" == "/start" ]]; then
                response="Welcome to Fitlink Bot! 🏃‍♂️\n\nI'm currently in maintenance mode. The webhook is being fixed.\n\nTry these commands:\n/status - Check your connections\n/help - Get help"
                
                curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
                    -H "Content-Type: application/json" \
                    -d "{\"chat_id\": $chat_id, \"text\": \"$response\", \"parse_mode\": \"Markdown\"}" > /dev/null
            fi
            
            # Mark update as processed
            curl -s "https://api.telegram.org/bot$BOT_TOKEN/getUpdates?offset=$((update_id + 1))" > /dev/null
        fi
    done
fi

echo ""
echo "✅ Polling complete. Run this script again to check for new messages."