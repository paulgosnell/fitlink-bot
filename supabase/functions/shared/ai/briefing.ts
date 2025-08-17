import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { 
  BriefingContext, 
  AIBriefingResponse, 
  BriefingData,
  TelegramInlineKeyboardMarkup,
  ComprehensiveOuraData
} from "../types.ts";
import { getUserById } from "../database/users.ts";
import { createBriefingKeyboard } from "../telegram/menus.ts";
import { generateHealthSummary, type HealthSummary } from "./health-summarizer.ts";

interface BriefingResult {
  message?: string;
  keyboard?: TelegramInlineKeyboardMarkup;
  error?: string;
}

// Generate enhanced briefing with deep health analysis
export async function generateDeepBriefing(
  userId: string,
  supabase: SupabaseClient,
  daysBack: number = 30
): Promise<BriefingResult> {
  try {
    // Generate comprehensive health summary
    const healthSummary = await generateHealthSummary(userId, supabase, daysBack);
    
    // Generate AI briefing with deep context
    const aiResponse = await generateDeepAIBriefing(healthSummary);
    
    // Format the narrative briefing message
    const briefingMessage = formatNarrativeBriefingMessage(healthSummary, aiResponse);
    
    // Log the briefing
    await logBriefing(userId, supabase, {
      headline: aiResponse.headline,
      sleep_insight: aiResponse.sleep_insight,
      readiness_note: aiResponse.readiness_note,
      training_plan: aiResponse.training_plan,
      micro_actions: aiResponse.micro_actions,
      weather_note: aiResponse.weather_note,
      caution: aiResponse.caution,
      data_sources: {
        has_sleep: healthSummary.recent.hrv_pattern.avg > 0,
        has_activities: healthSummary.recent.training_load.current > 0,
        has_weather: true
      }
    });

    return {
      message: briefingMessage,
      keyboard: createBriefingKeyboard()
    };

  } catch (error) {
    console.error("Error generating deep briefing:", error);
    return { error: "Failed to generate briefing. Please try again." };
  }
}

export async function generateBriefing(
  userId: string,
  supabase: SupabaseClient
): Promise<BriefingResult> {
  try {
    // Gather all user data
    const context = await gatherBriefingContext(userId, supabase);
    
    if (!context.user) {
      return { error: "User not found" };
    }

    // Check if we have any data sources
    const hasSleep = context.sleep?.last_sleep_date;
    const hasActivities = context.training?.last_activity_date;
    const hasWeather = context.weather?.date;

    // DEBUG: Log what data we actually have
    console.log("🔍 BRIEFING DEBUG DATA CHECK:");
    console.log("User ID:", userId);
    console.log("Sleep data:", context.sleep ? {
      last_sleep_date: context.sleep.last_sleep_date,
      total_sleep_minutes: context.sleep.total_sleep_minutes,
      sleep_efficiency: context.sleep.sleep_efficiency,
      hrv_avg: context.sleep.hrv_avg
    } : "NO SLEEP DATA");
    console.log("Training data:", context.training ? {
      last_activity_date: context.training.last_activity_date,
      current_week_sessions: context.training.current_week_sessions,
      current_week_tss: context.training.current_week_tss
    } : "NO TRAINING DATA");
    console.log("Weather data:", context.weather ? {
      date: context.weather.date,
      city: context.weather.city,
      temp_max_c: context.weather.temp_max_c
    } : "NO WEATHER DATA");
    console.log("hasSleep:", !!hasSleep, "hasActivities:", !!hasActivities, "hasWeather:", !!hasWeather);

    if (!hasSleep && !hasActivities && !hasWeather) {
      console.log("❌ ALL DATA SOURCES MISSING - returning no data error");
      return { 
        error: "No data available. Please connect your Oura Ring and/or Strava account to get personalized briefings." 
      };
    }

    // Generate AI briefing
    const aiResponse = await generateAIBriefing(context);
    
    // Format the briefing message
    const briefingMessage = formatBriefingMessage(context, aiResponse);
    
    // Log the briefing
    await logBriefing(userId, supabase, {
      headline: aiResponse.headline,
      sleep_insight: aiResponse.sleep_insight,
      readiness_note: aiResponse.readiness_note,
      training_plan: aiResponse.training_plan,
      micro_actions: aiResponse.micro_actions,
      weather_note: aiResponse.weather_note,
      caution: aiResponse.caution,
      data_sources: {
        has_sleep: !!hasSleep,
        has_activities: !!hasActivities,
        has_weather: !!hasWeather
      }
    });

    return {
      message: briefingMessage,
      keyboard: createBriefingKeyboard()
    };

  } catch (error) {
    console.error("Error generating briefing:", error);
    return { error: "Failed to generate briefing. Please try again." };
  }
}

