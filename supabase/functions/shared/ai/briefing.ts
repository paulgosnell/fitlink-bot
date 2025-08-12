import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { 
  BriefingContext, 
  AIBriefingResponse, 
  BriefingData,
  TelegramInlineKeyboardMarkup 
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

    if (!hasSleep && !hasActivities && !hasWeather) {
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
  const [user, sleep, training, weather, recentActivities] = await Promise.all([
    getUserById(supabase, userId),
    getSleepTrends(supabase, userId),
    getTrainingLoad(supabase, userId),
    getTodaysWeather(supabase, userId),
    getRecentActivities(supabase, userId, 3)
  ]);

  return {
    user: user!,
    sleep,
    training,
    weather,
    last_activities: recentActivities
  };
}

async function getSleepTrends(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('sleep_recent_view')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.warn("No sleep data found:", error);
    return undefined;
  }

  return data;
}

async function getTrainingLoad(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('weekly_load_view')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.warn("No training data found:", error);
    return undefined;
  }

  return data;
}

async function getTodaysWeather(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('todays_conditions_view')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.warn("No weather data found:", error);
    return undefined;
  }

  return data;
}

async function getRecentActivities(supabase: SupabaseClient, userId: string, limit: number) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("No recent activities found:", error);
    return [];
  }

  return data || [];
}

async function generateAIBriefing(context: BriefingContext): Promise<AIBriefingResponse> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
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
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
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
    const warnings = [];
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
  const { user, sleep, training, weather, last_activities } = context;
  
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

  // Recent activities
  if (last_activities && last_activities.length > 0) {
    prompt += `Recent activities:\n`;
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
