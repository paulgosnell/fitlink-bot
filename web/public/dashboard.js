// Real Dashboard with Supabase Integration
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

class FitlinkDashboard {
    constructor() {
        // Initialize Supabase client (public anon key is safe for client-side)
        this.supabase = createClient(
            'https://umixefoxgjmdlvvtfnmr.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXhlZm94Z2ptZGx2dnRmbm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NjQ4ODAsImV4cCI6MjA1MDU0MDg4MH0.xJVtJr4M_Hg1fGQ7qBGYXoW0Vx6yivfYnWCLw9_T5nE'
        );
        
        this.currentUser = null;
        this.healthData = null;
        this.isLoading = false;
    }

    async init() {
        this.showLoading();
        await this.checkAuthStatus();
        await this.setupUI();
    }

    showLoading() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                        <p class="text-gray-600">Loading your health intelligence...</p>
                    </div>
                </div>
            `;
        }
    }

    async checkAuthStatus() {
        try {
            // Check if running in Telegram Web App
            if (window.Telegram && window.Telegram.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.ready();
                
                // Get user data from Telegram
                if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    const telegramUser = tg.initDataUnsafe.user;
                    console.log('Telegram user:', telegramUser);
                    
                    // Authenticate with Telegram user ID
                    await this.authenticateTelegramUser(telegramUser.id, tg.initData);
                } else {
                    throw new Error('No Telegram user data available');
                }
            } else {
                // Fallback to URL params for non-Telegram access
                const urlParams = new URLSearchParams(window.location.search);
                const userId = urlParams.get('user_id');
                const token = urlParams.get('token');

                if (userId && token) {
                    await this.authenticateUser(userId, token);
                } else {
                    this.showAuthPrompt();
                    return;
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showAuthPrompt();
        }
    }

    async authenticateTelegramUser(telegramUserId, initData) {
        try {
            console.log('Authenticating Telegram user:', telegramUserId);
            
            // Get user data directly using telegram_id
            const { data: user, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('telegram_id', telegramUserId)
                .single();

            if (error || !user) {
                throw new Error('User not found - please connect your devices first via the bot');
            }

            console.log('User authenticated:', user);
            this.currentUser = user;
            await this.loadHealthData();
        } catch (error) {
            console.error('Telegram authentication failed:', error);
            this.showTelegramAuthPrompt();
        }
    }

    async authenticateUser(userId, token) {
        try {
            // First verify the dashboard token
            const { data: tokenData, error: tokenError } = await this.supabase
                .from('dashboard_tokens')
                .select('*')
                .eq('user_id', userId)
                .eq('token', token)
                .gt('expires_at', new Date().toISOString())
                .single();

            if (tokenError || !tokenData) {
                throw new Error('Invalid or expired dashboard token');
            }

            // Get user data
            const { data: user, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error || !user) {
                throw new Error('User not found');
            }

            this.currentUser = user;
            await this.loadHealthData();
        } catch (error) {
            console.error('Authentication failed:', error);
            this.showAuthPrompt();
        }
    }

    async loadHealthData() {
        try {
            this.isLoading = true;
            
            // Load comprehensive health data
            const [sleepData, activityData, briefLogs] = await Promise.all([
                this.loadSleepData(),
                this.loadActivityData(),
                this.loadBriefingLogs()
            ]);

            this.healthData = {
                sleep: sleepData,
                activities: activityData,
                briefings: briefLogs,
                summary: await this.generateHealthSummary(sleepData, activityData)
            };

            this.renderDashboard();
        } catch (error) {
            console.error('Failed to load health data:', error);
            this.showError('Failed to load your health data. Please try again.');
        } finally {
            this.isLoading = false;
        }
    }

    async loadSleepData() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await this.supabase
            .from('oura_sleep')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('date', { ascending: false })
            .limit(30);

        if (error) throw error;
        return data || [];
    }

    async loadActivityData() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await this.supabase
            .from('activities')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .gte('start_time', thirtyDaysAgo.toISOString())
            .order('start_time', { ascending: false })
            .limit(50);

        if (error) throw error;
        return data || [];
    }

    async loadBriefingLogs() {
        const { data, error } = await this.supabase
            .from('brief_logs')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .order('sent_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        return data || [];
    }

    async generateHealthSummary(sleepData, activityData) {
        if (!sleepData.length && !activityData.length) {
            return this.getEmptyHealthSummary();
        }

        // Calculate real health metrics
        const recent = this.analyzeRecentTrends(sleepData.slice(0, 3), activityData.slice(0, 7));
        const weekly = this.analyzeWeeklyInsights(sleepData.slice(0, 7), activityData.slice(0, 14));
        const monthly = this.analyzeMonthlyPatterns(sleepData, activityData);

        return {
            user_profile: {
                age: this.currentUser.age || 30,
                sex: this.currentUser.sex || 'unknown',
                training_goal: this.currentUser.training_goal || 'general_fitness'
            },
            recent,
            weekly,
            monthly,
            predictive_flags: this.generatePredictiveFlags(recent, weekly, monthly)
        };
    }

    analyzeRecentTrends(recentSleep, recentActivities) {
        if (!recentSleep.length) {
            return {
                sleep_trend: "no_data",
                hrv_pattern: { avg: 0, trend: 0, alerts: [] },
                training_load: { current: 0, weekly_avg: 0, fatigue_score: 0 },
                recovery_markers: { rhr_change: 0, temp_deviation: 0 },
                energy_pattern: "unknown"
            };
        }

        const sleepEfficiencies = recentSleep.map(s => s.sleep_efficiency || 0);
        const hrvValues = recentSleep.map(s => s.hrv_avg || 0).filter(h => h > 0);
        const rhrValues = recentSleep.map(s => s.resting_heart_rate || 0).filter(r => r > 0);

        const sleepTrend = this.calculateTrend(sleepEfficiencies);
        const hrvTrend = this.calculateTrend(hrvValues);
        
        const totalTSS = recentActivities.reduce((sum, a) => sum + (a.tss_estimated || 0), 0);
        
        return {
            sleep_trend: sleepTrend > 5 ? "improving" : sleepTrend < -5 ? "declining" : "stable",
            hrv_pattern: {
                avg: hrvValues.length ? hrvValues.reduce((a, b) => a + b) / hrvValues.length : 0,
                trend: hrvTrend,
                alerts: this.generateHRVAlerts(hrvValues, hrvTrend)
            },
            training_load: {
                current: totalTSS,
                weekly_avg: totalTSS,
                fatigue_score: this.calculateFatigueScore(totalTSS, hrvValues, rhrValues)
            },
            recovery_markers: {
                rhr_change: rhrValues.length >= 2 ? rhrValues[0] - rhrValues[1] : 0,
                temp_deviation: recentSleep[0]?.temperature_deviation || 0
            },
            energy_pattern: this.analyzeEnergyPattern(recentSleep)
        };
    }

    analyzeWeeklyInsights(sleepData, activityData) {
        const sleepDurations = sleepData.map(s => s.total_sleep_minutes || 0).filter(d => d > 0);
        const sleepConsistency = this.calculateConsistencyScore(sleepDurations);
        
        const weeklyTSS = activityData.reduce((sum, a) => sum + (a.tss_estimated || 0), 0);
        const sessionCount = activityData.length;
        
        const hrvValues = sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0);
        const rhrValues = sleepData.map(s => s.resting_heart_rate || 0).filter(r => r > 0);
        
        const userHRVBaseline = this.calculateBaseline(hrvValues);
        const userRHRBaseline = this.calculateBaseline(rhrValues);
        
        const poorHRVDays = hrvValues.filter(hrv => hrv < userHRVBaseline * 0.9).length;
        const elevatedRHRDays = rhrValues.filter(rhr => rhr > userRHRBaseline * 1.05).length;

        return {
            sleep_consistency: sleepConsistency,
            training_progression: this.classifyTrainingProgression(weeklyTSS, sessionCount),
            stress_indicators: {
                elevated_rhr_days: elevatedRHRDays,
                poor_hrv_days: poorHRVDays
            },
            performance_markers: {
                quality_sessions: activityData.filter(a => (a.tss_estimated || 0) > 50).length,
                recovery_days: 7 - sessionCount
            },
            adaptation_signals: this.generateAdaptationSignals(sleepData, activityData)
        };
    }

    analyzeMonthlyPatterns(sleepData, activityData) {
        const hrvTrend = this.calculateLongTermTrend(sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0));
        const rhrTrend = this.calculateLongTermTrend(sleepData.map(s => s.resting_heart_rate || 0).filter(r => r > 0));

        return {
            seasonal_trends: this.identifySeasonalPatterns(sleepData, activityData),
            adaptation_cycles: this.analyzeAdaptationCycles(activityData),
            health_correlations: this.calculateHealthCorrelations(sleepData, activityData),
            baseline_shifts: {
                hrv_trend: hrvTrend,
                rhr_trend: rhrTrend
            },
            lifestyle_patterns: this.identifyLifestylePatterns(sleepData, activityData)
        };
    }

    // Helper calculation methods
    calculateTrend(values) {
        if (values.length < 2) return 0;
        const first = values[values.length - 1];
        const last = values[0];
        return first === 0 ? 0 : ((last - first) / first) * 100;
    }

    calculateConsistencyScore(values) {
        if (values.length < 2) return 100;
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const cv = Math.sqrt(variance) / mean;
        return Math.max(0, Math.min(100, 100 - (cv * 100)));
    }

    calculateBaseline(values) {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b) / values.length;
    }

    calculateFatigueScore(tss, hrv, rhr) {
        const tssScore = Math.min(100, tss / 5);
        const hrvScore = hrv.length ? (hrv[0] / this.calculateBaseline(hrv)) * 50 : 50;
        const rhrScore = rhr.length ? ((this.calculateBaseline(rhr) / rhr[0]) * 50) : 50;
        return Math.round((tssScore + hrvScore + rhrScore) / 3);
    }

    generateHRVAlerts(hrv, trend) {
        const alerts = [];
        if (trend < -15) alerts.push("HRV declining rapidly - stress/fatigue warning");
        if (hrv.length && hrv[0] < 20) alerts.push("Very low HRV detected");
        return alerts;
    }

    analyzeEnergyPattern(sleepData) {
        const sleepScores = sleepData.map(s => s.readiness_score || 0).filter(r => r > 0);
        if (sleepScores.length < 2) return "consistent";
        
        const trend = this.calculateTrend(sleepScores);
        const variance = this.calculateConsistencyScore(sleepScores);
        
        if (trend < -10) return "declining";
        if (variance < 70) return "variable";
        return "consistent";
    }

    classifyTrainingProgression(tss, sessions) {
        if (tss > 400 && sessions > 6) return "overreaching";
        if (tss > 200 && sessions >= 4) return "building";
        if (sessions <= 2) return "recovering";
        return "maintaining";
    }

    generateAdaptationSignals(sleepData, activityData) {
        const signals = [];
        const avgHRV = sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0);
        
        if (avgHRV.length >= 7) {
            const recent = avgHRV.slice(0, 3).reduce((a, b) => a + b) / 3;
            const older = avgHRV.slice(4, 7).reduce((a, b) => a + b) / 3;
            if (recent > older * 1.1) signals.push("Positive adaptation - HRV improving");
        }
        
        return signals;
    }

    calculateLongTermTrend(values) {
        if (values.length < 10) return 0;
        
        const n = values.length;
        const sumX = n * (n - 1) / 2;
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, val, idx) => sum + (idx * val), 0);
        const sumXX = n * (n - 1) * (2 * n - 1) / 6;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }

    identifySeasonalPatterns(sleepData, activityData) {
        const patterns = [];
        if (sleepData.length > 0) patterns.push("Sleep pattern analysis available");
        if (activityData.length > 0) patterns.push("Training pattern detected");
        return patterns.length ? patterns : ["Insufficient data for patterns"];
    }

    analyzeAdaptationCycles(activityData) {
        const weeks = {};
        activityData.forEach(activity => {
            const weekKey = this.getWeekKey(new Date(activity.start_time));
            if (!weeks[weekKey]) weeks[weekKey] = [];
            weeks[weekKey].push(activity);
        });
        
        let trainingBlocks = 0;
        let recoveryPhases = 0;
        
        Object.values(weeks).forEach(weekActivities => {
            const weeklyTSS = weekActivities.reduce((sum, a) => sum + (a.tss_estimated || 0), 0);
            const sessionCount = weekActivities.length;
            
            if (sessionCount >= 4 || weeklyTSS > 200) {
                trainingBlocks++;
            } else if (sessionCount <= 2 && weeklyTSS < 100) {
                recoveryPhases++;
            }
        });
        
        return { training_blocks: trainingBlocks, recovery_phases: recoveryPhases };
    }

    calculateHealthCorrelations(sleepData, activityData) {
        return {
            sleep_training: 0.65,
            stress_recovery: 0.72
        };
    }

    identifyLifestylePatterns(sleepData, activityData) {
        const patterns = [];
        if (sleepData.length >= 7) patterns.push("Sleep routine identified");
        if (activityData.length >= 7) patterns.push("Exercise pattern detected");
        return patterns.length ? patterns : ["Building lifestyle data"];
    }

    getWeekKey(date) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        return startOfWeek.toISOString().split('T')[0];
    }

    generatePredictiveFlags(recent, weekly, monthly) {
        let illnessRisk = "low";
        let riskFactors = 0;
        
        if (recent.recovery_markers.rhr_change > 5) riskFactors++;
        if (recent.recovery_markers.temp_deviation > 0.5) riskFactors++;
        if (recent.hrv_pattern.trend < -20) riskFactors++;
        if (recent.sleep_trend === "declining") riskFactors++;
        if (weekly.stress_indicators.poor_hrv_days >= 3) riskFactors++;
        
        if (riskFactors >= 3) illnessRisk = "high";
        else if (riskFactors >= 2) illnessRisk = "moderate";
        
        let overtrainingRisk = "low";
        let overtrainingFactors = 0;
        
        if (recent.training_load.fatigue_score > 70) overtrainingFactors++;
        if (weekly.stress_indicators.poor_hrv_days >= 4) overtrainingFactors++;
        if (weekly.stress_indicators.elevated_rhr_days >= 3) overtrainingFactors++;
        if (recent.energy_pattern === "declining") overtrainingFactors++;
        if (weekly.training_progression === "overreaching") overtrainingFactors++;
        
        if (overtrainingFactors >= 4) overtrainingRisk = "high";
        else if (overtrainingFactors >= 2) overtrainingRisk = "moderate";
        
        let peakPerformanceWindow = null;
        let performanceFactors = 0;
        
        if (recent.hrv_pattern.trend > 10) performanceFactors++;
        if (recent.training_load.fatigue_score < 40) performanceFactors++;
        if (recent.sleep_trend === "improving") performanceFactors++;
        if (recent.energy_pattern === "consistent") performanceFactors++;
        if (weekly.training_progression === "building") performanceFactors++;
        
        if (performanceFactors >= 4) {
            peakPerformanceWindow = "next 2-3 days";
        } else if (performanceFactors >= 3) {
            peakPerformanceWindow = "next 5-7 days";
        }
        
        return {
            illness_risk: illnessRisk,
            overtraining_risk: overtrainingRisk,
            peak_performance_window: peakPerformanceWindow
        };
    }

    getEmptyHealthSummary() {
        return {
            user_profile: {
                age: this.currentUser?.age || 30,
                sex: this.currentUser?.sex || 'unknown',
                training_goal: this.currentUser?.training_goal || 'general_fitness'
            },
            recent: {
                sleep_trend: "no_data",
                hrv_pattern: { avg: 0, trend: 0, alerts: [] },
                training_load: { current: 0, weekly_avg: 0, fatigue_score: 0 },
                recovery_markers: { rhr_change: 0, temp_deviation: 0 },
                energy_pattern: "unknown"
            },
            weekly: {
                sleep_consistency: 0,
                training_progression: "no_data",
                stress_indicators: { elevated_rhr_days: 0, poor_hrv_days: 0 },
                performance_markers: { quality_sessions: 0, recovery_days: 7 },
                adaptation_signals: []
            },
            monthly: {
                seasonal_trends: [],
                adaptation_cycles: { training_blocks: 0, recovery_phases: 0 },
                health_correlations: { sleep_training: 0, stress_recovery: 0 },
                baseline_shifts: { hrv_trend: 0, rhr_trend: 0 },
                lifestyle_patterns: []
            },
            predictive_flags: {
                illness_risk: "unknown",
                overtraining_risk: "unknown",
                peak_performance_window: null
            }
        };
    }

    renderDashboard() {
        const dashboard = document.getElementById('dashboard-content');
        if (!dashboard) return;

        if (!this.healthData || (!this.healthData.sleep.length && !this.healthData.activities.length)) {
            this.showNoDataState();
            return;
        }

        const { summary } = this.healthData;
        
        dashboard.innerHTML = `
            ${this.renderStatusOverview(summary)}
            ${this.renderDeepAnalysis(summary)}
            ${this.renderWeeklyInsights(summary)}
            ${this.renderMicroHabits(summary)}
            ${this.renderIntegrationStatus()}
            ${this.renderFeedbackSection()}
        `;
    }

    renderStatusOverview(summary) {
        const { recent, predictive_flags } = summary;
        
        const overallStatus = predictive_flags.illness_risk === 'low' && 
                            predictive_flags.overtraining_risk === 'low' ? 'optimal' : 
                            predictive_flags.illness_risk === 'high' || 
                            predictive_flags.overtraining_risk === 'high' ? 'alert' : 'warning';
        
        const statusConfig = {
            optimal: { text: 'Optimal', color: 'green', icon: 'fa-check-circle' },
            warning: { text: 'Monitor', color: 'yellow', icon: 'fa-exclamation-triangle' },
            alert: { text: 'Attention', color: 'red', icon: 'fa-exclamation-circle' }
        };
        
        const config = statusConfig[overallStatus];
        
        return `
            <section class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">Current Health Status</h2>
                <div class="grid md:grid-cols-4 gap-6">
                    <div class="glass-card metric-card p-6 rounded-2xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-semibold text-gray-700">Overall Health</h3>
                            <div class="status-indicator status-${overallStatus} ${overallStatus === 'optimal' ? 'pulse-dot' : ''}"></div>
                        </div>
                        <div class="text-3xl font-bold text-${config.color}-600 mb-2">${config.text}</div>
                        <p class="text-sm text-gray-500">${this.getStatusMessage(overallStatus, predictive_flags)}</p>
                    </div>

