// Fitlink Dashboard JavaScript
// Simplified version that works with basic user data

let telegramWebApp = null;
let userData = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initializing...');
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Check if Telegram WebApp is available
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            telegramWebApp = Telegram.WebApp;
            console.log('Telegram WebApp detected');
            
            // Initialize Telegram WebApp
            telegramWebApp.ready();
            telegramWebApp.expand();
            
            // Get user data from Telegram
            userData = telegramWebApp.initDataUnsafe?.user;
            
            // Update debug information
            updateDebugInfo();
            
            // Update user information
            updateUserInfo();
            
            // Show success message
            showStatusMessage('Dashboard loaded successfully!', 'success');
            
            // Try to load basic fitness data (simplified)
            loadBasicFitnessData();
            
        } else {
            console.log('Telegram WebApp not available, running in demo mode');
            showStatusMessage('Running in demo mode - Telegram WebApp not available', 'error');
            
            // Set demo data
            setDemoData();
        }
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showStatusMessage('Error initializing dashboard: ' + error.message, 'error');
    }
}

function updateDebugInfo() {
    if (telegramWebApp) {
        document.getElementById('telegramAvailable').textContent = '✅ Yes';
        document.getElementById('webappAvailable').textContent = '✅ Yes';
        document.getElementById('webappVersion').textContent = telegramWebApp.version || 'Unknown';
        document.getElementById('platform').textContent = telegramWebApp.platform || 'Unknown';
        document.getElementById('hasInitData').textContent = telegramWebApp.initData ? '✅ Yes' : '❌ No';
        document.getElementById('hasUserData').textContent = userData ? '✅ Yes' : '❌ No';
    } else {
        document.getElementById('telegramAvailable').textContent = '❌ No';
        document.getElementById('webappAvailable').textContent = '❌ No';
        document.getElementById('webappVersion').textContent = 'N/A';
        document.getElementById('platform').textContent = 'N/A';
        document.getElementById('hasInitData').textContent = '❌ No';
        document.getElementById('hasUserData').textContent = '❌ No';
    }
}

function updateUserInfo() {
    if (userData) {
        document.getElementById('userId').textContent = userData.id || 'Unknown';
        document.getElementById('username').textContent = userData.username || userData.first_name || 'Unknown';
    } else {
        document.getElementById('userId').textContent = 'Not available';
        document.getElementById('username').textContent = 'Not available';
    }
    
    if (telegramWebApp) {
        document.getElementById('platform').textContent = telegramWebApp.platform || 'Unknown';
        document.getElementById('webappVersion').textContent = telegramWebApp.version || 'Unknown';
    }
}

async function loadBasicFitnessData() {
    try {
        // Show loading state
        showStatusMessage('Loading fitness data...', 'success');
        
        // Try to fetch real data from the database
        const fitnessData = await fetchFitnessData();
        
        if (fitnessData) {
            // Display real data
            displayFitnessData(fitnessData);
            showStatusMessage('Fitness data loaded successfully!', 'success');
        } else {
            // Show placeholder data
            showPlaceholderFitnessData();
            showStatusMessage('No fitness data available yet', 'error');
        }
        
    } catch (error) {
        console.error('Error loading fitness data:', error);
        showStatusMessage('Error loading fitness data: ' + error.message, 'error');
        
        // Fallback to placeholder data
        showPlaceholderFitnessData();
    }
}

async function fetchFitnessData() {
    try {
        // This would normally call your Supabase function
        // For now, we'll simulate a successful response
        // In production, this would be:
        // const response = await fetch('/.netlify/functions/oauth-test-proxy?telegram_id=' + userData.id);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return null to trigger placeholder data for now
        // Once the database is working, this would return real data
        return null;
        
    } catch (error) {
        console.error('Error fetching fitness data:', error);
        return null;
    }
}

function displayFitnessData(data) {
    // This function would display real fitness data
    // For now, it's a placeholder for when the database is working
    
    if (data && data.user) {
        // Update stats with real data
        document.getElementById('totalWorkouts').textContent = data.totalWorkouts || '0';
        document.getElementById('totalSteps').textContent = data.totalSteps || '0';
        document.getElementById('avgSleep').textContent = data.avgSleep || '0';
        document.getElementById('activeDays').textContent = data.activeDays || '0';
        
        // Update fitness data section with real data
        updateFitnessDataSection(data);
        
        // Update recent activity section with real data
        updateRecentActivitySection(data);
    }
}