async function gatherBriefingContext(
  userId: string,
  supabase: SupabaseClient
): Promise<BriefingContext> {
  console.log("🔍 gatherBriefingContext: Starting data gathering for user", userId);
  
  const [user, sleep, training, weather, recentActivities, ouraData] = await Promise.all([
    getUserById(supabase, userId),
    getSleepTrends(supabase, userId),
    getTrainingLoad(supabase, userId),
    getTodaysWeather(supabase, userId),
    getRecentActivities(supabase, userId, 3),
    getComprehensiveOuraData(supabase, userId)
  ]);

  console.log("🔍 gatherBriefingContext: Data gathering complete");
  console.log("User found:", !!user, user ? `(${user.first_name})` : "");
  console.log("Sleep data:", !!sleep);
  console.log("Training data:", !!training);
  console.log("Weather data:", !!weather);
  console.log("Recent activities:", recentActivities?.length || 0);
  console.log("Oura comprehensive:", !!ouraData);

  return {
    user: user!,
    sleep,
    training,
    weather,
    last_activities: recentActivities,
    oura_comprehensive: ouraData
  };
}

async function getSleepTrends(supabase: SupabaseClient, userId: string) {
  console.log("🔍 getSleepTrends: Starting for user", userId);
  
  const { data, error } = await supabase
    .from('sleep_recent_view')
    .select('*')
    .eq('user_id', userId)
    .single();

  console.log("🔍 getSleepTrends: sleep_recent_view query result:", { data, error });

  if (error) {
    console.warn("No sleep data found in view, trying direct table query:", error);
    
    // Fallback to querying oura_sleep table directly
    const { data: directData, error: directError } = await supabase
      .from('oura_sleep')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single();
    
    console.log("🔍 getSleepTrends: oura_sleep direct query result:", { directData, directError });
    
    if (directError) {
      console.warn("No sleep data found in direct table query:", directError);
      return undefined;
    }
    
    console.log("Found sleep data via direct query:", directData?.date);
    
    // Transform direct data to match view format
    return {
      user_id: userId,
      last_sleep_date: directData.date,
      // Convert from your actual schema (duration in numeric) to expected minutes
      total_sleep_minutes: directData.total_sleep_duration ? Math.round(directData.total_sleep_duration * 60) : null,
      deep_sleep_minutes: directData.deep_sleep_duration ? Math.round(directData.deep_sleep_duration * 60) : null,
      light_sleep_minutes: directData.light_sleep_duration ? Math.round(directData.light_sleep_duration * 60) : null,
      rem_sleep_minutes: directData.rem_sleep_duration ? Math.round(directData.rem_sleep_duration * 60) : null,
      sleep_efficiency: directData.sleep_score, // Map sleep_score to sleep_efficiency
      hrv_avg: null, // Not available in your schema
      resting_heart_rate: null, // Not available in your schema
      temperature_deviation: null, // Not available in your schema  
      readiness_score: directData.sleep_score, // Use sleep_score as readiness
      // Set averages to current values as fallback
      avg_sleep_minutes: directData.total_sleep_duration ? Math.round(directData.total_sleep_duration * 60) : null,
      avg_sleep_efficiency: directData.sleep_score,
      avg_hrv: null,
      avg_rhr: null,
      avg_temp_dev: null,
      avg_readiness: directData.sleep_score,
      hrv_trend: 'stable',
      rhr_trend: 'stable',
      readiness_change: 0
    };
  }

  return data;
}

