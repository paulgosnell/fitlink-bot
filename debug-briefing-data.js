#!/usr/bin/env node

// Quick script to debug briefing data issues
// This will help identify why briefings always show "no data available"

const DEBUG_USER_ID = "test-user-123"; // Replace with actual user ID

console.log("🔍 DEBUGGING BRIEFING DATA ISSUES");
console.log("===================================");

console.log("\n1. The briefing system checks these 3 conditions:");
console.log("   - hasSleep = context.sleep?.last_sleep_date");
console.log("   - hasActivities = context.training?.last_activity_date"); 
console.log("   - hasWeather = context.weather?.date");

console.log("\n2. These come from database views:");
console.log("   - sleep_recent_view");
console.log("   - weekly_load_view");
console.log("   - todays_conditions_view");

console.log("\n3. Potential issues:");
console.log("   ❌ No users have connected Oura/Strava accounts");
console.log("   ❌ Data sync functions not running/working");
console.log("   ❌ Database views don't exist or have no data");
console.log("   ❌ User IDs not matching between tables");

console.log("\n4. To fix this, check:");
console.log("   📋 Are there any rows in 'providers' table?");
console.log("   📋 Are there any rows in 'oura_sleep' table?");
console.log("   📋 Are there any rows in 'activities' table?");
console.log("   📋 Do the database views return data?");
console.log("   📋 Are data sync functions working?");

console.log("\n5. Test queries to run:");
console.log("   SELECT COUNT(*) FROM providers WHERE is_active = true;");
console.log("   SELECT COUNT(*) FROM oura_sleep;");
console.log("   SELECT COUNT(*) FROM activities;");
console.log("   SELECT COUNT(*) FROM users WHERE is_active = true;");
console.log("   SELECT * FROM sleep_recent_view LIMIT 5;");
console.log("   SELECT * FROM weekly_load_view LIMIT 5;");
console.log("   SELECT * FROM todays_conditions_view LIMIT 5;");

console.log("\n6. Manual test:");
console.log("   Try triggering data sync manually:");
console.log("   curl -X POST 'https://fitlinkbot.netlify.app/oauth-oura/sync'");
console.log("   curl -X POST 'https://fitlinkbot.netlify.app/oauth-strava/sync'");

console.log("\n✅ Use the test dashboard to see actual user data:");
console.log("   https://fitlinkbot.netlify.app/test-dashboard.html");
