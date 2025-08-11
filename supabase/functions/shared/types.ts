// Shared types for the Fitlink Bot

export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  timezone: string;
  city?: string;
  briefing_hour: number;
  training_goal: string;
  is_active: boolean;
  paused_until?: string;
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  user_id: string;
  provider: 'oura' | 'strava';
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  provider_user_id?: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OuraSleep {
  id: string;
  user_id: string;
  date: string;
  total_sleep_minutes?: number;
  sleep_efficiency?: number;
  deep_sleep_minutes?: number;
  light_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  awake_minutes?: number;
  bedtime_start?: string;
  bedtime_end?: string;
  hrv_avg?: number;
  resting_heart_rate?: number;
  temperature_deviation?: number;
  respiratory_rate?: number;
  readiness_score?: number;
  raw_data?: any;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  source: 'oura' | 'strava';
  external_id: string;
  activity_type: 'run' | 'ride' | 'swim' | 'walk' | 'hike' | 'other';
  name?: string;
  start_time: string;
  duration_seconds: number;
  distance_meters?: number;
  elevation_gain_meters?: number;
  average_heart_rate?: number;
  max_heart_rate?: number;
  average_power?: number;
  weighted_power?: number;
  tss_estimated?: number;
  intensity_factor?: number;
  raw_data?: any;
  created_at: string;
}

export interface EnvDaily {
  id: string;
  user_id: string;
  date: string;
  city: string;
  temp_min_c?: number;
  temp_max_c?: number;
  humidity_percent?: number;
  wind_kph?: number;
  precipitation_mm?: number;
  air_quality_index?: number;
  sunrise_time?: string;
  sunset_time?: string;
  weather_description?: string;
  best_exercise_windows?: ExerciseWindow[];
  raw_data?: any;
  created_at: string;
}

export interface ExerciseWindow {
  start_hour: number;
  end_hour: number;
  conditions: string;
  temperature_c: number;
  wind_kph: number;
  precipitation_chance: number;
}

export interface BriefLog {
  id: string;
  user_id: string;
  date: string;
  sent_at: string;
  telegram_message_id?: number;
  ai_model?: string;
  tokens_used?: number;
  generation_time_ms?: number;
  feedback_rating?: 1 | -1;
  feedback_text?: string;
  briefing_data?: BriefingData;
  error_message?: string;
  created_at: string;
}

export interface BriefingData {
  headline: string;
  sleep_insight?: string;
  readiness_note?: string;
  training_plan: string;
  micro_actions: string[];
  weather_note?: string;
  caution?: string;
  data_sources: {
    has_sleep: boolean;
    has_activities: boolean;
    has_weather: boolean;
  };
}

export interface WeeklyLoadSummary {
  user_id: string;
  current_week_sessions: number;
  current_week_duration_seconds: number;
  current_week_distance_meters: number;
  current_week_tss: number;
  avg_weekly_sessions: number;
  avg_weekly_duration_seconds: number;
  avg_weekly_tss: number;
  last_activity_date?: string;
  load_change_percent: number;
}

export interface SleepTrends {
  user_id: string;
  last_sleep_date?: string;
  total_sleep_minutes?: number;
  sleep_efficiency?: number;
  hrv_avg?: number;
  resting_heart_rate?: number;
  temperature_deviation?: number;
  readiness_score?: number;
  avg_sleep_minutes?: number;
  avg_sleep_efficiency?: number;
  avg_hrv?: number;
  avg_rhr?: number;
  avg_temp_dev?: number;
  avg_readiness?: number;
  hrv_trend?: 'up' | 'down' | 'stable';
  rhr_trend?: 'up' | 'down' | 'stable';
  readiness_change?: number;
}

export interface TodaysConditions {
  user_id: string;
  date?: string;
  city?: string;
  temp_min_c?: number;
  temp_max_c?: number;
  humidity_percent?: number;
  wind_kph?: number;
  precipitation_mm?: number;
  air_quality_index?: number;
  sunrise_time?: string;
  sunset_time?: string;
  weather_description?: string;
  best_exercise_windows?: ExerciseWindow[];
  exercise_conditions: 'excellent' | 'good' | 'fair' | 'poor';
}

// Telegram API types
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

// AI Briefing types
export interface BriefingContext {
  user: User;
  sleep?: SleepTrends;
  training?: WeeklyLoadSummary;
  weather?: TodaysConditions;
  last_activities?: Activity[];
}

export interface AIBriefingResponse {
  headline: string;
  sleep_insight?: string;
  readiness_note?: string;
  training_plan: string;
  micro_actions: string[];
  weather_note?: string;
  caution?: string;
}

// OAuth types
export interface OAuthState {
  user_id: string;
  provider: 'oura' | 'strava';
  redirect_uri: string;
  state: string;
}

export interface OuraTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface StravaTokenResponse {
  access_token: string;
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  scope: string;
  athlete: {
    id: number;
    username?: string;
    firstname: string;
    lastname: string;
  };
}