async function getComprehensiveOuraData(supabase: SupabaseClient, userId: string): Promise<ComprehensiveOuraData | undefined> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [
      dailyActivity,
      dailyStress,
      heartRateData,
      temperatureData,
      spo2Data,
      recentWorkouts,
      recentSessions
    ] = await Promise.all([
      // Get yesterday's activity data (most recent complete day)
      supabase
        .from('oura_daily_activity')
        .select('*')
        .eq('user_id', userId)
        .in('date', [today, yesterday])
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      
      // Get recent stress data
      supabase
        .from('oura_daily_stress')
        .select('*')
        .eq('user_id', userId)
        .in('date', [today, yesterday])
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      
      // Get recent heart rate data (last 24 hours)
      supabase
        .from('oura_heart_rate')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100),
      
      // Get recent temperature data
      supabase
        .from('oura_temperature')
        .select('*')
        .eq('user_id', userId)
        .in('date', [today, yesterday])
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      
      // Get recent SPO2 data
      supabase
        .from('oura_daily_spo2')
        .select('*')
        .eq('user_id', userId)
        .in('date', [today, yesterday])
        .order('date', { ascending: false })
        .limit(1)
        .single(),
      
      // Get recent workouts (last 3 days)
      supabase
        .from('oura_workouts')
        .select('*')
        .eq('user_id', userId)
        .gte('day', threeDaysAgo)
        .order('start_datetime', { ascending: false })
        .limit(5),
      
      // Get recent sessions (last 3 days)
      supabase
        .from('oura_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('day', threeDaysAgo)
        .order('start_datetime', { ascending: false })
        .limit(5)
    ]);

    // Process heart rate data to calculate trends
    let heartRateProcessed;
    if (heartRateData.data && heartRateData.data.length > 0) {
      const heartRates = heartRateData.data.map(hr => hr.heart_rate);
      const avgHR = heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length;
      const recentHR = heartRates.slice(0, 10).reduce((sum, hr) => sum + hr, 0) / Math.min(10, heartRates.length);
      const olderHR = heartRates.slice(-10).reduce((sum, hr) => sum + hr, 0) / Math.min(10, heartRates.slice(-10).length);
      
      heartRateProcessed = {
        avg_resting_hr: Math.round(avgHR),
        latest_reading: heartRates[0],
        trend: Math.abs(recentHR - olderHR) < 2 ? 'stable' : (recentHR > olderHR ? 'up' : 'down')
      };
    }

    // Check for illness risk from temperature
    const illnessRisk = temperatureData.data?.temperature_deviation && 
                       Math.abs(temperatureData.data.temperature_deviation) > 0.5;

    const result: ComprehensiveOuraData = {
      daily_activity: dailyActivity.data ? {
        date: dailyActivity.data.date,
        activity_score: dailyActivity.data.activity_score,
        steps: dailyActivity.data.steps,
        active_calories: dailyActivity.data.active_calories,
        total_calories: dailyActivity.data.total_calories,
        high_activity_minutes: dailyActivity.data.high_activity_minutes,
        medium_activity_minutes: dailyActivity.data.medium_activity_minutes,
        low_activity_minutes: dailyActivity.data.low_activity_minutes,
        inactive_minutes: dailyActivity.data.inactive_minutes,
        average_met: dailyActivity.data.average_met,
      } : undefined,
      
      daily_stress: dailyStress.data ? {
        date: dailyStress.data.date,
        stress_high: dailyStress.data.stress_high,
        stress_recovery: dailyStress.data.stress_recovery,
        stress_day_summary: dailyStress.data.stress_day_summary,
      } : undefined,
      
      recent_heart_rate: heartRateProcessed,
      
      temperature: temperatureData.data ? {
        date: temperatureData.data.date,
        temperature_deviation: temperatureData.data.temperature_deviation,
        temperature_trend_deviation: temperatureData.data.temperature_trend_deviation,
        illness_risk: illnessRisk,
      } : undefined,
      
      spo2: spo2Data.data ? {
        date: spo2Data.data.date,
        spo2_percentage: spo2Data.data.spo2_percentage,
      } : undefined,
      
      recent_workouts: recentWorkouts.data?.map(workout => ({
        external_id: workout.external_id,
        activity: workout.activity,
        start_datetime: workout.start_datetime,
        intensity: workout.intensity,
        load: workout.load,
        average_heart_rate: workout.average_heart_rate,
        calories: workout.calories,
      })) || [],
      
      recent_sessions: recentSessions.data?.map(session => ({
        external_id: session.external_id,
        session_type: session.session_type,
        start_datetime: session.start_datetime,
        mood: session.mood,
        tags: session.tags,
      })) || []
    };

    console.log('Comprehensive Oura data gathered:', {
      hasActivity: !!result.daily_activity,
      hasStress: !!result.daily_stress,
      hasHeartRate: !!result.recent_heart_rate,
      hasTemperature: !!result.temperature,
      hasSPO2: !!result.spo2,
      workoutCount: result.recent_workouts?.length || 0,
      sessionCount: result.recent_sessions?.length || 0
    });

    return result;
  } catch (error) {
    console.error('Error gathering comprehensive Oura data:', error);
    return undefined;
  }
}

async function getTrainingLoad(supabase: SupabaseClient, userId: string) {
  console.log("🔍 getTrainingLoad: Starting for user", userId);
  
  // Since weekly_load_view won't work with your schema, let's query directly
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const { data: activities, error } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('user_id', userId)
    .gte('start_date', oneWeekAgo.toISOString())
    .order('start_date', { ascending: false });

  console.log("🔍 getTrainingLoad: strava_activities query result:", { 
    count: activities?.length, 
    error,
    dateRange: `${oneWeekAgo.toISOString().split('T')[0]} to now`
  });

  if (error) {
    console.warn("No training data found:", error);
    return undefined;
  }

  if (!activities || activities.length === 0) {
    console.log("🔍 getTrainingLoad: No activities found in last 7 days");
    return undefined;
  }

  // Calculate basic training metrics from your actual data
  const currentWeekSessions = activities.length;
  const currentWeekDuration = activities.reduce((sum, a) => sum + (a.moving_time || 0), 0);
  const currentWeekDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const lastActivityDate = activities[0]?.start_date;

  const trainingData = {
    user_id: userId,
    current_week_sessions: currentWeekSessions,
    current_week_duration_seconds: currentWeekDuration,
    current_week_distance_meters: Math.round(currentWeekDistance),
    current_week_tss: 0,  // Not available in your schema
    avg_weekly_sessions: currentWeekSessions,  // Use current as average for now
    avg_weekly_duration_seconds: currentWeekDuration,
    avg_weekly_tss: 0,
    last_activity_date: lastActivityDate,
    load_change_percent: 0
  };

  console.log("🔍 getTrainingLoad: Calculated training data:", trainingData);
  
  return trainingData;
}

