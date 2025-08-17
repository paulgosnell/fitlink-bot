#!/usr/bin/env node

// Debug script to test briefing data availability
// Run with: node debug-briefing-data.js [telegram_id]

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://umixefoxgjmdlvvtfnmr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.log('Run: export SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function debugUserData(telegramId) {
  console.log('🔍 DEBUGGING BRIEFING DATA for Telegram ID:', telegramId);
  console.log('=' + '='.repeat(50));
  
  // Find user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
    
  if (userError) {
    console.error('❌ User lookup error:', userError);
    return;
  }
  
  if (!user) {
    console.error('❌ User not found for telegram_id:', telegramId);
    return;
  }
  
  console.log('✅ User found:', {
    uuid: user.id,
    telegram_id: user.telegram_id,
    first_name: user.first_name,
    training_goal: user.training_goal
  });
  
  const userId = user.id;
  
  // Check sleep data (oura_sleep table)
  console.log('\n🛌 SLEEP DATA CHECK:');
  const { data: sleepData, error: sleepError } = await supabase
    .from('oura_sleep')
    .select('date, total_sleep_duration, sleep_score')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3);
    
  if (sleepError) {
    console.log('❌ Sleep data error:', sleepError.message);
  } else if (!sleepData || sleepData.length === 0) {
    console.log('❌ No sleep data found in oura_sleep table');
  } else {
    console.log('✅ Sleep data found:', sleepData.length, 'records');
    console.log('   Latest:', sleepData[0]);
  }
  
  // Check activity data (strava_activities table)
  console.log('\n🏃 ACTIVITY DATA CHECK:');
  const { data: activityData, error: activityError } = await supabase
    .from('strava_activities')
    .select('start_date, activity_type, name, distance')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(3);
    
  if (activityError) {
    console.log('❌ Activity data error:', activityError.message);
  } else if (!activityData || activityData.length === 0) {
    console.log('❌ No activity data found in strava_activities table');
  } else {
    console.log('✅ Activity data found:', activityData.length, 'records');
    console.log('   Latest:', activityData[0]);
  }
  
  // Check weather data (env_daily table) - uses telegram_id as bigint user_id
  console.log('\n🌤️ WEATHER DATA CHECK:');
  const today = new Date().toISOString().split('T')[0];
  const { data: weatherData, error: weatherError } = await supabase
    .from('env_daily')
    .select('date, city, temp_max_c, weather_description')
    .eq('user_id', user.telegram_id)  // Note: env_daily uses telegram_id
    .eq('date', today);
    
  if (weatherError) {
    console.log('❌ Weather data error:', weatherError.message);
  } else if (!weatherData || weatherData.length === 0) {
    console.log('❌ No weather data found for today in env_daily table');
  } else {
    console.log('✅ Weather data found:', weatherData[0]);
  }
  
  // Check provider connections
  console.log('\n🔗 PROVIDER CONNECTIONS CHECK:');
  const { data: providers, error: providerError } = await supabase
    .from('providers')
    .select('provider_name, is_active, last_sync_at')
    .eq('user_id', userId);
    
  if (providerError) {
    console.log('❌ Provider data error:', providerError.message);
  } else if (!providers || providers.length === 0) {
    console.log('❌ No provider connections found');
  } else {
    console.log('✅ Provider connections:');
    providers.forEach(p => {
      console.log(`   ${p.provider_name}: ${p.is_active ? 'active' : 'inactive'}, last sync: ${p.last_sync_at}`);
    });
  }
  
  // Summary
  console.log('\n📊 SUMMARY:');
  const hasValidSleep = sleepData && sleepData.length > 0;
  const hasValidActivity = activityData && activityData.length > 0;
  const hasValidWeather = weatherData && weatherData.length > 0;
  
  console.log(`Sleep data available: ${hasValidSleep ? '✅' : '❌'}`);
  console.log(`Activity data available: ${hasValidActivity ? '✅' : '❌'}`);
  console.log(`Weather data available: ${hasValidWeather ? '✅' : '❌'}`);
  
  if (!hasValidSleep && !hasValidActivity && !hasValidWeather) {
    console.log('\n❌ THIS IS WHY BRIEFINGS SHOW "NO DATA AVAILABLE"');
    console.log('   All three data sources are missing');
  } else if (hasValidSleep || hasValidActivity || hasValidWeather) {
    console.log('\n🤔 BRIEFING SHOULD WORK - some data is available');
    console.log('   The issue might be in the briefing function logic');
  }
}

// Usage: node debug-briefing-data.js [telegram_id]
const telegramId = process.argv[2] || '6633924938';  // Default to your telegram ID
debugUserData(telegramId).catch(console.error);
