import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { generateBriefing } from "../shared/ai/briefing.ts";
import { sendTelegramMarkdownMessage } from "../shared/telegram/api.ts";
import { getAllActiveUsers } from "../shared/database/users.ts";

// This function is triggered by Supabase cron
serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    // Get current hour in UTC
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    console.log(`Cron job running at UTC hour: ${utcHour}`);

    // Get all active users
    const allUsers = await getAllActiveUsers(supabase);
    
    let briefingsSent = 0;
    let errors = 0;

    // Process users in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (user) => {
        try {
          // Calculate user's local time
          const userLocalHour = calculateLocalHour(utcHour, user.timezone);
          
          // Check if it's time for this user's briefing
          if (userLocalHour !== user.briefing_hour) {
            return;
          }

          // Check if user is paused
          if (user.paused_until) {
            const pauseDate = new Date(user.paused_until);
            if (pauseDate >= new Date()) {
              console.log(`User ${user.id} briefings paused until ${user.paused_until}`);
              return;
            }
          }

          // Check if we already sent a briefing today
          const today = new Date().toISOString().split('T')[0];
          const { data: existingBrief } = await supabase
            .from('brief_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('date', today)
            .limit(1);

          if (existingBrief && existingBrief.length > 0) {
            console.log(`Briefing already sent today for user ${user.id}`);
            return;
          }

          console.log(`Generating briefing for user ${user.id} (${user.first_name})`);

          // Generate and send briefing
          const briefing = await generateBriefing(user.id, supabase);
          
          if (briefing.error) {
            console.error(`Briefing generation failed for user ${user.id}:`, briefing.error);
            errors++;
            return;
          }

          // Send via Telegram
          await sendTelegramMarkdownMessage(
            botToken,
            user.telegram_id,
            briefing.message!,
            briefing.keyboard
          );

          briefingsSent++;
          console.log(`Briefing sent to user ${user.id}`);

        } catch (error) {
          console.error(`Error processing user ${user.id}:`, error);
          errors++;
        }
      }));

      // Small delay between batches
      if (i + batchSize < allUsers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const response = {
      status: "completed",
      timestamp: now.toISOString(),
      utc_hour: utcHour,
      users_processed: allUsers.length,
      briefings_sent: briefingsSent,
      errors: errors
    };

    console.log("Cron job completed:", response);

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Cron job failed:", error);
    
    return new Response(JSON.stringify({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});

function calculateLocalHour(utcHour: number, timezone: string): number {
  try {
    // Create a date object for the current UTC time
    const utcDate = new Date();
    utcDate.setUTCHours(utcHour, 0, 0, 0);
    
    // Convert to user's timezone
    const userDate = new Date(utcDate.toLocaleString("en-US", { timeZone: timezone }));
    
    return userDate.getHours();
  } catch (error) {
    console.error(`Invalid timezone ${timezone}, using UTC`);
    return utcHour;
  }
}

// Helper function to test the cron job manually
export async function testCronJob() {
  const request = new Request("http://localhost/test");
  return serve(async () => {
    console.log("Running test cron job...");
    return new Response("Test completed");
  })(request);
}