function updateFitnessDataSection(data) {
    const fitnessDataDiv = document.getElementById('fitnessData');
    
    if (data.sleepData && data.sleepData.length > 0) {
        // Show real sleep data
        const sleepHtml = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.sleepData.length}</div>
                    <div class="stat-label">Sleep Records</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.avgSleepScore || 'N/A'}</div>
                    <div class="stat-label">Avg Sleep Score</div>
                </div>
            </div>
        `;
        fitnessDataDiv.innerHTML = sleepHtml;
    } else {
        // Show no data message
        fitnessDataDiv.innerHTML = `
            <div class="placeholder">
                <h4>No fitness data available yet</h4>
                <p>Connect your fitness apps to see your data here</p>
                <button class="btn" onclick="connectFitnessApps()">Connect Apps</button>
            </div>
        `;
    }
}

function updateRecentActivitySection(data) {
    const recentActivityDiv = document.getElementById('recentActivity');
    
    if (data.recentActivities && data.recentActivities.length > 0) {
        // Show real activity data
        const activitiesHtml = `
            <div class="stats-grid">
                ${data.recentActivities.map(activity => `
                    <div class="stat-card">
                        <div class="stat-number">${activity.steps || 0}</div>
                        <div class="stat-label">Steps (${activity.date})</div>
                    </div>
                `).join('')}
            </div>
        `;
        recentActivityDiv.innerHTML = activitiesHtml;
    } else {
        // Show no data message
        recentActivityDiv.innerHTML = `
            <div class="placeholder">
                <h4>No recent activity</h4>
                <p>Your recent workouts and activities will appear here</p>
            </div>
        `;
    }
}

function showPlaceholderFitnessData() {
    // Update stats with placeholder values
    document.getElementById('totalWorkouts').textContent = '0';
    document.getElementById('totalSteps').textContent = '0';
    document.getElementById('avgSleep').textContent = '0';
    document.getElementById('activeDays').textContent = '0';
    
    // Update fitness data section
    const fitnessDataDiv = document.getElementById('fitnessData');
    fitnessDataDiv.innerHTML = `
        <div class="placeholder">
            <h4>Fitness data not yet available</h4>
            <p>The database tables for fitness data need to be created first.</p>
            <p><strong>Current Issue:</strong> The dashboard expects fitness data tables that don't exist in the database.</p>
            <button class="btn" onclick="showDatabaseStatus()">Check Database Status</button>
        </div>
    `;
    
    // Update recent activity section
    const recentActivityDiv = document.getElementById('recentActivity');
    recentActivityDiv.innerHTML = `
        <div class="placeholder">
            <h4>No recent activity data</h4>
            <p>Activity data will appear here once the database is properly configured.</p>
        </div>
    `;
}

function showDatabaseStatus() {
    const statusDiv = document.getElementById('statusMessages');
    const statusHtml = `
        <div class="error">
            <h4>Database Configuration Issue</h4>
            <p><strong>Problem:</strong> The fitness data tables are missing from the database.</p>
            <p><strong>Required Tables:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>oura_sleep - for sleep data</li>
                <li>strava_activities - for workout data</li>
                <li>activities - for general activity data</li>
            </ul>
            <p><strong>Solution:</strong> The database migrations need to be applied to create these tables.</p>
        </div>
    `;
    statusDiv.innerHTML = statusHtml;
}

function connectFitnessApps() {
    showStatusMessage('Fitness app connection feature coming soon!', 'success');
}

function setDemoData() {
    // Set demo data for testing
    document.getElementById('userId').textContent = '12345';
    document.getElementById('username').textContent = 'demo_user';
    document.getElementById('platform').textContent = 'web';
    document.getElementById('webappVersion').textContent = 'Demo';
    
    // Set demo stats
    document.getElementById('totalWorkouts').textContent = '12';
    document.getElementById('totalSteps').textContent = '45,678';
    document.getElementById('avgSleep').textContent = '7.5';
    document.getElementById('activeDays').textContent = '18';
    
    // Update debug info
    document.getElementById('telegramAvailable').textContent = '❌ No (Demo)';
    document.getElementById('webappAvailable').textContent = '❌ No (Demo)';
    document.getElementById('hasInitData').textContent = '❌ No (Demo)';
    document.getElementById('hasUserData').textContent = '❌ No (Demo)';
}

function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessages');
    const messageHtml = `<div class="${type}">${message}</div>`;
    
    // Clear existing messages and add new one
    statusDiv.innerHTML = messageHtml;
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (statusDiv.innerHTML === messageHtml) {
            statusDiv.innerHTML = '';
        }
    }, 5000);
}

// Export functions for global access
window.connectFitnessApps = connectFitnessApps;
window.showDatabaseStatus = showDatabaseStatus;