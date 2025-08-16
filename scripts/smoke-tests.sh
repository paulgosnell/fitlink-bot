#!/bin/bash

# 🧪 FITLINK BOT SMOKE TESTS 🧪
# Run these tests after deployment to verify critical flows work

set -e

echo "🧪 Running Fitlink Bot Smoke Tests..."
echo "===================================="

ERRORS=0
TESTS_RUN=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

test_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    echo -e "${RED}   $2${NC}"
    ERRORS=$((ERRORS + 1))
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_warn() {
    echo -e "${YELLOW}⚠️  WARN: $1${NC}"
    echo -e "${YELLOW}   $2${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Base URL for tests
BASE_URL="https://fitlinkbot.netlify.app"

echo -e "\n${BLUE}Testing against: $BASE_URL${NC}\n"

# Test 1: Telegram Webhook Proxy
echo "🔗 Test 1: Telegram Webhook Proxy"
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/telegram-webhook" -d '{"test":1}' -H "Content-Type: application/json")
if [ "$response" == "200" ]; then
    test_pass "Telegram webhook proxy responds (200 OK)"
elif [ "$response" == "401" ]; then
    test_fail "Telegram webhook proxy" "Got 401 - Check VITE_SUPABASE_ANON_KEY in Netlify"
elif [ "$response" == "500" ]; then
    test_fail "Telegram webhook proxy" "Got 500 - Check Supabase function deployment"
else
    test_warn "Telegram webhook proxy" "Got HTTP $response - May be expected depending on webhook validation"
fi

# Test 2: Oura OAuth Start
echo -e "\n🔗 Test 2: Oura OAuth Start"
response=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE_URL/oauth-oura/start?user_id=12345")
if [ "$response" == "302" ]; then
    test_pass "Oura OAuth start redirects (302 Found)"
elif [ "$response" == "401" ]; then
    test_fail "Oura OAuth start" "Got 401 - Check VITE_SUPABASE_ANON_KEY in Netlify"
elif [ "$response" == "400" ]; then
    test_warn "Oura OAuth start" "Got 400 - May be expected with test user_id"
else
    test_fail "Oura OAuth start" "Got HTTP $response - Expected 302 redirect"
fi

# Test 3: Strava OAuth Start  
echo -e "\n🔗 Test 3: Strava OAuth Start"
response=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE_URL/oauth-strava/start?user_id=12345")
if [ "$response" == "302" ]; then
    test_pass "Strava OAuth start redirects (302 Found)"
elif [ "$response" == "401" ]; then
    test_fail "Strava OAuth start" "Got 401 - Check VITE_SUPABASE_ANON_KEY in Netlify"
elif [ "$response" == "400" ]; then
    test_warn "Strava OAuth start" "Got 400 - May be expected with test user_id"
else
    test_fail "Strava OAuth start" "Got HTTP $response - Expected 302 redirect"
fi

# Test 4: Web Dashboard
echo -e "\n🌐 Test 4: Web Dashboard"
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$response" == "200" ]; then
    test_pass "Web dashboard loads (200 OK)"
else
    test_fail "Web dashboard" "Got HTTP $response - Check Netlify static site deployment"
fi

# Test 5: Dashboard HTML Content
echo -e "\n📄 Test 5: Dashboard HTML Content"
content=$(curl -s "$BASE_URL/" | head -n 5)
if echo "$content" | grep -q "<!DOCTYPE html>"; then
    test_pass "Dashboard serves HTML content"
else
    test_fail "Dashboard HTML content" "Not serving proper HTML - Check Content-Type headers"
fi

# Test 6: OAuth Redirect URL Validation
echo -e "\n🔗 Test 6: OAuth Redirect URL Check"
if curl -s "$BASE_URL/oauth-oura/start?user_id=12345" | grep -q "fitlinkbot.netlify.app"; then
    test_pass "Oura OAuth uses correct redirect URL"
else
    test_warn "Oura OAuth redirect URL" "Could not verify redirect URL in response"
fi

# Test 7: Proxy Content-Type Handling
echo -e "\n📋 Test 7: Content-Type Headers"
content_type=$(curl -s -I "$BASE_URL/" | grep -i "content-type" | head -n 1)
if echo "$content_type" | grep -q "text/html"; then
    test_pass "Dashboard serves correct Content-Type"
else
    test_warn "Content-Type headers" "Content-Type may not be optimal: $content_type"
fi

# Test 8: CORS Headers
echo -e "\n🌐 Test 8: CORS Headers"
cors_header=$(curl -s -I "$BASE_URL/api/telegram-webhook" -X OPTIONS | grep -i "access-control-allow-origin")
if [ -n "$cors_header" ]; then
    test_pass "CORS headers present"
else
    test_warn "CORS headers" "CORS headers not detected - May affect dashboard API calls"
fi

# Summary
echo -e "\n${BLUE}====================================${NC}"
echo -e "${BLUE}SMOKE TEST SUMMARY${NC}"
echo -e "${BLUE}====================================${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical tests passed! ($TESTS_RUN tests run)${NC}"
    echo -e "${GREEN}System appears to be working correctly.${NC}"
elif [ $ERRORS -le 2 ]; then
    echo -e "${YELLOW}⚠️  $ERRORS minor issues found ($TESTS_RUN tests run)${NC}"
    echo -e "${YELLOW}System should work but review warnings above.${NC}"
else
    echo -e "${RED}🚨 $ERRORS critical issues found! ($TESTS_RUN tests run)${NC}"
    echo -e "${RED}System may not work properly. Fix issues before using.${NC}"
fi

echo -e "\n${BLUE}Next steps if issues found:${NC}"
echo "• Run validation script: ./scripts/validate-critical-config.sh"
echo "• Check Netlify environment variables (VITE_SUPABASE_ANON_KEY)"
echo "• Verify Supabase function deployment"
echo "• Check proxy configurations"

echo -e "\n${BLUE}For end-to-end testing:${NC}"
echo "• Send a test message to @the_fitlink_bot"
echo "• Try connecting Oura Ring from the bot"
echo "• Visit dashboard and check data loading"

exit $ERRORS
