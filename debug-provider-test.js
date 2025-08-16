// Simple test to isolate the provider creation issue
// Run this locally to test if the issue is in provider creation or elsewhere

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabase = createClient(
  'https://umixefoxgjmdlvvtfnmr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM1NzgwMjUsImV4cCI6MjAzOTE1NDAyNX0.OZuSCeE-qf4pUKtVVOYt4OBGrKJJYn1t8PfQrPqNz8Y'
);

async function testProviderCreation() {
  try {
    console.log('Testing provider table access...');
    
    // First, let's just try to read from the providers table
    const { data: providers, error: readError } = await supabase
      .from('providers')
      .select('*')
      .limit(5);
      
    if (readError) {
      console.error('Read error:', readError);
      return;
    }
    
    console.log('Successfully read providers:', providers);
    
    // Test the schema of the providers table
    const { data: schemaTest, error: schemaError } = await supabase
      .from('providers')
      .select('id, user_id, provider, is_active')
      .limit(1);
      
    if (schemaError) {
      console.error('Schema error:', schemaError);
      return;
    }
    
    console.log('Schema test successful:', schemaTest);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testProviderCreation();
