import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type { Provider } from "../types.ts";
import { encryptToken, decryptToken } from "../utils/encryption.ts";

export async function getProvidersByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<Provider[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  // Decrypt tokens before returning
  return (data || []).map(provider => ({
    ...provider,
    access_token: decryptToken(provider.access_token),
    refresh_token: provider.refresh_token ? decryptToken(provider.refresh_token) : undefined
  }));
}

export async function getProviderByUserAndType(
  supabase: SupabaseClient,
  userId: string,
  provider: 'oura' | 'strava'
): Promise<Provider | null> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  // Decrypt tokens before returning
  return {
    ...data,
    access_token: decryptToken(data.access_token),
    refresh_token: data.refresh_token ? decryptToken(data.refresh_token) : undefined
  };
}

export async function createOrUpdateProvider(
  supabase: SupabaseClient,
  providerData: {
    user_id: string;
    provider: 'oura' | 'strava';
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    provider_user_id?: string;
    scopes?: string[];
  }
): Promise<Provider> {
  // Encrypt tokens before storing
  const encryptedData = {
    ...providerData,
    access_token: encryptToken(providerData.access_token),
    refresh_token: providerData.refresh_token ? encryptToken(providerData.refresh_token) : undefined
  };

  // Try to update existing provider first
  const { data: existing } = await supabase
    .from('providers')
    .select('id')
    .eq('user_id', providerData.user_id)
    .eq('provider', providerData.provider)
    .single();

  if (existing) {
    // Update existing provider
    const { data, error } = await supabase
      .from('providers')
      .update({
        ...encryptedData,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    
    return {
      ...data,
      access_token: providerData.access_token,
      refresh_token: providerData.refresh_token
    };
  } else {
    // Create new provider
    const { data, error } = await supabase
      .from('providers')
      .insert([encryptedData])
      .select()
      .single();

    if (error) throw error;
    
    return {
      ...data,
      access_token: providerData.access_token,
      refresh_token: providerData.refresh_token
    };
  }
}

export async function updateProviderTokens(
  supabase: SupabaseClient,
  providerId: string,
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  }
): Promise<Provider> {
  const encryptedTokens = {
    access_token: encryptToken(tokens.access_token),
    refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
    expires_at: tokens.expires_at,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('providers')
    .update(encryptedTokens)
    .eq('id', providerId)
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  };
}

export async function deactivateProvider(
  supabase: SupabaseClient,
  userId: string,
  provider: 'oura' | 'strava'
): Promise<void> {
  const { error } = await supabase
    .from('providers')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw error;
}

export async function deleteProvider(
  supabase: SupabaseClient,
  userId: string,
  provider: 'oura' | 'strava'
): Promise<void> {
  const { error } = await supabase
    .from('providers')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw error;
}

export async function getExpiredProviders(
  supabase: SupabaseClient
): Promise<Provider[]> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .lt('expires_at', now)
    .eq('is_active', true)
    .not('refresh_token', 'is', null);

  if (error) throw error;

  // Decrypt tokens before returning
  return (data || []).map(provider => ({
    ...provider,
    access_token: decryptToken(provider.access_token),
    refresh_token: provider.refresh_token ? decryptToken(provider.refresh_token) : undefined
  }));
}
