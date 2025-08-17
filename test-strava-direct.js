// Direct test of Strava sync function
const response = await fetch('https://fitlinkbot.netlify.app/oauth-test/user-lookup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telegram_id: 5269737203 })
});

const userData = await response.json();
console.log('User found:', userData.user.id);
console.log('Strava provider active:', userData.providers.find(p => p.provider === 'strava')?.is_active);

// Now call the sync directly with the user_id
const syncResponse = await fetch('https://fitlinkbot.netlify.app/oauth-test?action=sync', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: userData.user.id })
});

const syncResult = await syncResponse.json();
console.log('Sync result:', JSON.stringify(syncResult, null, 2));
