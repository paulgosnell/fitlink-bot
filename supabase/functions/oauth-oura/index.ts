import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encryptToken } from "../shared/utils/encryption.ts";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Environment variables
    const clientId = Deno.env.get("OURA_CLIENT_ID");
    const clientSecret = Deno.env.get("OURA_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const baseUrl = Deno.env.get("BASE_URL");

    if (!clientId || !clientSecret) {
      console.error("Missing OAuth environment variables");
      return new Response(
        JSON.stringify({ error: "OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

    // Start OAuth flow
    if (path.endsWith('/start')) {
      const userId = url.searchParams.get('user_id');
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Missing user_id parameter" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate state parameter with user ID for security
      const state = `${userId}_${crypto.randomUUID()}`;
      const redirectUri = `${baseUrl}/oauth-oura/callback`;

      // Store state in database for security (optional - using URL parameter for now)
      const ouraAuthUrl = `https://cloud.ouraring.com/oauth/authorize?` + 
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=email personal daily&` +
        `state=${state}`;

      console.log("Starting Oura OAuth flow for user:", userId);
      
      // Redirect to Oura authorization
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': ouraAuthUrl
        }
      });
    }

    // Handle OAuth callback
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error("OAuth error:", error);
        return new Response(
          `<html><body><h1>Authorization Error</h1><p>${error}</p><p>You can close this window.</p></body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      if (!code) {
        return new Response(
          `<html><body><h1>Authorization Error</h1><p>No authorization code received</p></body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }

      try {
        // Exchange code for access token
        const tokenResponse = await fetch('https://api.ouraring.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `${baseUrl}/oauth-oura/callback`,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error("Token exchange failed:", errorText);
          throw new Error(`Token exchange failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        console.log("Oura token exchange successful");

        // Get user info from Oura
        const userResponse = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        if (!userResponse.ok) {
          console.error("Failed to get user info from Oura");
          throw new Error("Failed to get user profile from Oura");
        }

        const ouraUserData = await userResponse.json();
        console.log("Oura user data retrieved");

        // Extract user ID from state parameter
        const userId = state ? state.split('_')[0] : null;
        
        // Store encrypted tokens and user profile data
        if (supabase && userId) {
          try {
            // Encrypt tokens
            const encryptedAccessToken = await encryptToken(tokenData.access_token);
            const encryptedRefreshToken = tokenData.refresh_token ? 
              await encryptToken(tokenData.refresh_token) : null;

            // Calculate expires_at from expires_in
            const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

            // Store provider connection
            const { error: providerError } = await supabase
              .from('providers')
              .upsert({
                user_id: parseInt(userId), // Convert to BIGINT for database
                provider: 'oura',
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                expires_at: expiresAt,
                provider_user_id: ouraUserData.id,
                scopes: tokenData.scope ? tokenData.scope.split(' ') : ['personal', 'daily'],
                is_active: true,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'user_id,provider'
              });

            if (providerError) {
              console.error("Error storing provider data:", providerError);
            } else {
              console.log("Provider connection stored successfully");
            }

            // Update user profile with Oura data
            const profileUpdate: any = {
              oura_user_id: ouraUserData.id,
              profile_updated_at: new Date().toISOString()
            };

            // Add profile data if available from Oura API
            if (ouraUserData.email) profileUpdate.email = ouraUserData.email;
            if (ouraUserData.age) profileUpdate.age = ouraUserData.age;
            if (ouraUserData.biological_sex) {
              profileUpdate.sex = ouraUserData.biological_sex.toLowerCase();
            }
            if (ouraUserData.height) profileUpdate.height_cm = Math.round(ouraUserData.height * 100); // Convert m to cm
            if (ouraUserData.weight) profileUpdate.weight_kg = ouraUserData.weight;

            const { error: userError } = await supabase
              .from('users')
              .update(profileUpdate)
              .eq('id', parseInt(userId));

            if (userError) {
              console.error("Error updating user profile:", userError);
            } else {
              console.log("User profile updated with Oura data:", {
                oura_user_id: ouraUserData.id,
                has_email: !!ouraUserData.email,
                has_age: !!ouraUserData.age,
                has_sex: !!ouraUserData.biological_sex,
                has_height: !!ouraUserData.height,
                has_weight: !!ouraUserData.weight
              });
            }

          } catch (dbError) {
            console.error("Database error:", dbError);
            // Don't fail the OAuth flow for database errors
          }
        }

        console.log("Oura OAuth completed successfully");

        // Generate success message with data collected
        const dataCollected = [];
        if (ouraUserData.email) dataCollected.push("email");
        if (ouraUserData.age) dataCollected.push("age");
        if (ouraUserData.biological_sex) dataCollected.push("biological sex");
        if (ouraUserData.height) dataCollected.push("height");
        if (ouraUserData.weight) dataCollected.push("weight");

        return new Response(
          `<html><body>
            <h1> Oura Ring Connected!</h1>
            <p>Your Oura Ring has been successfully connected to Fitlink Bot.</p>
            <p>You can now close this window and return to Telegram.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );

      } catch (error) {
        console.error("OAuth callback error:", error);
        return new Response(
          `<html><body><h1>Connection Error</h1><p>Failed to connect your Oura Ring. Please try again.</p></body></html>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("OAuth function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});