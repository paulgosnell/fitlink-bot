import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { getAllActiveUsers } from "../shared/database/users.ts";

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const baseUrl = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!baseUrl || !anon) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }

    const users = await getAllActiveUsers(supabase);

    const nowUtc = new Date();
    const utcMinutes = nowUtc.getUTCMinutes();
    const utcHour = nowUtc.getUTCHours();

    // Only act on :50 marks (when scheduled every 10 minutes)
    if (utcMinutes !== 50 && utcMinutes !== 20 && utcMinutes !== 40 && utcMinutes !== 10 && utcMinutes !== 30 && utcMinutes !== 0) {
      // If schedule is not strictly */10, allow running always; otherwise keep this check simple
    }

    let targeted = 0;
    await Promise.all(users.map(async (user) => {
      try {
        // Compute user's local time
        const utcDate = new Date();
        utcDate.setUTCHours(utcHour, utcMinutes, 0, 0);
        const local = new Date(utcDate.toLocaleString("en-US", { timeZone: user.timezone || 'UTC' }));
        const localHour = local.getHours();
        const localMinute = local.getMinutes();

        // If it's 10 minutes before user's briefing hour (at :50)
        const targetHour = (user.briefing_hour ?? 7);
        const isTenMinutesBefore = (localMinute === 50) && ((localHour + 1) % 24 === targetHour);
        if (!isTenMinutesBefore) return;

        targeted++;
        // Trigger user-specific syncs
        await Promise.all([
          fetch(`${baseUrl}/functions/v1/data-sync-oura`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
            body: JSON.stringify({ user_id: user.id })
          }).catch(() => undefined),
          fetch(`${baseUrl}/functions/v1/data-sync-strava`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
            body: JSON.stringify({ user_id: user.id })
          }).catch(() => undefined)
        ]);
      } catch (e) {
        console.error('pre-briefing user sync failed', user.id, e);
      }
    }));

    return new Response(JSON.stringify({ status: 'ok', targeted_users: targeted, timestamp: nowUtc.toISOString() }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('pre-briefing-sync error', e);
    return new Response(JSON.stringify({ status: 'error', message: String(e?.message || e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

