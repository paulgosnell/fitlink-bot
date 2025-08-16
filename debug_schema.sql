-- Quick check to see the current schema of providers table
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'providers' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check oura_sleep table
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'oura_sleep' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
