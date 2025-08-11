import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { 
  BriefingContext, 
  AIBriefingResponse, 
  BriefingData,
  TelegramInlineKeyboardMarkup 
} from "../types.ts";
import { getUserById } from "../database/users.ts";
import { createBriefingKeyboard } from "../telegram/menus.ts";

interface BriefingResult {
  message?: string;
  keyboard?: TelegramInlineKeyboardMarkup;
  error?: string;
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
