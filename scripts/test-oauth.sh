#!/bin/bash
# Test OAuth endpoints

echo "Testing OAuth endpoints..."
echo

# Test Oura OAuth start
echo "Testing Oura OAuth start..."
curl -I "https://fitlinkbot.netlify.app/oauth-oura/start?user_id=TEST123"
echo

# Test Strava OAuth start  
echo "Testing Strava OAuth start..."
curl -I "https://fitlinkbot.netlify.app/oauth-strava/start?user_id=TEST123"
echo

echo "If you see 302 redirects above, the OAuth proxies are working correctly."
echo "The Location header should point to the OAuth provider's authorization page."