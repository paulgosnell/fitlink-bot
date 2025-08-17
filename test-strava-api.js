// Test Strava API access directly
import crypto from 'crypto';

// Get provider data and test API call
async function testStravaAPI() {
  try {
    // Get user's Strava provider data
    const userResponse = await fetch('https://fitlinkbot.netlify.app/oauth-test/user-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: 5269737203 })
    });
    
    const userData = await userResponse.json();
    const stravaProvider = userData.providers.find(p => p.provider === 'strava');
    
    if (!stravaProvider) {
      console.log('No Strava provider found');
      return;
    }
    
    console.log('Strava provider found:', {
      is_active: stravaProvider.is_active,
      created_at: stravaProvider.created_at,
      updated_at: stravaProvider.updated_at
    });
    
    // Try to decrypt the access token (simplified approach)
    // Note: This won't work without the actual encryption key, but we can try the API call through the oauth-test function
    
    // Calculate 90 days ago epoch
    const afterEpoch = Math.floor((Date.now() - 1000 * 60 * 60 * 24 * 90) / 1000);
    console.log('Looking for activities after epoch:', afterEpoch);
    console.log('That corresponds to date:', new Date(afterEpoch * 1000).toISOString());
    
    // Since we can't decrypt tokens directly, let's see if there's an issue with the actual function
    console.log('The sync function should be able to decrypt tokens and make API calls...');
    console.log('Let\'s check the actual function logs in Supabase dashboard for more details.');
    
  } catch (error) {
    console.error('Error testing Strava API:', error);
  }
}

testStravaAPI();
