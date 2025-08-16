#!/bin/bash

# 🚨 CRITICAL VALIDATION SCRIPT 🚨
# Run this BEFORE every deployment to prevent breaking the system
# This script checks ALL the common failure points that break Fitlink Bot

set -e

echo "🔍 VALIDATING CRITICAL FITLINK BOT CONFIGURATION..."
echo "=================================================="

ERRORS=0
WARNINGS=0

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}❌ ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. CHECK CRITICAL HARDCODED URLs
echo -e "\n${BLUE}1. Checking OAuth URL patterns...${NC}"

check_oauth_urls() {
    local file="$1"
    local provider="$2"
    
    if [ ! -f "$file" ]; then
        error "File not found: $file"
        return
    fi
    
    # Check for hardcoded Netlify URLs (GOOD)
    if grep -q "https://fitlinkbot.netlify.app" "$file"; then
        success "$provider uses correct hardcoded Netlify URL"
    else
        error "$provider missing hardcoded Netlify URL in $file"
    fi
    
    # Check for dangerous BASE_URL usage (BAD)
    if grep -q "BASE_URL" "$file" && ! grep -q "SUPABASE_URL" "$file"; then
        error "$provider uses BASE_URL env var in OAuth flow - this WILL break!"
    fi
    
    # Check for direct Supabase URLs (BAD)
    if grep -q "umixefoxgjmdlvvtfnmr.supabase.co" "$file"; then
        error "$provider uses direct Supabase URL - should use Netlify proxy"
    fi
}

check_oauth_urls "supabase/functions/oauth-oura/index.ts" "Oura"
check_oauth_urls "supabase/functions/oauth-strava/index.ts" "Strava"

# 2. CHECK NETLIFY PROXY CONFIGURATIONS
echo -e "\n${BLUE}2. Checking Netlify proxy configurations...${NC}"

check_proxy_config() {
    local file="$1"
    local provider="$2"
    
    if [ ! -f "$file" ]; then
        error "Proxy not found: $file"
        return
    fi
    
    # Check for required environment variable handling
    if grep -q "VITE_SUPABASE_ANON_KEY" "$file" && grep -q "SUPABASE_ANON_KEY" "$file"; then
        success "$provider proxy has fallback env var handling"
    else
        error "$provider proxy missing fallback env var handling"
    fi
    
    # Check for manual redirect handling
    if grep -q "redirect.*manual" "$file"; then
        success "$provider proxy has manual redirect handling"
    else
        error "$provider proxy missing manual redirect handling"
    fi
    
    # Check for Content-Type fixing
    if grep -q "Content-Type.*text/html" "$file"; then
        success "$provider proxy has Content-Type fixing"
    else
        warning "$provider proxy might not fix Content-Type headers"
    fi
}

check_proxy_config "netlify/edge-functions/oauth-oura-proxy.js" "Oura"
check_proxy_config "netlify/edge-functions/oauth-strava-proxy.js" "Strava"
check_proxy_config "netlify/edge-functions/telegram-proxy.js" "Telegram"

# 3. CHECK NETLIFY.TOML CONFIGURATION
echo -e "\n${BLUE}3. Checking netlify.toml configuration...${NC}"

if [ -f "netlify.toml" ]; then
    # Check for OAuth proxy mappings
    if grep -q "oauth-oura-proxy" netlify.toml && grep -q "/oauth-oura/\*" netlify.toml; then
        success "Oura proxy mapping configured"
    else
        error "Oura proxy mapping missing in netlify.toml"
    fi
    
    if grep -q "oauth-strava-proxy" netlify.toml && grep -q "/oauth-strava/\*" netlify.toml; then
        success "Strava proxy mapping configured"
    else
        error "Strava proxy mapping missing in netlify.toml"
    fi
    
    if grep -q "telegram-proxy" netlify.toml && grep -q "/api/telegram-webhook" netlify.toml; then
        success "Telegram webhook proxy mapping configured"
    else
        error "Telegram webhook proxy mapping missing in netlify.toml"
    fi
else
    error "netlify.toml not found"
