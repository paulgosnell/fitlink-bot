import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Determine target users whose local time is ~10 minutes before their briefing_hour
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Fetch user rows and interpret is_active in JS to handle null/mis-typed values
    const { data: usersRows, error: usersError } = await supabase
      .from('users')
      .select('id, telegram_id, timezone, briefing_hour, paused_until, is_active');

    const users = (usersRows || []).filter((u: any) => !!u.is_active);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const dueUsers = (users || []).filter((u) => {
      // filter paused
      if (u.paused_until) {
        try {
          if (new Date(u.paused_until) >= now) return false;
        } catch (_e) {}
      }
      // compute local hour 10 minutes from now
      try {
        const utcDate = new Date();
        utcDate.setUTCHours(utcHour, 50, 0, 0); // :50 past hour
        const local = new Date(utcDate.toLocaleString('en-US', { timeZone: u.timezone || 'UTC' }));
        const localHour = local.getHours();
        return localHour === u.briefing_hour;
      } catch (_e) {
        // fallback: compare UTC
        return utcHour === u.briefing_hour;
      }
    });

    let triggered = 0;
    let errors = 0;

    for (const user of dueUsers) {
      try {
        // Trigger provider syncs for this user
        const baseUrl = Deno.env.get('BASE_URL');
        const anon = Deno.env.get('SUPABASE_ANON_KEY');
        if (!baseUrl || !anon) throw new Error('Missing BASE_URL or SUPABASE_ANON_KEY');

        await Promise.all([
          fetch(`${baseUrl}/functions/v1/data-sync-oura`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
            body: JSON.stringify({ user_id: user.id })
          }),
          fetch(`${baseUrl}/functions/v1/data-sync-strava`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anon}` },
            body: JSON.stringify({ user_id: user.id })
          })
        ]);

        triggered++;
      } catch (e) {
        console.error('Pre-briefing sync error for user', user.id, e);
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, users_considered: users?.length || 0, due_users: dueUsers.length, triggered, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Pre-briefing sync error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});