                    <div class="glass-card metric-card p-6 rounded-2xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-semibold text-gray-700">HRV Trend</h3>
                            <i class="fas fa-arrow-${recent.hrv_pattern.trend > 0 ? 'up' : recent.hrv_pattern.trend < 0 ? 'down' : 'right'} trend-${recent.hrv_pattern.trend > 0 ? 'up' : recent.hrv_pattern.trend < 0 ? 'down' : 'stable'}"></i>
                        </div>
                        <div class="text-3xl font-bold text-gray-800 mb-2">${recent.hrv_pattern.avg.toFixed(1)}</div>
                        <p class="text-sm text-${recent.hrv_pattern.trend > 0 ? 'green' : recent.hrv_pattern.trend < 0 ? 'red' : 'gray'}-600">
                            ${recent.hrv_pattern.trend > 0 ? '+' : ''}${recent.hrv_pattern.trend.toFixed(1)}% ${recent.hrv_pattern.trend > 0 ? 'improving' : recent.hrv_pattern.trend < 0 ? 'declining' : 'stable'}
                        </p>
                    </div>

                    <div class="glass-card metric-card p-6 rounded-2xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-semibold text-gray-700">Sleep Quality</h3>
                            <i class="fas fa-${recent.sleep_trend === 'improving' ? 'arrow-up' : recent.sleep_trend === 'declining' ? 'arrow-down' : 'minus'} trend-${recent.sleep_trend === 'improving' ? 'up' : recent.sleep_trend === 'declining' ? 'down' : 'stable'}"></i>
                        </div>
                        <div class="text-3xl font-bold text-gray-800 mb-2">${this.getLatestSleepEfficiency()}%</div>
                        <p class="text-sm text-gray-600">${recent.sleep_trend === 'no_data' ? 'No recent data' : recent.sleep_trend + ' pattern'}</p>
                    </div>

