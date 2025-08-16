#!/bin/bash

# Schema Validation Script for Fitlink Bot
# Checks for mismatches between database schema and codebase

echo "🔍 FITLINK BOT SCHEMA VALIDATION"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

echo -e "\n${BLUE}1. Checking migration files for table schemas...${NC}"

# Extract table schemas from migrations
echo "📊 Analyzing database tables from migrations:"

# Function to extract column info from SQL
extract_table_schema() {
    local table_name=$1
    echo -e "\n  ${YELLOW}Table: $table_name${NC}"
    
    # Find the CREATE TABLE statement and extract columns
    grep -A 50 "CREATE TABLE $table_name" supabase/migrations/*.sql | \
    grep -E "^\s+[a-zA-Z_]+" | \
    head -20 | \
    while read line; do
        if [[ $line =~ ^[[:space:]]*([a-zA-Z_]+)[[:space:]]+([A-Z]+) ]]; then
            column="${BASH_REMATCH[1]}"
            datatype="${BASH_REMATCH[2]}"
            echo "    - $column: $datatype"
        fi
    done
}

# Check major tables
for table in "users" "providers" "oura_sleep" "oura_daily_activity" "oura_daily_stress" "oura_heart_rate" "activities"; do
    if grep -q "CREATE TABLE $table" supabase/migrations/*.sql 2>/dev/null; then
        extract_table_schema "$table"
    else
        echo -e "  ${RED}⚠️  Table $table not found in migrations${NC}"
        ((WARNINGS++))
    fi
done

echo -e "\n${BLUE}2. Checking TypeScript interfaces...${NC}"

# Check if TypeScript types match
echo "📋 Analyzing TypeScript interfaces:"

if [ -f "supabase/functions/shared/types.ts" ]; then
    echo "  ✅ Found types.ts"
    
    # Extract interface field names
    echo "  📝 User interface fields:"
    grep -A 20 "interface User" supabase/functions/shared/types.ts | \
    grep -E "^\s+[a-zA-Z_]+[?]?:" | \
    head -15 | \
    sed 's/[?:].*//g' | \
    sed 's/^[[:space:]]*/    - /'
    
    echo "  📝 Provider interface fields:"
    grep -A 15 "interface Provider" supabase/functions/shared/types.ts | \
    grep -E "^\s+[a-zA-Z_]+[?]?:" | \
    head -10 | \
    sed 's/[?:].*//g' | \
    sed 's/^[[:space:]]*/    - /'
else
    echo -e "  ${RED}❌ types.ts not found${NC}"
    ((ERRORS++))
fi

echo -e "\n${BLUE}3. Checking for column name mismatches in OAuth functions...${NC}"

# Check OAuth functions for potential column mismatches
echo "🔍 Scanning OAuth functions for schema issues:"

check_oauth_schema() {
    local file=$1
    local function_name=$2
    
    echo -e "\n  ${YELLOW}Checking $function_name...${NC}"
    
    if [ -f "$file" ]; then
        # Look for .upsert() calls and extract field names
        echo "    Field insertions found:"
        grep -A 20 "\.upsert(" "$file" | \
        grep -E "^\s+[a-zA-Z_]+:" | \
        head -10 | \
        sed 's/:.*//g' | \
        sed 's/^[[:space:]]*/      - /'
        
        # Check for potential mismatches (more sophisticated checking)
        if grep -q "total_sleep_duration:" "$file"; then
            echo -e "    ${RED}⚠️  Found 'total_sleep_duration:' as database field - should be 'total_sleep_minutes:'${NC}"
            ((WARNINGS++))
        fi
        
        if grep -q "deep_sleep_duration:" "$file"; then
            echo -e "    ${RED}⚠️  Found 'deep_sleep_duration:' as database field - should be 'deep_sleep_minutes:'${NC}"
            ((WARNINGS++))
        fi
        
        if grep -q "light_sleep_duration:" "$file"; then
            echo -e "    ${RED}⚠️  Found 'light_sleep_duration:' as database field - should be 'light_sleep_minutes:'${NC}"
            ((WARNINGS++))
        fi
        
        if grep -q "rem_sleep_duration:" "$file"; then
            echo -e "    ${RED}⚠️  Found 'rem_sleep_duration:' as database field - should be 'rem_sleep_minutes:'${NC}"
            ((WARNINGS++))
        fi
        
    else
        echo -e "    ${RED}❌ File not found: $file${NC}"
        ((ERRORS++))
    fi
}

# Check OAuth functions
check_oauth_schema "supabase/functions/oauth-oura/index.ts" "OAuth Oura"
check_oauth_schema "supabase/functions/data-sync-oura/index.ts" "Data Sync Oura"

echo -e "\n${BLUE}4. Checking for type mismatches...${NC}"

echo "🔬 Looking for potential type conversion issues:"

# Check for UUID/bigint confusion
echo "  🔍 Checking for UUID/bigint type issues:"
if grep -r "bigint" supabase/functions/ --exclude-dir=node_modules 2>/dev/null; then
    echo -e "    ${YELLOW}⚠️  Found bigint references in functions${NC}"
    ((WARNINGS++))
else
    echo "    ✅ No bigint references found in functions"
fi

# Check for user_id type consistency
echo "  🔍 Checking user_id usage patterns:"
user_id_patterns=$(grep -r "user_id.*:" supabase/functions/ --exclude-dir=node_modules 2>/dev/null | head -5)
if [ -n "$user_id_patterns" ]; then
    echo "    📋 user_id field patterns found:"
    echo "$user_id_patterns" | sed 's/^/      /'
else
    echo "    ✅ No obvious user_id type issues found"
fi

echo -e "\n${BLUE}5. Checking for common schema antipatterns...${NC}"

echo "🚨 Scanning for potential issues:"

# Check for hardcoded table/column references
echo "  🔍 Checking for hardcoded schema references:"
hardcoded_refs=$(grep -r "\.from('.*')" supabase/functions/ --exclude-dir=node_modules 2>/dev/null | \
                 grep -v "information_schema" | head -5)
if [ -n "$hardcoded_refs" ]; then
    echo "    📋 Table references found:"
    echo "$hardcoded_refs" | sed 's/^/      /'
else
    echo "    ✅ No concerning hardcoded references found"
fi

# Check for .select('*') usage
echo "  🔍 Checking for select all queries:"
select_all=$(grep -r "\.select('\*')" supabase/functions/ --exclude-dir=node_modules 2>/dev/null | wc -l)
if [ "$select_all" -gt 0 ]; then
    echo -e "    ${YELLOW}⚠️  Found $select_all select('*') queries - consider explicit column selection${NC}"
    ((WARNINGS++))
else
    echo "    ✅ No select('*') queries found"
fi

echo -e "\n${BLUE}6. Generating recommendations...${NC}"

echo "💡 Schema Maintenance Recommendations:"
echo "  1. ✅ Use explicit column names in .select() calls"
echo "  2. ✅ Match database column names exactly in .upsert() calls"
echo "  3. ✅ Use TypeScript interfaces to catch type mismatches"
echo "  4. ✅ Run this script before deploying schema changes"
echo "  5. ✅ Consider using database schema generation tools"

echo -e "\n${BLUE}7. Quick fixes for common issues...${NC}"

echo "🔧 Common schema fixes:"
echo "  Sleep data fields:"
echo "    - total_sleep_duration → total_sleep_minutes"
echo "    - deep_sleep_duration → deep_sleep_minutes" 
echo "    - light_sleep_duration → light_sleep_minutes"
echo "    - rem_sleep_duration → rem_sleep_minutes"
echo "    - Convert: seconds / 60 (not seconds / 3600)"

echo -e "\n================================="
echo "📊 VALIDATION SUMMARY:"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ No critical schema issues detected!${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warnings found - review recommended${NC}"
else
    echo -e "${RED}❌ $ERRORS errors and $WARNINGS warnings found${NC}"
fi

echo "================================="

# Exit with appropriate code
if [ $ERRORS -gt 0 ]; then
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    exit 2
else
    exit 0
fi
