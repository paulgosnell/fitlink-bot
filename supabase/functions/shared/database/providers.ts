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
  // Fetch provider rows and interpret `is_active` in JS. This avoids false
  // negatives when `is_active` is null/undefined or stored non-boolean.
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  const rows = data || [];
  const active = rows.find((r: any) => !!r.is_active) || null;
  if (!active) return null;

  return {
    ...active,
    access_token: decryptToken(active.access_token),
    refresh_token: active.refresh_token ? decryptToken(active.refresh_token) : undefined
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
  console.log('DEBUG createOrUpdateProvider called with:', {
    user_id: providerData.user_id,
    user_id_type: typeof providerData.user_id,
    provider: providerData.provider,
    provider_user_id: providerData.provider_user_id,
    provider_user_id_type: typeof providerData.provider_user_id,
    scopes: providerData.scopes
  });
  
  // Encrypt tokens before storing
  const encryptedData = {
    ...providerData,
    access_token: await encryptToken(providerData.access_token),
    refresh_token: providerData.refresh_token ? await encryptToken(providerData.refresh_token) : undefined
  };

  console.log('DEBUG encrypted data structure:', {
    user_id: encryptedData.user_id,
    user_id_type: typeof encryptedData.user_id,
    provider: encryptedData.provider,
    provider_user_id: encryptedData.provider_user_id,
    provider_user_id_type: typeof encryptedData.provider_user_id
  });

  // Try to update existing provider first
  console.log('DEBUG: Checking for existing provider...');
  const { data: existing, error: lookupError } = await supabase
    .from('providers')
    .select('id')
    .eq('user_id', providerData.user_id)
    .eq('provider', providerData.provider)
    .single();

  if (lookupError && lookupError.code !== 'PGRST116') {
    console.error('DEBUG: Lookup error:', lookupError);
    throw new Error(`Provider lookup failed: ${lookupError.message}`);
  }

  if (existing) {
    console.log('DEBUG: Updating existing provider with ID:', existing.id);
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

    if (error) {
      console.error('DEBUG: Update error:', error);
      throw error;
    }
    
    return {
      ...data,
      access_token: providerData.access_token,
      refresh_token: providerData.refresh_token
    };
  } else {
    console.log('DEBUG: Creating new provider...');
    // Create new provider
    const { data, error } = await supabase
      .from('providers')
      .insert([{
        ...encryptedData,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('DEBUG: Insert error:', error);
      throw error;
    }
    
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
    access_token: await encryptToken(tokens.access_token),
    refresh_token: tokens.refresh_token ? await encryptToken(tokens.refresh_token) : undefined,
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
    .not('refresh_token', 'is', null);

  // Only include truthy is_active rows
  const activeOnly = (data || []).filter((p: any) => !!p.is_active);

  const finalData = activeOnly;

  if (error) throw error;

  // Decrypt tokens before returning
  return finalData.map(provider => ({
    ...provider,
    access_token: decryptToken(provider.access_token),
    refresh_token: provider.refresh_token ? decryptToken(provider.refresh_token) : undefined
  }));
}