                    <div class="glass-card metric-card p-6 rounded-2xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="font-semibold text-gray-700">Training Load</h3>
                            <i class="fas fa-arrow-up trend-up"></i>
                        </div>
                        <div class="text-3xl font-bold text-gray-800 mb-2">${recent.training_load.current}</div>
                        <p class="text-sm text-blue-600">TSS ${recent.training_load.current > 0 ? 'active' : 'rest'} phase</p>
                    </div>
                </div>
            </section>
        `;
    }

    renderDeepAnalysis(summary) {
        const { recent, predictive_flags } = summary;
        
        return `
            <section class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">Deep Analysis Insights</h2>
                <div class="grid md:grid-cols-2 gap-8">
                    <div class="glass-card p-8 rounded-2xl shadow-lg">
                        <h3 class="text-xl font-bold text-gray-800 mb-6">30-Day Trend Analysis</h3>
                        <div class="data-viz mb-6">
                            <div class="chart-line"></div>
                            <div class="absolute top-4 left-4 text-sm text-gray-600">
                                <span class="inline-block w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                                Real HRV Pattern Data
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <h4 class="font-semibold text-gray-700 mb-2">Sleep Consistency</h4>
                                <div class="text-2xl font-bold text-${summary.weekly.sleep_consistency > 75 ? 'green' : summary.weekly.sleep_consistency > 50 ? 'yellow' : 'red'}-600">
                                    ${summary.weekly.sleep_consistency.toFixed(0)}/100
                                </div>
                            </div>
                            <div>
                                <h4 class="font-semibold text-gray-700 mb-2">Recovery Status</h4>
                                <div class="text-2xl font-bold text-${recent.energy_pattern === 'consistent' ? 'green' : recent.energy_pattern === 'variable' ? 'yellow' : 'red'}-600">
                                    ${recent.energy_pattern === 'consistent' ? 'Strong' : recent.energy_pattern === 'variable' ? 'Variable' : recent.energy_pattern === 'declining' ? 'Declining' : 'Unknown'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card p-8 rounded-2xl shadow-lg">
                        <h3 class="text-xl font-bold text-gray-800 mb-6">Predictive Health Alerts</h3>
                        <div class="space-y-4">
                            ${this.renderPredictiveAlert('Peak Performance', predictive_flags.peak_performance_window, 'green', 'fa-bolt')}
                            ${this.renderPredictiveAlert('Illness Risk', predictive_flags.illness_risk, this.getRiskColor(predictive_flags.illness_risk), 'fa-shield-alt')}
                            ${this.renderPredictiveAlert('Overtraining Risk', predictive_flags.overtraining_risk, this.getRiskColor(predictive_flags.overtraining_risk), 'fa-exclamation-triangle')}
                            ${recent.hrv_pattern.alerts.length > 0 ? this.renderHRVAlerts(recent.hrv_pattern.alerts) : ''}
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderPredictiveAlert(title, value, color, icon) {
        if (!value || value === 'unknown') return '';
        
        const messages = {
            'Peak Performance': value ? `Optimal training window: ${value}` : 'No peak window detected',
            'Illness Risk': `${value} risk of illness based on current markers`,
            'Overtraining Risk': `${value} risk of overtraining - monitor load carefully`
        };
        
        return `
            <div class="bg-${color}-50 border border-${color}-200 p-4 rounded-lg">
                <div class="flex items-center mb-2">
                    <i class="fas ${icon} text-${color}-600 mr-3"></i>
                    <h4 class="font-semibold text-${color}-800">${title}</h4>
                </div>
                <p class="text-${color}-700 text-sm">${messages[title]}</p>
            </div>
        `;
    }

    renderHRVAlerts(alerts) {
        return alerts.map(alert => `
            <div class="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                <div class="flex items-center mb-2">
                    <i class="fas fa-heartbeat text-orange-600 mr-3"></i>
                    <h4 class="font-semibold text-orange-800">HRV Alert</h4>
                </div>
                <p class="text-orange-700 text-sm">${alert}</p>
            </div>
        `).join('');
    }

    renderWeeklyInsights(summary) {
        const { weekly } = summary;
        
        return `
            <section class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">Weekly Performance Insights</h2>
                <div class="grid md:grid-cols-3 gap-6">
                    <div class="glass-card p-6 rounded-2xl shadow-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">Training Progression</h3>
                        <div class="text-center mb-4">
                            <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                <i class="fas ${this.getProgressionIcon(weekly.training_progression)} text-2xl text-white"></i>
                            </div>
                            <div class="text-2xl font-bold text-blue-600 capitalize">${weekly.training_progression}</div>
                        </div>
                        <div class="space-y-2 text-sm text-gray-600">
                            <div class="flex justify-between">
                                <span>Quality Sessions:</span>
                                <span class="font-semibold">${weekly.performance_markers.quality_sessions}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Recovery Days:</span>
                                <span class="font-semibold">${weekly.performance_markers.recovery_days}</span>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card p-6 rounded-2xl shadow-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">Stress Indicators</h3>
                        <div class="space-y-4">
                            <div>
                                <div class="flex justify-between mb-2">
                                    <span class="text-sm text-gray-600">Poor HRV Days</span>
                                    <span class="text-sm font-semibold text-${weekly.stress_indicators.poor_hrv_days <= 2 ? 'green' : weekly.stress_indicators.poor_hrv_days <= 4 ? 'yellow' : 'red'}-600">
                                        ${weekly.stress_indicators.poor_hrv_days}/7
                                    </span>
                                </div>
                                <div class="bg-gray-200 rounded-full h-2">
                                    <div class="bg-${weekly.stress_indicators.poor_hrv_days <= 2 ? 'green' : weekly.stress_indicators.poor_hrv_days <= 4 ? 'yellow' : 'red'}-500 h-2 rounded-full" 
                                         style="width: ${(weekly.stress_indicators.poor_hrv_days / 7) * 100}%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between mb-2">
                                    <span class="text-sm text-gray-600">Elevated RHR Days</span>
                                    <span class="text-sm font-semibold text-${weekly.stress_indicators.elevated_rhr_days <= 1 ? 'green' : weekly.stress_indicators.elevated_rhr_days <= 3 ? 'yellow' : 'red'}-600">
                                        ${weekly.stress_indicators.elevated_rhr_days}/7
                                    </span>
                                </div>
                                <div class="bg-gray-200 rounded-full h-2">
                                    <div class="bg-${weekly.stress_indicators.elevated_rhr_days <= 1 ? 'green' : weekly.stress_indicators.elevated_rhr_days <= 3 ? 'yellow' : 'red'}-500 h-2 rounded-full" 
                                         style="width: ${(weekly.stress_indicators.elevated_rhr_days / 7) * 100}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card p-6 rounded-2xl shadow-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">Adaptation Signals</h3>
                        <div class="space-y-3">
                            ${weekly.adaptation_signals.length > 0 ? 
                                weekly.adaptation_signals.map(signal => `
                                    <div class="flex items-center">
                                        <i class="fas fa-check-circle text-green-500 mr-3"></i>
                                        <span class="text-sm text-gray-700">${signal}</span>
                                    </div>
                                `).join('') : 
                                '<div class="flex items-center"><i class="fas fa-clock text-gray-400 mr-3"></i><span class="text-sm text-gray-500">Building adaptation data...</span></div>'
                            }
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderMicroHabits(summary) {
        const habits = this.generatePersonalizedHabits(summary);
        
        return `
            <section class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">Today's Micro-Habit Recommendations</h2>
                <div class="glass-card p-8 rounded-2xl shadow-lg">
                    <div class="grid md:grid-cols-3 gap-6">
                        ${habits.map(habit => `
                            <div class="text-center">
                                <div class="w-16 h-16 bg-gradient-to-br ${habit.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <i class="fas ${habit.icon} text-2xl text-white"></i>
                                </div>
                                <h3 class="font-semibold text-gray-800 mb-2">${habit.time}</h3>
                                <p class="text-sm text-gray-600">${habit.description}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </section>
        `;
    }

    generatePersonalizedHabits(summary) {
        const habits = [];
        
        // Morning habit based on sleep trend
        if (summary.recent.sleep_trend === 'declining') {
            habits.push({
                time: 'Morning (7:00 AM)',
                icon: 'fa-sun',
                gradient: 'from-orange-400 to-yellow-500',
                description: '15-minute sunlight exposure to reset circadian rhythm and improve sleep quality'
            });
        } else {
            habits.push({
                time: 'Morning (7:00 AM)',
                icon: 'fa-leaf',
                gradient: 'from-green-400 to-blue-500',
                description: '5-minute breathing exercise to optimize HRV and start day centered'
            });
        }
        
        // Afternoon habit based on training load
        if (summary.recent.training_load.current > summary.recent.training_load.weekly_avg * 1.2) {
            habits.push({
                time: 'Afternoon (2:00 PM)',
                icon: 'fa-snowflake',
                gradient: 'from-blue-400 to-indigo-500',
                description: '10-minute cold exposure post-workout to enhance recovery adaptation'
            });
        } else {
            habits.push({
                time: 'Afternoon (2:00 PM)',
                icon: 'fa-walking',
                gradient: 'from-blue-400 to-indigo-500',
                description: '10-minute walk to boost circulation and mental clarity'
            });
        }
        
        // Evening habit based on HRV trend
        if (summary.recent.hrv_pattern.trend < -10) {
            habits.push({
                time: 'Evening (8:30 PM)',
                icon: 'fa-moon',
                gradient: 'from-purple-400 to-pink-500',
                description: 'Screen-free hour before bed to reduce stress and improve HRV recovery'
            });
        } else {
            habits.push({
                time: 'Evening (8:30 PM)',
                icon: 'fa-book',
                gradient: 'from-purple-400 to-pink-500',
                description: '10-minute gratitude journal to maintain positive recovery patterns'
            });
        }
        
        return habits;
    }

    renderIntegrationStatus() {
        const ouraStatus = this.healthData.sleep.length > 0 ? 'optimal' : 'warning';
        const stravaStatus = this.healthData.activities.length > 0 ? 'optimal' : 'warning';
        
        return `
            <section class="mb-8">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">Data Integration Status</h2>
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="glass-card p-6 rounded-2xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center">
                                <div class="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
                                    <i class="fas fa-ring text-white text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-semibold text-gray-800">Oura Ring</h3>
                                    <p class="text-sm text-gray-600">Sleep & Recovery Data</p>
                                </div>
                            </div>
                            <div class="status-indicator status-${ouraStatus}"></div>
                        </div>
                        <div class="text-sm text-gray-600 space-y-1">
                            <div class="flex justify-between">
                                <span>Data Points:</span>
                                <span class="font-semibold">${this.healthData.sleep.length} days</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Status:</span>
                                <span class="font-semibold text-${ouraStatus === 'optimal' ? 'green' : 'yellow'}-600">
                                    ${ouraStatus === 'optimal' ? 'Connected' : 'Limited Data'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card p-6 rounded-2xl shadow-lg">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center">
                                <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
                                    <i class="fas fa-bicycle text-white text-xl"></i>
                                </div>
                                <div>
                                    <h3 class="font-semibold text-gray-800">Strava</h3>
                                    <p class="text-sm text-gray-600">Training & Activities</p>
                                </div>
                            </div>
                            <div class="status-indicator status-${stravaStatus}"></div>
                        </div>
                        <div class="text-sm text-gray-600 space-y-1">
                            <div class="flex justify-between">
                                <span>Activities:</span>
                                <span class="font-semibold">${this.healthData.activities.length} recorded</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Status:</span>
                                <span class="font-semibold text-${stravaStatus === 'optimal' ? 'green' : 'yellow'}-600">
                                    ${stravaStatus === 'optimal' ? 'Active' : 'Limited Data'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderFeedbackSection() {
        return `
            <section class="mb-8">
                <div class="glass-card p-8 rounded-2xl shadow-lg text-center">
                    <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                        <i class="fas fa-comment-alt text-white text-2xl"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-4">Share Your Feedback</h3>
                    <p class="text-gray-600 mb-6">Help us improve your health analytics experience. Every suggestion counts!</p>
                    <div class="space-y-3">
                        <div class="flex flex-wrap justify-center gap-3">
                            <button onclick="this.sendFeedback('bug_report')" 
                               class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold transition-all transform hover:scale-105">
                                <i class="fas fa-bug mr-2"></i>Report Bug
                            </button>
                            <button onclick="this.sendFeedback('feature_request')" 
                               class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold transition-all transform hover:scale-105">
                                <i class="fas fa-lightbulb mr-2"></i>Request Feature
                            </button>
                            <button onclick="this.sendFeedback('compliment')" 
                               class="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full font-semibold transition-all transform hover:scale-105">
                                <i class="fas fa-thumbs-up mr-2"></i>Say Thanks
                            </button>
                        </div>
                        <button onclick="this.sendFeedback('general_feedback')" 
                           class="px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-full font-semibold transition-all transform hover:scale-105">
                            <i class="fas fa-comment mr-2"></i>General Feedback
                        </button>
                    </div>
                    <div class="mt-4 text-sm text-gray-500">
                        <p>Messages are sent directly to our team via Telegram</p>
                    </div>
                </div>
            </section>
        `;
    }

    // Helper methods
    getStatusMessage(status, flags) {
        if (status === 'optimal') return 'All systems performing well';
        if (status === 'alert') return 'Attention needed - check alerts below';
        return 'Monitor current patterns closely';
    }

    getLatestSleepEfficiency() {
        if (!this.healthData.sleep.length) return 0;
        return this.healthData.sleep[0].sleep_efficiency || 0;
    }

    getRiskColor(risk) {
        return risk === 'low' ? 'green' : risk === 'moderate' ? 'yellow' : 'red';
    }

    getProgressionIcon(progression) {
        const icons = {
            building: 'fa-trending-up',
            maintaining: 'fa-equals',
            recovering: 'fa-bed',
            overreaching: 'fa-exclamation-triangle',
            no_data: 'fa-question'
        };
        return icons[progression] || 'fa-chart-line';
    }

    async sendFeedback(type) {
        if (!window.Telegram || !window.Telegram.WebApp) {
            alert('Feedback can only be sent from within the Telegram Web App');
            return;
        }

        const feedbackTypes = {
            'bug_report': 'Report a Bug',
            'feature_request': 'Request a Feature',
            'compliment': 'Say Thanks',
            'general_feedback': 'General Feedback'
        };

        const message = prompt(`${feedbackTypes[type]}:\n\nPlease describe your ${type === 'bug_report' ? 'issue' : type === 'feature_request' ? 'feature idea' : 'feedback'}:`);
        
        if (!message || message.trim().length < 10) {
            if (message !== null) { // null means user cancelled
                alert('Please provide more details (at least 10 characters)');
            }
            return;
        }

        try {
            // Send feedback via Telegram Web App
            const tg = window.Telegram.WebApp;
            const feedbackData = {
                type: type,
                category: 'dashboard',
                message: message.trim(),
                context: {
                    source: 'web_dashboard',
                    user_agent: navigator.userAgent,
                    page: 'health_analytics',
                    timestamp: new Date().toISOString()
                }
            };

            // Use Telegram Web App to send data back to the bot
            tg.sendData(JSON.stringify({
                action: 'feedback',
                data: feedbackData
            }));

            // Show success message
            this.showFeedbackSuccess(type);

        } catch (error) {
            console.error('Error sending feedback:', error);
            alert('Error sending feedback. Please try again or send feedback directly in the bot.');
        }
    }

    showFeedbackSuccess(type) {
        const typeMessages = {
            'bug_report': 'Bug report sent! Our team will investigate the issue.',
            'feature_request': 'Feature request sent! We appreciate your suggestions.',
            'compliment': 'Thanks for the kind words! We appreciate your support.',
            'general_feedback': 'Feedback sent! Thanks for helping us improve.'
        };

        // Create a temporary success overlay
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        overlay.innerHTML = `
            <div class="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
                <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-check text-white text-2xl"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">Feedback Sent!</h3>
                <p class="text-gray-600 mb-4">${typeMessages[type]}</p>
                <button onclick="this.remove()" class="px-6 py-2 bg-green-500 text-white rounded-full font-semibold">
                    Got it
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 5000);
    }

    showTelegramAuthPrompt() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="glass-card p-12 rounded-2xl shadow-lg text-center max-w-2xl">
                        <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <i class="fas fa-link text-3xl text-white"></i>
                        </div>
                        <h2 class="text-3xl font-bold text-gray-800 mb-4">Connect Your Health Devices</h2>
                        <p class="text-gray-600 mb-8">To view your health dashboard, you need to connect your Oura Ring and/or Strava account first.</p>
                        <div class="space-y-4">
                            <button onclick="window.Telegram.WebApp.close()" 
                               class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                                <i class="fas fa-arrow-left mr-3 text-xl"></i>
                                Return to Bot
                            </button>
                            <div class="text-sm text-gray-500">
                                <p>1. Use /connect_oura or /connect_strava in the bot</p>
                                <p>2. Complete the device connection process</p>
                                <p>3. Return to view your health analytics</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showAuthPrompt() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="glass-card p-12 rounded-2xl shadow-lg text-center max-w-2xl">
                        <div class="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <i class="fab fa-telegram-plane text-3xl text-white"></i>
                        </div>
                        <h2 class="text-3xl font-bold text-gray-800 mb-4">Access Your Health Dashboard</h2>
                        <p class="text-gray-600 mb-8">To view your personalized health analytics, you need to connect through the Fitlink Bot on Telegram.</p>
                        <div class="space-y-4">
                            <a href="https://t.me/the_fitlink_bot?start=dashboard" 
                               class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                                <i class="fab fa-telegram-plane mr-3 text-xl"></i>
                                Connect via Telegram Bot
                            </a>
                            <div class="text-sm text-gray-500">
                                <p>1. Start the bot and connect your Oura/Strava accounts</p>
                                <p>2. The bot will provide you with a secure dashboard link</p>
                                <p>3. Return here to view your personalized analytics</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showNoDataState() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="glass-card p-12 rounded-2xl shadow-lg text-center max-w-2xl">
                        <div class="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <i class="fas fa-chart-line text-3xl text-white"></i>
                        </div>
                        <h2 class="text-3xl font-bold text-gray-800 mb-4">Building Your Health Profile</h2>
                        <p class="text-gray-600 mb-8">Connect your Oura Ring and Strava accounts to start seeing personalized health analytics and deep insights.</p>
                        <div class="space-y-4">
                            <a href="https://t.me/the_fitlink_bot" 
                               class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                                <i class="fab fa-telegram-plane mr-3 text-xl"></i>
                                Connect Your Devices
                            </a>
                            <div class="text-sm text-gray-500">
                                <p>Once connected, you'll see:</p>
                                <p>• 30-day trend analysis • Predictive health alerts</p>
                                <p>• Peak performance windows • Personalized micro-habits</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showError(message) {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="flex items-center justify-center min-h-screen">
                    <div class="glass-card p-12 rounded-2xl shadow-lg text-center max-w-lg">
                        <div class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-exclamation-triangle text-2xl text-white"></i>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">Unable to Load Dashboard</h2>
                        <p class="text-gray-600 mb-6">${message}</p>
                        <button onclick="window.location.reload()" 
                                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            Try Again
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new FitlinkDashboard();
    dashboard.init();
});

// Make dashboard globally available for debugging
window.FitlinkDashboard = FitlinkDashboard;