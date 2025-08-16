// Fitlink Dashboard JavaScript
// Fixed version that properly fetches and displays data

let telegramWebApp = null;
let userData = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        const dashboardContent = document.getElementById('dashboard-content');
        
        // Add comprehensive debugging
        console.log('=== DASHBOARD DEBUG START ===');
        console.log('Telegram object available:', typeof Telegram !== 'undefined');
        console.log('Telegram.WebApp available:', typeof Telegram !== 'undefined' && !!Telegram.WebApp);
        
        // Check if Telegram WebApp is available
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            telegramWebApp = Telegram.WebApp;
            console.log('Telegram WebApp detected, version:', telegramWebApp.version);
            console.log('WebApp platform:', telegramWebApp.platform);
            console.log('WebApp initData length:', telegramWebApp.initData?.length || 0);
            
            // Initialize Telegram WebApp
            telegramWebApp.ready();
            telegramWebApp.expand();
            
            // Get user data from Telegram
            const initData = telegramWebApp.initDataUnsafe;
            userData = initData?.user;
            
            console.log('InitData available:', !!initData);
            console.log('User data available:', !!userData);
            console.log('User ID:', userData?.id);
            console.log('User name:', userData?.first_name);
            
            if (!userData) {
                console.error('CRITICAL: No user data from Telegram WebApp');
                console.log('InitDataUnsafe contents:', initData);
                
                // Show debug info in UI for Telegram context
                dashboardContent.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
                        <h3 class="font-bold text-red-800 mb-2">Debug Info</h3>
                        <p><strong>Telegram Available:</strong> ${typeof Telegram !== 'undefined' ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>WebApp Available:</strong> ${(typeof Telegram !== 'undefined' && !!Telegram.WebApp) ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>WebApp Version:</strong> ${telegramWebApp?.version || 'Unknown'}</p>
                        <p><strong>Platform:</strong> ${telegramWebApp?.platform || 'Unknown'}</p>
                        <p><strong>Has InitData:</strong> ${telegramWebApp?.initData ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>Has User Data:</strong> ${userData ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>User ID:</strong> ${userData?.id || 'None'}</p>
                        <p><strong>User Name:</strong> ${userData?.first_name || 'None'}</p>
                        <p><strong>InitData Length:</strong> ${telegramWebApp?.initData?.length || 0}</p>
                    </div>
                    <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
                        <p class="text-yellow-800">Unable to get user data from Telegram WebApp. This might be a Telegram integration issue.</p>
                    </div>
                `;
                return;
            }
            
            console.log('SUCCESS: Got user data, proceeding to fetch health data');
            
            // Show loading state
            dashboardContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p class="mt-4 text-gray-600">Loading your health data...</p>
                    <p class="mt-2 text-xs text-gray-500">User ID: ${userData.id}</p>
                </div>
            `;
            
            // Fetch user data from the backend
            await fetchAndDisplayUserData(dashboardContent);
            
        } else {
            console.log('Telegram WebApp not available - showing tech details');
            
            // Show technical details for non-Telegram context
            dashboardContent.innerHTML = `
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold mb-4">Technical Details</h2>
                    <div class="space-y-2 text-sm">
                        <p><strong>Telegram Available:</strong> ${typeof Telegram !== 'undefined' ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>WebApp Available:</strong> ${(typeof Telegram !== 'undefined' && !!Telegram.WebApp) ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>WebApp Version:</strong> ${(typeof Telegram !== 'undefined' && Telegram.WebApp?.version) || 'N/A'}</p>
                        <p><strong>Platform:</strong> ${(typeof Telegram !== 'undefined' && Telegram.WebApp?.platform) || 'unknown'}</p>
                        <p><strong>Has InitData:</strong> ${(typeof Telegram !== 'undefined' && Telegram.WebApp?.initData) ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>Has User Data:</strong> ${(typeof Telegram !== 'undefined' && Telegram.WebApp?.initDataUnsafe?.user) ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>User ID:</strong> ${(typeof Telegram !== 'undefined' && Telegram.WebApp?.initDataUnsafe?.user?.id) || 'None'}</p>
                        <p><strong>User Name:</strong> ${(typeof Telegram !== 'undefined' && Telegram.WebApp?.initDataUnsafe?.user?.first_name) || 'None'}</p>
                    </div>
                    <div class="mt-4 p-3 bg-blue-50 rounded text-sm">
                        <p class="text-blue-800">💡 This page must be opened from within the Telegram bot to access your health data.</p>
                    </div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('CRITICAL ERROR in initializeDashboard:', error);
        console.error('Error stack:', error.stack);
        const dashboardContent = document.getElementById('dashboard-content');
        showError(dashboardContent, 'Critical error initializing dashboard: ' + error.message);
    }
}

async function fetchAndDisplayUserData(container) {
    try {
        console.log('=== FETCHING USER DATA ===');
        console.log('User ID:', userData.id);
        console.log('Username:', userData.username || userData.first_name);
        console.log('InitData length:', telegramWebApp.initData?.length);
        
        // Construct the request with Telegram init data
        const requestBody = {
            telegram_id: userData.id,
            telegram_username: userData.username || userData.first_name,
            telegram_auth_data: telegramWebApp.initData
        };
        
        console.log('Request body:', requestBody);
        console.log('Making request to /oauth-test/user-lookup...');
        
        const response = await fetch('/oauth-test/user-lookup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            console.error('HTTP error! status:', response.status);
            
            // Try to get error details
            let errorText;
            try {
                errorText = await response.text();
                console.error('Error response body:', errorText);
            } catch (e) {
                console.error('Could not read error response:', e);
                errorText = 'Unknown error';
            }
            
            if (response.status === 404) {
                console.log('User not found (404), showing empty state');
                showEmptyState(container);
                return;
            }
            
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('=== API RESPONSE SUCCESS ===');
        console.log('Received data:', data);
        
        if (data && data.user) {
            console.log('User data found, displaying dashboard');
            displayUserData(container, data);
        } else {
            console.log('No user data in response, showing empty state');
            showEmptyState(container);
        }
        
    } catch (error) {
        console.error('=== FETCH ERROR ===');
        console.error('Error fetching user data:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Show detailed error in UI for debugging
        container.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 class="font-bold text-red-800 mb-2">Error Loading Data</h3>
                <p class="text-red-600 text-sm mb-2">${error.message}</p>
                <details class="text-xs text-gray-600">
                    <summary>Debug Details</summary>
                    <pre class="mt-2 whitespace-pre-wrap">${error.stack}</pre>
                </details>
                <button onclick="location.reload()" class="mt-3 bg-red-600 text-white px-4 py-2 rounded text-sm">
                    Try Again
                </button>
            </div>
        `;
    }
}

function displayUserData(container, data) {
    const { user, providers = [], sleep_data = [], activities = [] } = data;
    
    // Check provider connections
    const hasOura = providers.some(p => p.provider === 'oura' && p.is_active);
    const hasStrava = providers.some(p => p.provider === 'strava' && p.is_active);
    
    // Calculate stats
    const totalActivities = activities.length;
    const avgSleepHours = sleep_data.length > 0 
        ? (sleep_data.reduce((sum, s) => sum + (s.total_sleep_minutes || 0), 0) / sleep_data.length / 60).toFixed(1)
        : '0';
    const lastSyncOura = sleep_data.length > 0 ? new Date(sleep_data[0].date).toLocaleDateString() : 'Never';
    const lastSyncStrava = activities.length > 0 ? new Date(activities[0].start_date).toLocaleDateString() : 'Never';
    
    container.innerHTML = `
        <!-- User Info Card -->
        <div class="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 class="text-lg font-semibold mb-3">Welcome, ${user.first_name || 'User'}</h2>
            <div class="text-sm text-gray-600 space-y-1">
                <p>📍 ${user.city || 'Location not set'}</p>
                <p>⏰ Daily briefing: ${user.briefing_hour || 7}:00 ${user.timezone || 'UTC'}</p>
                <p>📅 Member since: ${new Date(user.created_at).toLocaleDateString()}</p>
            </div>
        </div>
        
        <!-- Provider Status -->
        <div class="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 class="text-lg font-semibold mb-3">Connected Devices</h3>
            <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">💍</span>
                        <div>
                            <p class="font-medium">Oura Ring</p>
                            <p class="text-sm text-gray-500">Last sync: ${lastSyncOura}</p>
                        </div>
                    </div>
                    <span class="${hasOura ? 'text-green-500' : 'text-red-500'}">
                        ${hasOura ? '✓ Connected' : '✗ Not connected'}
                    </span>
                </div>
                
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">🏃</span>
                        <div>
                            <p class="font-medium">Strava</p>
                            <p class="text-sm text-gray-500">Last sync: ${lastSyncStrava}</p>
                        </div>
                    </div>
                    <span class="${hasStrava ? 'text-green-500' : 'text-red-500'}">
                        ${hasStrava ? '✓ Connected' : '✗ Not connected'}
                    </span>
                </div>
            </div>
            
            ${!hasOura || !hasStrava ? `
                <div class="mt-4 p-3 bg-blue-50 rounded text-sm">
                    <p class="text-blue-800">💡 Connect your devices in the Telegram bot to see your health data here.</p>
                </div>
            ` : ''}
        </div>
        
        <!-- Health Stats -->
        ${(hasOura || hasStrava) ? `
            <div class="bg-white rounded-lg shadow-md p-4 mb-4">
                <h3 class="text-lg font-semibold mb-3">Health Overview</h3>
                <div class="grid grid-cols-2 gap-4">
                    ${hasOura ? `
                        <div class="text-center p-3 bg-purple-50 rounded">
                            <p class="text-2xl font-bold text-purple-600">${avgSleepHours}</p>
                            <p class="text-sm text-gray-600">Avg Sleep (hrs)</p>
                        </div>
                        <div class="text-center p-3 bg-blue-50 rounded">
                            <p class="text-2xl font-bold text-blue-600">${sleep_data.length}</p>
                            <p class="text-sm text-gray-600">Sleep Records</p>
                        </div>
                    ` : ''}
                    
                    ${hasStrava ? `
                        <div class="text-center p-3 bg-green-50 rounded">
                            <p class="text-2xl font-bold text-green-600">${totalActivities}</p>
                            <p class="text-sm text-gray-600">Activities</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
        
                <!-- Recent Sleep Data -->
        ${hasOura && sleep_data.length > 0 ? `
            <div class="bg-white rounded-lg shadow-md p-4 mb-4">
                <h3 class="text-lg font-semibold mb-3">Recent Sleep</h3>
                <div class="space-y-2">
                    ${sleep_data.slice(0, 3).map(sleep => `
                        <div class="p-3 bg-gray-50 rounded">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium">${new Date(sleep.date).toLocaleDateString()}</span>
                                <span class="text-sm text-gray-600">${((sleep.total_sleep_minutes || 0) / 60).toFixed(1)} hrs</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-500">
                                Score: ${sleep.readiness_score || 'N/A'} | Efficiency: ${sleep.sleep_efficiency || 'N/A'}%
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}`
        
        <!-- Recent Activities -->
        ${hasStrava && activities.length > 0 ? `
            <div class="bg-white rounded-lg shadow-md p-4 mb-4">
                <h3 class="text-lg font-semibold mb-3">Recent Activities</h3>
                <div class="space-y-2">
                    ${activities.slice(0, 3).map(activity => `
                        <div class="p-3 bg-gray-50 rounded">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium">${activity.name}</span>
                                <span class="text-sm text-gray-600">${(activity.moving_time / 60).toFixed(0)} min</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-500">
                                ${activity.type} | ${(activity.distance / 1000).toFixed(1)} km
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <!-- Action Buttons -->
        <div class="flex justify-center mt-6">
            <button onclick="returnToBot()" class="bg-purple-600 text-white px-6 py-2 rounded-lg shadow hover:bg-purple-700 transition">
                Return to Bot
            </button>
        </div>
    `;
}

function showEmptyState(container) {
    container.innerHTML = `
        <div class="bg-white rounded-lg shadow-md p-6 text-center">
            <div class="text-6xl mb-4">🏃‍♂️</div>
            <h2 class="text-xl font-semibold mb-2">Welcome to Your Health Dashboard!</h2>
            <p class="text-gray-600 mb-6">Connect your fitness devices to start tracking your health data.</p>
            
            <div class="space-y-3 max-w-sm mx-auto">
                <div class="p-4 bg-gray-50 rounded-lg text-left">
                    <h3 class="font-medium mb-1">📱 How to connect:</h3>
                    <ol class="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                        <li>Return to the Telegram bot</li>
                        <li>Use /connect_oura for Oura Ring</li>
                        <li>Use /connect_strava for Strava</li>
                        <li>Come back here to see your data!</li>
                    </ol>
                </div>
            </div>
            
            <button onclick="returnToBot()" class="mt-6 bg-purple-600 text-white px-6 py-2 rounded-lg shadow hover:bg-purple-700 transition">
                Return to Bot
            </button>
        </div>
    `;
}

function showError(container, message) {
    container.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div class="text-5xl mb-4">⚠️</div>
            <h2 class="text-xl font-semibold text-red-800 mb-2">Oops! Something went wrong</h2>
            <p class="text-red-600 mb-4">${message}</p>
            <button onclick="location.reload()" class="bg-red-600 text-white px-6 py-2 rounded-lg shadow hover:bg-red-700 transition">
                Try Again
            </button>
        </div>
    `;
}

function returnToBot() {
    if (telegramWebApp) {
        telegramWebApp.close();
    }
}

// Export functions for global access
window.returnToBot = returnToBot;