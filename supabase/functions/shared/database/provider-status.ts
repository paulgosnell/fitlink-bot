import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export type ProviderStatus = {
  oura: boolean;
  strava: boolean;
  // Add more providers here as needed
  // whoop: boolean;
  // garmin: boolean;
};

export async function getUserProviderStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<ProviderStatus> {
  const { data, error } = await supabase
    .from('providers')
    .select('provider, is_active')
    .eq('user_id', userId);

  if (error) throw error;

  // Initialize all providers as false
  const status: ProviderStatus = {
    oura: false,
    strava: false,
  };

  // Update status based on active providers
  (data || []).forEach((p: any) => {
    if (!!p.is_active && p.provider in status) {
      status[p.provider as keyof ProviderStatus] = true;
    }
  });

  return status;
}