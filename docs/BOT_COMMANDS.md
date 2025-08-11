# Fitlink Bot Commands

This document describes all available Telegram bot commands and their functionality.

## 🚀 Getting Started

### `/start`
Initialize the bot and see the main menu. This command:
- Creates your user profile if you're new
- Shows current connection status
- Displays the main navigation menu

**Usage:** `/start`

## 📊 Briefings

### `/brief`
Get your personalized health briefing on-demand. The briefing includes:
- Sleep quality and recovery metrics
- Training load vs. your averages
- Weather conditions and exercise recommendations
- Specific action items for the day
- Safety warnings if needed

**Usage:** `/brief`

**Example Output:**
```
Good morning Paul! 👋

**Green day ahead - excellent recovery**

💤 Sleep: 7h 42m (89% efficiency). HRV trending up.

⚡ Readiness: 78 (+6 vs avg) — ready for quality training.

🎯 Plan: 40-50 min aerobic (Z2). Perfect weather window 06:30-08:30.

✅ Actions:
• 500ml water on waking
• 5 min mobility routine

Stay strong! 💪
```

## ⚙️ Settings & Configuration

### `/settings`
Access the settings menu to configure:
- Briefing time (when you receive daily briefings)
- Location (for weather data)
- Training goals
- Account connections
- Pause/resume briefings

**Usage:** `/settings`

### `/pause [days]`
Temporarily pause daily briefings. You can still use `/brief` for on-demand briefings.

**Usage:** 
- `/pause` - Pause for 7 days (default)
- `/pause 3` - Pause for 3 days
- `/pause 30` - Pause for 30 days

### `/resume`
Resume daily briefings if they were paused.

**Usage:** `/resume`

## 🔗 Account Management

The bot connects to these health data sources:

### Oura Ring
- **Data:** Sleep duration, efficiency, HRV, resting heart rate, readiness score
- **Frequency:** Updates nightly with previous day's sleep data
- **Privacy:** All tokens encrypted, can disconnect anytime

### Strava
- **Data:** Recent activities, training load, duration, distance
- **Frequency:** Real-time via webhooks when you log activities
- **Privacy:** Read-only access, no data sharing

### Weather
- **Data:** Local temperature, conditions, wind, precipitation
- **Source:** OpenWeatherMap
- **Usage:** Exercise timing recommendations

## 💡 Help & Support

### `/help`
Display comprehensive help information including:
- Command reference
- Data sources explanation
- Privacy information
- Troubleshooting tips

**Usage:** `/help`

## 🗑️ Data Management

### `/delete`
Permanently delete all your data. This includes:
- User profile and settings
- All connected account tokens
- Sleep and activity history
- Briefing logs

**Usage:** `/delete`

**Important:** This action cannot be undone. You'll need to confirm by typing "DELETE MY DATA".

## 🤖 Interactive Elements

### Inline Buttons
Most bot messages include interactive buttons:

- **👍/👎** - Feedback on briefings (helps improve AI recommendations)
- **📊 Dashboard** - Open web dashboard for detailed metrics
- **⚙️ Settings** - Quick access to settings
- **🔗 Connect [Service]** - OAuth connection flows

### Web Dashboard
Access detailed health metrics via the **📊 Dashboard** button:
- 7-day trend charts for HRV, sleep, training load
- Detailed connection status
- Briefing history with feedback
- Export data options

## 🔐 Privacy & Security

### Data Collection
We only collect essential data for health briefings:
- **Sleep metrics** (from Oura)
- **Activity data** (from Strava) 
- **Weather data** (from OpenWeatherMap)
- **Telegram user info** (name, ID for messaging)

### Data Protection
- All OAuth tokens encrypted with AES-256
- No data sharing with third parties
- GDPR-compliant data handling
- Row-level security in database

### Data Retention
- Raw API payloads: Deleted after processing
- Aggregated metrics: Kept for trend analysis
- User data: Deleted immediately on `/delete` command
- Inactive accounts: Auto-purged after 1 year

## 📱 Tips & Best Practices

### Getting the Best Briefings
1. **Connect both Oura and Strava** for comprehensive insights
2. **Set your correct timezone** for accurate briefing timing
3. **Provide feedback** using 👍👎 buttons to improve recommendations
4. **Check the dashboard** weekly for trends

### Optimal Briefing Times
- **Early risers:** 06:00-07:00 for pre-workout planning
- **Standard schedule:** 07:00-08:00 before work
- **Night owls:** 08:00-09:00 for flexible schedules

### Troubleshooting
- **No data:** Check account connections in `/settings`
- **Outdated briefings:** Ensure devices are syncing properly
- **Missing briefings:** Check if paused with `/settings`
- **Connection issues:** Reconnect accounts (tokens expire)

## 🆕 Feature Requests

Have ideas for new features? The bot learns from:
- Feedback ratings on briefings
- Usage patterns and popular commands
- User suggestions (contact via GitHub issues)

## 🚨 Emergency & Safety

### Health Warnings
The bot will flag potential health concerns:
- **High resting heart rate** (+3 bpm above average)
- **Low HRV** (-20% below average)  
- **Temperature deviation** (illness indicator)
- **Excessive training load** (+25% above average)

### Disclaimer
Fitlink Bot provides **coaching guidance only**, not medical advice. Always consult healthcare professionals for medical concerns.

---

**Version:** 1.0.0  
**Last Updated:** August 2025  
**Support:** [GitHub Issues](https://github.com/your-repo/fitlink-bot/issues)
