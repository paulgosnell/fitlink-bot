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

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("Environment check:", {
      url: supabaseUrl ? "SET" : "NOT_SET",
      key: supabaseKey ? "SET" : "NOT_SET"
    });

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test database connection
    console.log("Testing database connection...");
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (tablesError) {
      console.error("Database error:", tablesError);
      return new Response(
        JSON.stringify({ 
          error: "Database connection failed", 
          details: tablesError.message,
          code: tablesError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test user creation
    console.log("Testing user creation...");
    const testUser = {
      telegram_id: 999999999,
      username: "test_user",
      first_name: "Test",
      timezone: 'UTC',
      briefing_hour: 7,
      training_goal: 'general_fitness',
      is_active: true
    };

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([testUser])
      .select()
      .single();

    if (createError) {
      console.error("User creation error:", createError);
      return new Response(
        JSON.stringify({ 
          error: "User creation failed", 
          details: createError.message,
          code: createError.code,
          hint: createError.hint
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean up test user
    await supabase
      .from('users')
      .delete()
      .eq('telegram_id', 999999999);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Database connection and user creation working",
        user_created: newUser
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Unexpected error", 
        message: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});