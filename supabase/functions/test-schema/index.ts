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

    // Check providers table schema using direct query
    console.log('Checking providers table schema...');
    const { data: providersSchema, error: providersError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, ordinal_position')
      .eq('table_name', 'providers')
      .order('ordinal_position');

    console.log('Providers schema:', providersSchema);
    if (providersError) console.log('Providers schema error:', providersError);

    // Check users table schema
    console.log('Checking users table schema...');
    const { data: usersSchema, error: usersError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, ordinal_position')
      .eq('table_name', 'users')
      .order('ordinal_position');

    console.log('Users schema:', usersSchema);
    if (usersError) console.log('Users schema error:', usersError);

    // Also try a simple test query to see if the tables exist and are accessible
    const { data: providerTest, error: providerTestError } = await supabase
      .from('providers')
      .select('*')
      .limit(1);

    const { data: userTest, error: userTestError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    console.log('Provider test query success:', !providerTestError);
    console.log('User test query success:', !userTestError);
    if (providerTestError) console.log('Provider test error:', providerTestError);
    if (userTestError) console.log('User test error:', userTestError);

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
