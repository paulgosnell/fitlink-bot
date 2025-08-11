import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { User } from "../types.ts";

export async function getUserByTelegramId(
  supabase: SupabaseClient,
  telegramId: number
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw error;
  }

  return data;
}

export async function getUserById(
  supabase: SupabaseClient,
  userId: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

export async function createUser(
  supabase: SupabaseClient,
  userData: {
    telegram_id: number;
    username?: string;
    first_name?: string;
    timezone?: string;
    city?: string;
    briefing_hour?: number;
    training_goal?: string;
    is_active?: boolean;
  }
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateUser(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<User>
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteUser(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    throw error;
  }
}

export async function getUsersForBriefing(
  supabase: SupabaseClient,
  hour: number,
  timezone: string
): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('briefing_hour', hour)
    .eq('timezone', timezone)
    .eq('is_active', true)
    .or('paused_until.is.null,paused_until.lt.' + new Date().toISOString().split('T')[0]);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getAllActiveUsers(
  supabase: SupabaseClient
): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getUserStats(
  supabase: SupabaseClient
): Promise<{
  total_users: number;
  active_users: number;
  users_with_oura: number;
  users_with_strava: number;
  users_with_both: number;
}> {
  // Get total and active users
  const { data: userStats, error: userError } = await supabase
    .from('users')
    .select('is_active')
    .eq('is_active', true);

  if (userError) throw userError;

  // Get provider connections
  const { data: providerStats, error: providerError } = await supabase
    .from('providers')
    .select('user_id, provider')
    .eq('is_active', true);

  if (providerError) throw providerError;

  const totalUsers = userStats?.length || 0;
  const activeUsers = totalUsers; // Since we filtered by is_active

  // Count users by provider
  const userProviders = new Map<string, Set<string>>();
  providerStats?.forEach(p => {
    if (!userProviders.has(p.user_id)) {
      userProviders.set(p.user_id, new Set());
    }
    userProviders.get(p.user_id)!.add(p.provider);
  });

  let usersWithOura = 0;
  let usersWithStrava = 0;
  let usersWithBoth = 0;

  userProviders.forEach(providers => {
    const hasOura = providers.has('oura');
    const hasStrava = providers.has('strava');
    
    if (hasOura) usersWithOura++;
    if (hasStrava) usersWithStrava++;
    if (hasOura && hasStrava) usersWithBoth++;
  });

  return {
    total_users: totalUsers,
    active_users: activeUsers,
    users_with_oura: usersWithOura,
    users_with_strava: usersWithStrava,
    users_with_both: usersWithBoth
  };
}