fi

# 4. CHECK SUPABASE FUNCTION CONFIGS
echo -e "\n${BLUE}4. Checking Supabase function configurations...${NC}"

check_supabase_config() {
    local dir="$1"
    local name="$2"
    
    if [ -d "$dir" ]; then
        if [ -f "$dir/config.toml" ]; then
            if grep -q "verify_jwt = false" "$dir/config.toml"; then
                success "$name has JWT verification disabled"
            else
                error "$name missing 'verify_jwt = false' in config.toml"
            fi
        else
            warning "$name missing config.toml"
        fi
    else
        warning "$name function directory not found"
    fi
}

check_supabase_config "supabase/functions/oauth-oura" "oauth-oura"
check_supabase_config "supabase/functions/oauth-strava" "oauth-strava"
check_supabase_config "supabase/functions/telegram-webhook" "telegram-webhook"

# 5. CHECK BOT LOOP PREVENTION
echo -e "\n${BLUE}5. Checking Telegram bot loop prevention...${NC}"

if [ -f "supabase/functions/shared/telegram.ts" ]; then
    if grep -q "is_bot" "supabase/functions/shared/telegram.ts"; then
        success "Bot loop prevention check found"
    else
        error "Bot loop prevention missing - bot will respond to itself!"
    fi
else
    error "Main telegram handler not found"
fi

# 6. CHECK CRITICAL ENVIRONMENT VARIABLES
echo -e "\n${BLUE}6. Checking environment variable requirements...${NC}"

info "Checking if required env vars are referenced in code..."

# These should be present in Supabase functions
critical_vars=("TELEGRAM_BOT_TOKEN" "OURA_CLIENT_ID" "OURA_CLIENT_SECRET" "STRAVA_CLIENT_ID" "STRAVA_CLIENT_SECRET")

for var in "${critical_vars[@]}"; do
    if grep -r "$var" supabase/functions/ >/dev/null 2>&1; then
        success "$var is referenced in functions"
    else
        warning "$var not found in function code"
    fi
done

# 7. CHECK FOR DANGEROUS PATTERNS
echo -e "\n${BLUE}7. Checking for dangerous patterns...${NC}"

# Check for console.log with sensitive data
if grep -r "console.log.*token\|console.log.*secret\|console.log.*key" supabase/functions/ >/dev/null 2>&1; then
    warning "Found console.log statements that might leak sensitive data"
fi

# Check for http:// in production URLs (exclude this script itself)
if grep -r "http://.*fitlink" . --exclude="validate-critical-config.sh" >/dev/null 2>&1; then
    error "Found insecure HTTP URLs - should be HTTPS"
fi

# Check for localhost in production code
if grep -r "localhost" supabase/functions/ netlify/edge-functions/ >/dev/null 2>&1; then
    warning "Found localhost references in production code"
fi

# 8. SUMMARY AND RECOMMENDATIONS
echo -e "\n${BLUE}=================================================${NC}"
echo -e "${BLUE}VALIDATION SUMMARY:${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED! System should be stable.${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings found, but no critical errors.${NC}"
    echo -e "${YELLOW}System should work but review warnings above.${NC}"
else
    echo -e "${RED}🚨 $ERRORS CRITICAL ERRORS FOUND!${NC}"
    echo -e "${RED}DO NOT DEPLOY until these are fixed!${NC}"
    
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}Also found $WARNINGS warnings to review.${NC}"
    fi
fi

echo -e "\n${BLUE}Quick fixes for common issues:${NC}"
echo "• If OAuth URLs are wrong: Use 'https://fitlinkbot.netlify.app' (hardcoded)"
echo "• If proxy env vars fail: Check Netlify dashboard has VITE_SUPABASE_ANON_KEY set"
echo "• If HTML shows as text: Ensure proxy fixes Content-Type headers"
echo "• If 401 errors: Check JWT verification disabled in Supabase configs"
echo "• If bot loops: Add 'if (message.from?.is_bot) return;' check"

echo -e "\n${BLUE}Full validation complete!${NC}"
exit $ERRORS
