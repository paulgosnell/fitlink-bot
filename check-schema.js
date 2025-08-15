// Quick script to check actual database schema
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  'https://umixefoxgjmdlvvtfnmr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDQ0MzkyOCwiZXhwIjoyMDUwMDE5OTI4fQ.hg4Wq1gWpFo0OIdYt3NxOD1t7qyMcRUJVIKt_8Q3NRw'
);

async function checkSchema() {
  console.log('Checking oura_sleep table schema...');
  
  // Try to query with different field names to see what works
  try {
    const { data, error } = await supabase
      .from('oura_sleep')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying oura_sleep:', error);
    } else {
      console.log('oura_sleep query successful, sample data:', data);
      if (data && data.length > 0) {
        console.log('Available columns:', Object.keys(data[0]));
      }
    }
  } catch (e) {
    console.error('Exception:', e);
  }

  // Check if table exists by trying different queries
  console.log('\nTrying field "date":');
  try {
    const { data, error } = await supabase
      .from('oura_sleep')
      .select('date')
      .limit(1);
    console.log('date field result:', { data, error: error?.message });
  } catch (e) {
    console.error('date field error:', e.message);
  }

  console.log('\nTrying field "day":');
  try {
    const { data, error } = await supabase
      .from('oura_sleep')
      .select('day')
      .limit(1);
    console.log('day field result:', { data, error: error?.message });
  } catch (e) {
    console.error('day field error:', e.message);
  }
}

checkSchema();