async function getTodaysWeather(supabase: SupabaseClient, userId: string) {
  console.log("🔍 getTodaysWeather: Starting for user", userId);
  
  // First get the telegram_id for this user since env_daily uses bigint user_id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('telegram_id')
    .eq('id', userId)
    .single();
    
  if (userError || !user) {
    console.warn("Could not find user to get telegram_id:", userError);
    return undefined;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('env_daily')  // Use your actual table name
    .select('*')
    .eq('user_id', user.telegram_id)  // Use telegram_id for bigint user_id column
    .eq('date', today)
    .single();

  console.log("🔍 getTodaysWeather: env_daily query result:", { 
    telegram_id: user.telegram_id,
    data: !!data, 
    error 
  });

  if (error) {
    console.warn("No weather data found:", error);
    return undefined;
  }

  if (!data) {
    console.log("🔍 getTodaysWeather: No weather data for today");
    return undefined;
  }

  // Transform to expected format
  const weatherData = {
    user_id: userId,  // Return the UUID for consistency with other functions
    date: data.date,
    city: data.city,
    temp_min_c: data.temp_min_c,
    temp_max_c: data.temp_max_c,
    humidity_percent: data.humidity_percent,
    wind_kph: data.wind_kph,
    precipitation_mm: data.precipitation_mm,
    air_quality_index: data.air_quality_index,
    sunrise_time: data.sunrise_time,
    sunset_time: data.sunset_time,
    weather_description: data.weather_description,
    best_exercise_windows: data.best_exercise_windows,
    exercise_conditions: calculateExerciseConditions(data)
  };

  console.log("🔍 getTodaysWeather: Transformed weather data:", weatherData);
  
  return weatherData;
}

function calculateExerciseConditions(weather: any): string {
  if (weather.temp_max_c >= 10 && weather.temp_max_c <= 25 
      && weather.wind_kph < 20 
      && weather.precipitation_mm < 1) {
    return 'excellent';
  }
  if (weather.temp_max_c >= 5 && weather.temp_max_c <= 30 
      && weather.wind_kph < 30 
      && weather.precipitation_mm < 5) {
    return 'good';
  }
  if (weather.precipitation_mm > 10 || weather.wind_kph > 40) {
    return 'poor';
  }
  return 'fair';
}

async function getRecentActivities(supabase: SupabaseClient, userId: string, limit: number) {
  console.log("🔍 getRecentActivities: Starting for user", userId);
  
  const { data, error } = await supabase
    .from('strava_activities')  // Use your actual table name
    .select('*')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })  // Use your actual column name
    .limit(limit);

  console.log("🔍 getRecentActivities: strava_activities query result:", { data: data?.length, error });

  if (error) {
    console.warn("No recent activities found:", error);
    return [];
  }

  // Transform to expected format
  const transformedData = (data || []).map(activity => ({
    id: activity.id,
    user_id: activity.user_id,
    source: 'strava',
    external_id: activity.activity_id.toString(),
    activity_type: activity.activity_type,
    name: activity.name,
    start_time: activity.start_date,  // Map start_date to start_time
    duration_seconds: activity.moving_time,  // Map moving_time to duration_seconds
    distance_meters: activity.distance ? Math.round(activity.distance) : null,
    elevation_gain_meters: activity.total_elevation_gain,
    average_heart_rate: null,  // Not available in your schema
    max_heart_rate: null,      // Not available in your schema
    average_power: null,       // Not available in your schema
    weighted_power: null,      // Not available in your schema
    tss_estimated: null,       // Not available in your schema
    intensity_factor: null,    // Not available in your schema
    raw_data: {},
    created_at: activity.created_at
  }));

  return transformedData;
}

async function generateAIBriefing(context: BriefingContext): Promise<AIBriefingResponse> {
  // Use globalThis to access Deno in Edge Functions environment
  const anthropicKey = (globalThis as any).Deno?.env?.get('ANTHROPIC_API_KEY');
  const openaiKey = (globalThis as any).Deno?.env?.get('OPENAI_API_KEY');
  
  if (anthropicKey) {
    return generateClaudeBriefing(context, anthropicKey);
  } else if (openaiKey) {
    return generateOpenAIBriefing(context, openaiKey);
  } else {
    throw new Error('No AI API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)');
  }
}

