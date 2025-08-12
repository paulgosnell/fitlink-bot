#!/bin/bash

# Deploy Edge Function directly to Supabase
FUNCTION_NAME=$1
PROJECT_REF="umixefoxgjmdlvvtfnmr"
SUPABASE_ACCESS_TOKEN=$2

if [ -z "$FUNCTION_NAME" ] || [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Usage: ./deploy-function.sh <function-name> <supabase-access-token>"
    echo "Get your access token from: https://supabase.com/dashboard/account/tokens"
    exit 1
fi

echo "Deploying $FUNCTION_NAME..."

# Create a zip file of the function
cd supabase/functions/$FUNCTION_NAME
zip -r ../../../$FUNCTION_NAME.zip .
cd ../../../

# Deploy using Supabase Management API
curl -X POST \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/functions/$FUNCTION_NAME" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @$FUNCTION_NAME.zip

# Clean up
rm $FUNCTION_NAME.zip

echo "Deployment complete!"