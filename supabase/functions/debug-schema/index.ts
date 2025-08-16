import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export default async function handler(req: Request): Promise<Response> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Inspecting providers table schema...');

    // Get the actual column information for providers table
    const { data: schemaInfo, error: schemaError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'providers' 
          ORDER BY ordinal_position;
        `
      });

    if (schemaError) {
      console.error('Schema query error:', schemaError);
      return new Response(JSON.stringify({ 
        error: 'Failed to query schema',
        details: schemaError 
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Providers table schema:', schemaInfo);

    // Also check if there are any constraints or indexes that might be causing issues
    const { data: constraintInfo, error: constraintError } = await supabase
      .rpc('sql', {
        query: `
          SELECT 
            conname as constraint_name,
            contype as constraint_type,
            pg_get_constraintdef(oid) as definition
          FROM pg_constraint 
          WHERE conrelid = 'providers'::regclass;
        `
      });

    if (constraintError) {
      console.error('Constraint query error:', constraintError);
    }

    console.log('Providers table constraints:', constraintInfo);

    return new Response(JSON.stringify({
      schema: schemaInfo,
      constraints: constraintInfo,
      message: 'Schema inspection complete'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Debug schema error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal error',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