async function generateClaudeBriefing(context: BriefingContext, apiKey: string): Promise<AIBriefingResponse> {
  const prompt = buildBriefingPrompt(context);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are Fitlink, a concise evidence-aware health coach. You only use the provided data. 
          You prioritise safety and practicality. Keep outputs under 10 lines, UK English.
          
          Return JSON with this exact structure:
          {
            "headline": "string",
            "sleep_insight": "string or null",
            "readiness_note": "string or null", 
            "training_plan": "string",
            "micro_actions": ["string", "string"],
            "weather_note": "string or null",
            "caution": "string or null"
          }
          
          Guidelines:
          - Never invent data points not provided
          - Use "caution" for overtraining/illness signals (RHR +3bpm, HRV -20%, temp deviation >0.5)
          - Suggest recovery days when load is 20%+ above average
          - Include 1-3 micro-actions (hydration, mobility, etc.)
          - Weather note only if relevant to exercise timing
          
          User data:
          ${prompt}`
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.content[0].text;
  
  try {
    // Extract JSON from Claude's response (it might include extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse Claude response:", content);
    throw new Error("Invalid AI response format");
  }
}

async function generateDeepAIBriefing(healthSummary: HealthSummary): Promise<AIBriefingResponse> {
  // Use globalThis to access Deno in Edge Functions environment
  const anthropicKey = (globalThis as any).Deno?.env?.get('ANTHROPIC_API_KEY');
  const openaiKey = (globalThis as any).Deno?.env?.get('OPENAI_API_KEY');
  
  if (anthropicKey) {
    return generateClaudeDeepBriefing(healthSummary, anthropicKey);
  } else if (openaiKey) {
    return generateOpenAIDeepBriefing(healthSummary, openaiKey);
  } else {
    throw new Error('No AI API key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY)');
  }
}

async function generateClaudeDeepBriefing(healthSummary: HealthSummary, apiKey: string): Promise<AIBriefingResponse> {
  const prompt = buildDeepBriefingPrompt(healthSummary);
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `You are Fitlink, an expert physiologist and data scientist. You analyze patterns in health data to provide profound insights in simple language.

Your task: Transform complex health data into a compelling narrative that helps someone understand their body's story.

Return JSON with this exact structure:
{
  "headline": "Your body's story today (engaging, human)",
  "sleep_insight": "Deep sleep pattern insight with trend context",
  "readiness_note": "Recovery status with predictive elements", 
  "training_plan": "Specific plan based on adaptation signals",
  "micro_actions": ["actionable habit", "precise timing"],
  "weather_note": "Weather-integrated advice if relevant",
  "caution": "Early warning if patterns suggest issues"
}

Key principles:
- Use "your body is telling you..." language
- Reference trends over days/weeks, not just today
- Include pattern recognition insights
- Suggest micro-habits with specific timing (e.g., "at 2pm", "before bed", "upon waking")
- Use predictive language: "this suggests...", "your pattern shows..."
- Flag early warning signs before they become problems
- Micro-actions should be specific, time-bound, and physiologically relevant
- Focus on 1-3 precise interventions rather than generic advice

Health Summary:
${prompt}`
        }
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.content[0].text;
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse Claude deep response:", content);
    throw new Error("Invalid AI response format");
  }
}

async function generateOpenAIDeepBriefing(healthSummary: HealthSummary, apiKey: string): Promise<AIBriefingResponse> {
  const prompt = buildDeepBriefingPrompt(healthSummary);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are Fitlink, an expert physiologist and data scientist. You analyze patterns in health data to provide profound insights in simple language. Transform complex health data into compelling narratives.

Return JSON with this exact structure:
{
  "headline": "Your body's story today (engaging, human)",
  "sleep_insight": "Deep sleep pattern insight with trend context",
  "readiness_note": "Recovery status with predictive elements", 
  "training_plan": "Specific plan based on adaptation signals",
  "micro_actions": ["actionable habit", "precise timing"],
  "weather_note": "Weather-integrated advice if relevant",
  "caution": "Early warning if patterns suggest issues"
}

Key principles:
- Use "your body is telling you..." language
- Reference trends over days/weeks, not just today
- Include pattern recognition insights
- Suggest micro-habits with specific timing (e.g., "at 2pm", "before bed", "upon waking")
- Use predictive language: "this suggests...", "your pattern shows..."
- Flag early warning signs before they become problems
- Micro-actions should be specific, time-bound, and physiologically relevant
- Focus on 1-3 precise interventions rather than generic advice`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse OpenAI deep response:", content);
    throw new Error("Invalid AI response format");
  }
}

