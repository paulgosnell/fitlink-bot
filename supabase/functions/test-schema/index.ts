// Quick function to test database schema
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check providers table schema
    console.log('Checking providers table schema...');
    const { data: providersSchema, error: providersError } = await supabase
      .rpc('execute_sql', { 
        query: `SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'providers' 
                ORDER BY ordinal_position;` 
      });

    console.log('Providers schema:', providersSchema);
    if (providersError) console.log('Providers schema error:', providersError);

    // Check users table schema
    console.log('Checking users table schema...');
    const { data: usersSchema, error: usersError } = await supabase
      .rpc('execute_sql', { 
        query: `SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                ORDER BY ordinal_position;` 
      });

    console.log('Users schema:', usersSchema);
    if (usersError) console.log('Users schema error:', usersError);

    return new Response(JSON.stringify({
      providers_schema: providersSchema,
      users_schema: usersSchema,
      providers_error: providersError,
      users_error: usersError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
