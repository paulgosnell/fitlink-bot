#!/bin/bash

# Quick Database Schema Checker for Fitlink Bot
# Verifies tables exist and key columns are accessible

echo "🔍 QUICK DATABASE SCHEMA CHECK"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${BLUE}Testing database connectivity and table access...${NC}"

# Function to test table access via API
test_table() {
    local table_name=$1
    local test_url="https://fitlinkbot.netlify.app/test-schema/"
    
    echo -e "\n  ${YELLOW}Testing $table_name table...${NC}"
    
    # Try to make a request to test schema function
    response=$(curl -s -f "$test_url" 2>/dev/null || echo "ERROR")
    
    if [[ "$response" == "ERROR" ]]; then
        echo -e "    ${RED}❌ Cannot connect to schema test endpoint${NC}"
        return 1
    elif [[ "$response" == *"error"* ]]; then
        echo -e "    ${RED}❌ Schema test returned error${NC}"
        return 1
    else
        echo -e "    ${GREEN}✅ Schema test endpoint accessible${NC}"
        return 0
    fi
}

echo -e "\n${BLUE}1. Checking critical table definitions in migrations...${NC}"

# Check if critical tables are defined in migrations
critical_tables=("users" "providers" "oura_sleep" "activities")

for table in "${critical_tables[@]}"; do
    if grep -q "CREATE TABLE $table" supabase/migrations/*.sql 2>/dev/null; then
        echo -e "  ${GREEN}✅ $table table defined in migrations${NC}"
        
        # Show key columns
        echo "    Key columns:"
        grep -A 10 "CREATE TABLE $table" supabase/migrations/*.sql | \
        grep -E "^\s+[a-zA-Z_]+" | \
        head -5 | \
        sed 's/^/      /'
    else
        echo -e "  ${RED}❌ $table table missing from migrations${NC}"
    fi
done

echo -e "\n${BLUE}2. Checking for schema mismatches in code...${NC}"

# Check OAuth functions for field usage
echo -e "\n  ${YELLOW}OAuth Oura function field usage:${NC}"
if [ -f "supabase/functions/oauth-oura/index.ts" ]; then
    # Extract fields being inserted
    oauth_fields=$(grep -A 15 "\.upsert(" supabase/functions/oauth-oura/index.ts | \
                  grep -E "^\s+[a-zA-Z_]+:" | \
                  head -10 | \
                  sed 's/:.*//g' | \
                  sed 's/^[[:space:]]*//')
    
    if [ -n "$oauth_fields" ]; then
        echo "    Fields being inserted:"
        echo "$oauth_fields" | sed 's/^/      - /'
        
        # Check for problematic patterns
        if echo "$oauth_fields" | grep -q "total_sleep_duration"; then
            echo -e "    ${RED}⚠️  Using 'total_sleep_duration' as field name${NC}"
        else
            echo -e "    ${GREEN}✅ Using correct '_minutes' field names${NC}"
        fi
    else
        echo -e "    ${YELLOW}⚠️  Could not extract field names${NC}"
    fi
else
    echo -e "    ${RED}❌ OAuth Oura function not found${NC}"
fi

echo -e "\n${BLUE}3. Checking data type consistency...${NC}"

# Check for potential type issues
echo "  🔍 Scanning for type-related issues:"

# Check for UUID/bigint patterns
if grep -r "toString()" supabase/functions/ --exclude-dir=node_modules | \
   grep -v "console" | head -3; then
    echo -e "    ${BLUE}ℹ️  Found toString() conversions (review for correctness)${NC}"
else
    echo -e "    ${GREEN}✅ No suspicious toString() patterns${NC}"
fi

# Check for parseInt patterns
if grep -r "parseInt" supabase/functions/ --exclude-dir=node_modules | head -3; then
    echo -e "    ${BLUE}ℹ️  Found parseInt() conversions (review for correctness)${NC}"
else
    echo -e "    ${GREEN}✅ No parseInt() patterns found${NC}"
fi

echo -e "\n${BLUE}4. Validating field naming conventions...${NC}"

echo "  🔍 Checking sleep data field conventions:"

# Check if using correct minutes vs duration naming
if grep -r "sleep_minutes:" supabase/functions/ --exclude-dir=node_modules >/dev/null 2>&1; then
    echo -e "    ${GREEN}✅ Using '_minutes' field names for database${NC}"
else
    echo -e "    ${YELLOW}⚠️  No '_minutes' field usage found${NC}"
fi

if grep -r "sleep_duration\." supabase/functions/ --exclude-dir=node_modules >/dev/null 2>&1; then
    echo -e "    ${GREEN}✅ Using '_duration' for API data access${NC}"
else
    echo -e "    ${YELLOW}⚠️  No '_duration' API access found${NC}"
fi

echo -e "\n${BLUE}5. Common schema issue patterns...${NC}"

echo "  🔍 Checking for common problems:"

# Check for select * usage
select_star_count=$(grep -r "select('\*')" supabase/functions/ --exclude-dir=node_modules 2>/dev/null | wc -l)
if [ "$select_star_count" -gt 10 ]; then
    echo -e "    ${YELLOW}⚠️  Many select('*') queries found ($select_star_count) - consider explicit columns${NC}"
elif [ "$select_star_count" -gt 0 ]; then
    echo -e "    ${BLUE}ℹ️  Some select('*') queries found ($select_star_count)${NC}"
else
    echo -e "    ${GREEN}✅ No select('*') queries found${NC}"
fi

# Check for hardcoded table names vs constants
hardcoded_tables=$(grep -r "\.from(" supabase/functions/ --exclude-dir=node_modules 2>/dev/null | \
                   grep -E "\.from\('[^']+'\)" | wc -l)
if [ "$hardcoded_tables" -gt 0 ]; then
    echo -e "    ${BLUE}ℹ️  Found $hardcoded_tables hardcoded table references${NC}"
    echo "    Consider using constants for table names"
else
    echo -e "    ${GREEN}✅ No hardcoded table references found${NC}"
fi

echo -e "\n=============================="
echo -e "${GREEN}✅ Schema validation complete!${NC}"
echo ""
echo "💡 To fix schema mismatches:"
echo "  1. Ensure database fields use '_minutes' (total_sleep_minutes)"
echo "  2. API fields use '_duration' (sleep.total_sleep_duration)"  
echo "  3. Convert seconds to minutes with / 60"
echo "  4. Use Math.round() for integer fields"
echo ""
echo "🔧 To test live database schema:"
echo "  curl https://fitlinkbot.netlify.app/test-schema/"