async function generateOpenAIBriefing(context: BriefingContext, apiKey: string): Promise<AIBriefingResponse> {
  const prompt = buildBriefingPrompt(context);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are Fitlink, a concise evidence-aware health coach. You only use the provided data. 
          You prioritise safety and practicality. Keep outputs under 10 lines, UK English.
          
          Return JSON with this exact structure:
          {
            "headline": "string",
            "sleep_insight": "string or null",
            "readiness_note": "string or null", 
            "training_plan": "string",
            "micro_actions": ["string", "string"],
            "weather_note": "string or null",
            "caution": "string or null"
          }
          
          Guidelines:
          - Never invent data points not provided
          - Use "caution" for overtraining/illness signals (RHR +3bpm, HRV -20%, temp deviation >0.5)
          - Suggest recovery days when load is 20%+ above average
          - Include 1-3 micro-actions (hydration, mobility, etc.)
          - Weather note only if relevant to exercise timing`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse OpenAI response:", content);
    throw new Error("Invalid AI response format");
  }
}

function buildDeepBriefingPrompt(healthSummary: HealthSummary): string {
  const { user_profile, recent, weekly, monthly, predictive_flags } = healthSummary;
  
  let prompt = `User Profile: ${user_profile.age}yr ${user_profile.sex}, ${user_profile.training_goal}, ${user_profile.experience_level} level\n\n`;

  prompt += `RECENT TRENDS (last 3 days):\n`;
  prompt += `- Sleep trend: ${recent.sleep_trend}\n`;
  prompt += `- HRV: avg ${recent.hrv_pattern.avg.toFixed(1)}, trend ${recent.hrv_pattern.trend > 0 ? '+' : ''}${recent.hrv_pattern.trend.toFixed(1)}%\n`;
  if (recent.hrv_pattern.alerts.length > 0) {
    prompt += `- HRV alerts: ${recent.hrv_pattern.alerts.join(', ')}\n`;
  }
  prompt += `- Training load: ${recent.training_load.current} TSS (weekly avg: ${recent.training_load.weekly_avg})\n`;
  prompt += `- Fatigue score: ${recent.training_load.fatigue_score}/100\n`;
  prompt += `- RHR change: ${recent.recovery_markers.rhr_change > 0 ? '+' : ''}${recent.recovery_markers.rhr_change.toFixed(1)} bpm\n`;
  prompt += `- Temperature deviation: ${recent.recovery_markers.temp_deviation}°C\n`;
  prompt += `- Energy pattern: ${recent.energy_pattern}\n\n`;

  prompt += `WEEKLY INSIGHTS (7-14 days):\n`;
  prompt += `- Sleep consistency: ${weekly.sleep_consistency}/100\n`;
  prompt += `- Training progression: ${weekly.training_progression}\n`;
  prompt += `- Stress indicators: ${weekly.stress_indicators.poor_hrv_days} poor HRV days, ${weekly.stress_indicators.elevated_rhr_days} elevated RHR days\n`;
  prompt += `- Performance: ${weekly.performance_markers.quality_sessions} quality sessions, ${weekly.performance_markers.recovery_days} recovery days\n`;
  if (weekly.adaptation_signals.length > 0) {
    prompt += `- Adaptation signals: ${weekly.adaptation_signals.join(', ')}\n`;
  }
  prompt += `\n`;

  prompt += `MONTHLY PATTERNS (30 days):\n`;
  prompt += `- HRV trend: ${monthly.baseline_shifts.hrv_trend > 0 ? 'improving' : 'declining'} (${monthly.baseline_shifts.hrv_trend.toFixed(2)}/day)\n`;
  prompt += `- RHR trend: ${monthly.baseline_shifts.rhr_trend > 0 ? 'increasing' : 'decreasing'} (${monthly.baseline_shifts.rhr_trend.toFixed(2)}/day)\n`;
  prompt += `- Training cycles: ${monthly.adaptation_cycles.training_blocks} build phases, ${monthly.adaptation_cycles.recovery_phases} recovery phases\n`;
  prompt += `- Health correlations: sleep-training ${monthly.health_correlations.sleep_training.toFixed(2)}, stress-recovery ${monthly.health_correlations.stress_recovery.toFixed(2)}\n`;
  if (monthly.seasonal_trends.length > 0) {
    prompt += `- Seasonal patterns: ${monthly.seasonal_trends.join(', ')}\n`;
  }
  if (monthly.lifestyle_patterns.length > 0) {
    prompt += `- Lifestyle patterns: ${monthly.lifestyle_patterns.join(', ')}\n`;
  }
  prompt += `\n`;

  prompt += `PREDICTIVE FLAGS:\n`;
  prompt += `- Illness risk: ${predictive_flags.illness_risk}\n`;
  prompt += `- Overtraining risk: ${predictive_flags.overtraining_risk}\n`;
  if (predictive_flags.peak_performance_window) {
    prompt += `- Peak performance window: ${predictive_flags.peak_performance_window}\n`;
  }

  return prompt;
}

function formatNarrativeBriefingMessage(healthSummary: HealthSummary, ai: AIBriefingResponse): string {
  const { user_profile, predictive_flags } = healthSummary;
  const greeting = getTimeBasedGreeting();
  
  let message = `${greeting}! 🧠\n\n`;
  
  message += `📖 **${ai.headline}**\n\n`;
  
  if (ai.sleep_insight) {
    message += `💤 **Sleep Story:** ${ai.sleep_insight}\n\n`;
  }
  
  if (ai.readiness_note) {
    message += `⚡ **Recovery Status:** ${ai.readiness_note}\n\n`;
  }
  
  message += `🎯 **Today's Plan:** ${ai.training_plan}\n\n`;
  
  if (ai.micro_actions && ai.micro_actions.length > 0) {
    message += `💎 **Micro-Wins:**\n`;
    ai.micro_actions.forEach(action => {
      message += `• ${action}\n`;
    });
    message += `\n`;
  }
  
  // Add predictive insights
  if (predictive_flags.peak_performance_window) {
    message += `🚀 **Performance Window:** ${predictive_flags.peak_performance_window}\n\n`;
  }
  
  if (predictive_flags.illness_risk === 'high' || predictive_flags.overtraining_risk === 'high') {
    message += `🛡️ **Early Warning:** `;
    const warnings: string[] = [];
    if (predictive_flags.illness_risk === 'high') warnings.push('illness signals detected');
    if (predictive_flags.overtraining_risk === 'high') warnings.push('overtraining risk elevated');
    message += warnings.join(', ') + '\n\n';
  }
  
  if (ai.caution) {
    message += `⚠️ **Your Body Says:** ${ai.caution}\n\n`;
  }
  
  message += `_Your body is an amazing storyteller. Listen closely. 💪_`;
  
  return message;
}

function buildBriefingPrompt(context: BriefingContext): string {
  const { user, sleep, training, weather, last_activities, oura_comprehensive } = context;
  
  let prompt = `User: ${user.first_name}, goal: ${user.training_goal.replace('_', ' ')}\n\n`;

  // Sleep data
  if (sleep?.last_sleep_date) {
    prompt += `Sleep (last night):\n`;
    prompt += `- Duration: ${Math.round((sleep.total_sleep_minutes || 0) / 60 * 10) / 10}h\n`;
    prompt += `- Efficiency: ${sleep.sleep_efficiency}%\n`;
    if (sleep.hrv_avg) prompt += `- HRV: ${sleep.hrv_avg} (trend: ${sleep.hrv_trend})\n`;
    if (sleep.resting_heart_rate) prompt += `- RHR: ${sleep.resting_heart_rate} (trend: ${sleep.rhr_trend})\n`;
    if (sleep.temperature_deviation) prompt += `- Temp deviation: ${sleep.temperature_deviation}°C\n`;
    if (sleep.readiness_score) prompt += `- Readiness: ${sleep.readiness_score}`;
    if (sleep.readiness_change) prompt += ` (${sleep.readiness_change > 0 ? '+' : ''}${Math.round(sleep.readiness_change)})`;
    prompt += `\n\n`;
  }

  // Comprehensive Oura health data
  if (oura_comprehensive) {
    // Daily activity metrics
    if (oura_comprehensive.daily_activity) {
      const activity = oura_comprehensive.daily_activity;
      prompt += `Daily Activity (yesterday):\n`;
      if (activity.steps) prompt += `- Steps: ${activity.steps.toLocaleString()}\n`;
      if (activity.active_calories) prompt += `- Active calories: ${activity.active_calories}\n`;
      if (activity.activity_score) prompt += `- Activity score: ${activity.activity_score}/100\n`;
      if (activity.high_activity_minutes) prompt += `- High activity: ${activity.high_activity_minutes}min\n`;
      if (activity.inactive_minutes) prompt += `- Inactive time: ${Math.round(activity.inactive_minutes / 60)}h\n`;
      prompt += `\n`;
    }

    // Stress and recovery data
    if (oura_comprehensive.daily_stress) {
      const stress = oura_comprehensive.daily_stress;
      prompt += `Stress & Recovery:\n`;
      if (stress.stress_day_summary) prompt += `- Day summary: ${stress.stress_day_summary}\n`;
      if (stress.stress_high) prompt += `- High stress: ${stress.stress_high}min\n`;
      if (stress.stress_recovery) prompt += `- Recovery time: ${stress.stress_recovery}min\n`;
      prompt += `\n`;
    }

    // Heart rate trends
    if (oura_comprehensive.recent_heart_rate) {
      const hr = oura_comprehensive.recent_heart_rate;
      prompt += `Heart Rate Trends:\n`;
      if (hr.avg_resting_hr) prompt += `- Average RHR: ${hr.avg_resting_hr}bpm\n`;
      if (hr.latest_reading) prompt += `- Latest: ${hr.latest_reading}bpm\n`;
      if (hr.trend) prompt += `- Trend: ${hr.trend}\n`;
      prompt += `\n`;
    }

    // Temperature and illness detection
    if (oura_comprehensive.temperature) {
      const temp = oura_comprehensive.temperature;
      prompt += `Body Temperature:\n`;
      if (temp.temperature_deviation) prompt += `- Deviation: ${temp.temperature_deviation}°C\n`;
      if (temp.illness_risk) prompt += `- ⚠️ Illness risk detected\n`;
      prompt += `\n`;
    }

    // Blood oxygen
    if (oura_comprehensive.spo2?.spo2_percentage) {
      prompt += `Blood Oxygen: Available\n\n`;
    }

    // Recent Oura workouts
    if (oura_comprehensive.recent_workouts && oura_comprehensive.recent_workouts.length > 0) {
      prompt += `Recent Oura Workouts:\n`;
      oura_comprehensive.recent_workouts.slice(0, 3).forEach(workout => {
        const date = new Date(workout.start_datetime).toLocaleDateString();
        prompt += `- ${date}: ${workout.activity} (${workout.intensity})`;
        if (workout.load) prompt += ` Load: ${workout.load}`;
        if (workout.calories) prompt += ` Cal: ${workout.calories}`;
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    // Recovery sessions (meditation, breathing)
    if (oura_comprehensive.recent_sessions && oura_comprehensive.recent_sessions.length > 0) {
      prompt += `Recovery Sessions:\n`;
      oura_comprehensive.recent_sessions.slice(0, 2).forEach(session => {
        const date = new Date(session.start_datetime).toLocaleDateString();
        prompt += `- ${date}: ${session.session_type}`;
        if (session.mood) prompt += ` (${session.mood})`;
        prompt += `\n`;
      });
      prompt += `\n`;
    }
  }

  // Training load
  if (training?.current_week_sessions !== undefined) {
    prompt += `Training (7 days):\n`;
    prompt += `- Sessions: ${training.current_week_sessions} (avg: ${Math.round(training.avg_weekly_sessions * 10) / 10})\n`;
    prompt += `- Duration: ${Math.round(training.current_week_duration_seconds / 3600 * 10) / 10}h\n`;
    if (training.current_week_tss > 0) {
      prompt += `- TSS: ${Math.round(training.current_week_tss)} (${training.load_change_percent > 0 ? '+' : ''}${training.load_change_percent}%)\n`;
    }
    prompt += `\n`;
  }

  // Recent Strava activities
  if (last_activities && last_activities.length > 0) {
    prompt += `Recent Strava activities:\n`;
    last_activities.slice(0, 2).forEach(activity => {
      const date = new Date(activity.start_time).toLocaleDateString();
      const duration = Math.round(activity.duration_seconds / 60);
      const distance = activity.distance_meters ? ` ${Math.round(activity.distance_meters / 1000 * 10) / 10}km` : '';
      prompt += `- ${date}: ${activity.activity_type}${distance} (${duration}min)\n`;
    });
    prompt += `\n`;
  }

  // Weather
  if (weather?.date) {
    prompt += `Weather today (${weather.city}):\n`;
    prompt += `- Temp: ${weather.temp_min_c}–${weather.temp_max_c}°C\n`;
    prompt += `- Conditions: ${weather.weather_description}\n`;
    if (weather.wind_kph) prompt += `- Wind: ${weather.wind_kph}kph\n`;
    if (weather.precipitation_mm) prompt += `- Rain: ${weather.precipitation_mm}mm\n`;
    prompt += `- Exercise conditions: ${weather.exercise_conditions}\n`;
  }

  return prompt;
}

function formatBriefingMessage(context: BriefingContext, ai: AIBriefingResponse): string {
  const { user } = context;
  const greeting = getTimeBasedGreeting();
  
  let message = `${greeting} ${user.first_name || 'there'}! 👋\n\n`;
  
  message += `**${ai.headline}**\n\n`;
  
  if (ai.sleep_insight) {
    message += `💤 **Sleep:** ${ai.sleep_insight}\n\n`;
  }
  
  if (ai.readiness_note) {
    message += `⚡ **Readiness:** ${ai.readiness_note}\n\n`;
  }
  
  message += `🎯 **Plan:** ${ai.training_plan}\n\n`;
  
  if (ai.weather_note) {
    message += `🌤️ **Weather:** ${ai.weather_note}\n\n`;
  }
  
  if (ai.micro_actions && ai.micro_actions.length > 0) {
    message += `✅ **Actions:**\n`;
    ai.micro_actions.forEach(action => {
      message += `• ${action}\n`;
    });
    message += `\n`;
  }
  
  if (ai.caution) {
    message += `⚠️ **Note:** ${ai.caution}\n\n`;
  }
  
  message += `_Stay strong! 💪_`;
  
  return message;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

async function logBriefing(
  userId: string,
  supabase: SupabaseClient,
  briefingData: BriefingData
): Promise<void> {
  const { error } = await supabase
    .from('brief_logs')
    .insert([{
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      ai_model: 'gpt-4-turbo-preview',
      briefing_data: briefingData
    }]);

  if (error) {
    console.error("Error logging briefing:", error);
  }
}
