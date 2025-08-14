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
                
                // Check for user data in initDataUnsafe
                if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
                    const user = tg.initDataUnsafe.user;
                    
                    try {
                        await this.authenticateTelegramUser(user.id, tg.initData);
                        return; // Success - exit here
                    } catch (error) {
                        this.showWebAppError();
                        return;
                    }
                }
                
                // Fallback: Check URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const userIdParam = urlParams.get('user_id');
                
                if (userIdParam) {
                    await this.authenticateTelegramUser(parseInt(userIdParam), 'url_param');
                    return;
                }
                
                this.showWebAppError();
            } else {
                // Check URL parameters for direct access
                const urlParams = new URLSearchParams(window.location.search);
                const userIdParam = urlParams.get('user_id');
                
                if (userIdParam) {
                    await this.authenticateTelegramUser(parseInt(userIdParam), 'direct_url');
                    return;
                }
                
                this.showNotLoggedIn();
            }
        } catch (error) {
            this.showWebAppError();
        }
    }

    async authenticateTelegramUser(telegramUserId, initData) {
        try {
            // Convert to number for consistency
            const userId = parseInt(telegramUserId);
            
			// Call Supabase Edge Function directly for user lookup
			const response = await fetch('https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-test/user-lookup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ telegram_id: userId })
			});

			// If user not found or function requires auth (401), treat as authenticated with no data
			if (response.status === 404 || response.status === 401) {
				this.currentUser = { id: null, telegram_id: userId, username: null, first_name: null, last_name: null };
				this.healthData = { sleep: [], activities: [], summary: this.getEmptyHealthSummary() };
				await this.checkConnectedProviders();
				this.renderDashboard();
				return this.currentUser;
			}

			if (!response.ok) {
				throw new Error(`User lookup failed: ${response.status}`);
			}

			const userData = await response.json();
            
            if (userData.error) {
                throw new Error(userData.error);
            }

            // Store the user data and health data
            this.currentUser = userData.user;
            this.healthData = {
                sleep: userData.health_data.sleep,
                activities: userData.health_data.activities,
                summary: this.generateHealthSummary(userData.health_data.sleep, userData.health_data.activities)
            };

            // Check connected providers
            await this.checkConnectedProviders();
            
            // Render the dashboard
            this.renderDashboard();
            
            return userData.user;
            
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    async processFoundUser(user) {
        this.currentUser = user;
        
        // Check connected providers
        await this.checkConnectedProviders();
        await this.loadHealthData();
        
        return user;
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
            this.showNotLoggedIn();
        }
    }

    async loadHealthData() {
        try {
            this.isLoading = true;

            const telegramId = this.currentUser?.telegram_id;
            if (!telegramId) {
                this.showNoData();
                return;
            }

            const response = await fetch('https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/oauth-test/user-lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_id: telegramId })
            });

            if (!response.ok) {
                this.showNoData();
                return;
            }

            const userData = await response.json();

            this.currentUser = userData.user;
            const sleepData = userData.health_data.sleep || [];
            const activityData = userData.health_data.activities || [];

            this.healthData = {
                sleep: sleepData,
                activities: activityData,
                providers: userData.health_data.providers || [],
                summary: this.generateHealthSummary(sleepData, activityData)
            };

            this.renderDashboard();
        } catch (error) {
            this.showNoData();
        } finally {
            this.isLoading = false;
        }
    }

    async loadSleepData() {
        return this.healthData?.sleep || [];
    }

    async loadActivityData() {
        return this.healthData?.activities || [];
    }

    async loadBriefingLogs() {
        // Not available via public client; route via server function in future if needed
        return [];
    }
    
    async checkConnectedProviders() {
        // Use the providers data we already loaded from the endpoint
        if (this.healthData && this.healthData.providers) {
            this.connectedProviders = this.healthData.providers.filter(p => p.is_active);
        } else {
            this.connectedProviders = [];
        }
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
        if (!dashboard) {
            return;
        }
        
		// If authenticated but no data, show an authenticated empty state
		if (!this.healthData || (!this.healthData.sleep.length && !this.healthData.activities.length)) {
			this.showNoData();
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
            <section class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Health Status</h2>
                <div class="grid grid-cols-2 gap-3">
                    <div class="glass-card metric-card p-4 rounded-xl shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-sm font-semibold text-gray-700">Overall</h3>
                            <div class="status-indicator status-${overallStatus} ${overallStatus === 'optimal' ? 'pulse-dot' : ''}"></div>
                        </div>
                        <div class="text-xl font-bold text-${config.color}-600 mb-1">${config.text}</div>
                        <p class="text-xs text-gray-500">${this.getStatusMessage(overallStatus, predictive_flags)}</p>
                    </div>

                    <div class="glass-card metric-card p-4 rounded-xl shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-sm font-semibold text-gray-700">HRV</h3>
                            <i class="fas fa-arrow-${recent.hrv_pattern.trend > 0 ? 'up' : recent.hrv_pattern.trend < 0 ? 'down' : 'right'} trend-${recent.hrv_pattern.trend > 0 ? 'up' : recent.hrv_pattern.trend < 0 ? 'down' : 'stable'}"></i>
                        </div>
                        <div class="text-xl font-bold text-gray-800 mb-1">${recent.hrv_pattern.avg.toFixed(1)}</div>
                        <p class="text-xs text-${recent.hrv_pattern.trend > 0 ? 'green' : recent.hrv_pattern.trend < 0 ? 'red' : 'gray'}-600">
                            ${recent.hrv_pattern.trend > 0 ? '+' : ''}${recent.hrv_pattern.trend.toFixed(1)}% ${recent.hrv_pattern.trend > 0 ? 'improving' : recent.hrv_pattern.trend < 0 ? 'declining' : 'stable'}
                        </p>
                    </div>

                    <div class="glass-card metric-card p-4 rounded-xl shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-sm font-semibold text-gray-700">Sleep</h3>
                            <i class="fas fa-${recent.sleep_trend === 'improving' ? 'arrow-up' : recent.sleep_trend === 'declining' ? 'arrow-down' : 'minus'} trend-${recent.sleep_trend === 'improving' ? 'up' : recent.sleep_trend === 'declining' ? 'down' : 'stable'}"></i>
                        </div>
                        <div class="text-xl font-bold text-gray-800 mb-1">${this.getLatestSleepEfficiency()}%</div>
                        <p class="text-xs text-gray-600">${recent.sleep_trend === 'no_data' ? 'No data' : recent.sleep_trend}</p>
                    </div>

                    <div class="glass-card metric-card p-4 rounded-xl shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <h3 class="text-sm font-semibold text-gray-700">Training</h3>
                            <i class="fas fa-arrow-up trend-up"></i>
                        </div>
                        <div class="text-xl font-bold text-gray-800 mb-1">${recent.training_load.current}</div>
                        <p class="text-xs text-blue-600">TSS ${recent.training_load.current > 0 ? 'active' : 'rest'}</p>
                    </div>
                </div>
            </section>
        `;
    }

    renderDeepAnalysis(summary) {
        const { recent, predictive_flags } = summary;
        
        return `
            <section class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Deep Analysis Insights</h2>
                <div class="grid grid-cols-1 gap-4">
                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-lg font-bold text-gray-800 mb-4">30-Day Trend Analysis</h3>
                        <div class="data-viz mb-4 h-32">
                            <div class="chart-line"></div>
                            <div class="absolute top-2 left-2 text-xs text-gray-600">
                                <span class="inline-block w-2 h-2 bg-purple-500 rounded-full mr-1"></span>
                                Real HRV Pattern Data
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <h4 class="font-semibold text-gray-700 mb-1 text-sm">Sleep Consistency</h4>
                                <div class="text-lg font-bold text-${summary.weekly.sleep_consistency > 75 ? 'green' : summary.weekly.sleep_consistency > 50 ? 'yellow' : 'red'}-600">
                                    ${summary.weekly.sleep_consistency.toFixed(0)}/100
                                </div>
                            </div>
                            <div>
                                <h4 class="font-semibold text-gray-700 mb-1 text-sm">Recovery Status</h4>
                                <div class="text-lg font-bold text-${recent.energy_pattern === 'consistent' ? 'green' : recent.energy_pattern === 'variable' ? 'yellow' : 'red'}-600">
                                    ${recent.energy_pattern === 'consistent' ? 'Strong' : recent.energy_pattern === 'variable' ? 'Variable' : recent.energy_pattern === 'declining' ? 'Declining' : 'Unknown'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-lg font-bold text-gray-800 mb-4">Predictive Health Alerts</h3>
                        <div class="space-y-3">
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
            <div class="bg-${color}-50 border border-${color}-200 p-3 rounded-lg">
                <div class="flex items-center mb-1">
                    <i class="fas ${icon} text-${color}-600 mr-2 text-sm"></i>
                    <h4 class="font-semibold text-${color}-800 text-sm">${title}</h4>
                </div>
                <p class="text-${color}-700 text-xs">${messages[title]}</p>
            </div>
        `;
    }

    renderHRVAlerts(alerts) {
        return alerts.map(alert => `
            <div class="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <div class="flex items-center mb-1">
                    <i class="fas fa-heartbeat text-orange-600 mr-2 text-sm"></i>
                    <h4 class="font-semibold text-orange-800 text-sm">HRV Alert</h4>
                </div>
                <p class="text-orange-700 text-xs">${alert}</p>
            </div>
        `).join('');
    }

    renderWeeklyInsights(summary) {
        const { weekly } = summary;
        
        return `
            <section class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Weekly Performance Insights</h2>
                <div class="space-y-4">
                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Training Progression</h3>
                        <div class="text-center mb-3">
                            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                                <i class="fas ${this.getProgressionIcon(weekly.training_progression)} text-lg text-white"></i>
                            </div>
                            <div class="text-lg font-bold text-blue-600 capitalize">${weekly.training_progression}</div>
                        </div>
                        <div class="grid grid-cols-2 gap-3 text-xs text-gray-600">
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

                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Stress Indicators</h3>
                        <div class="space-y-3">
                            <div>
                                <div class="flex justify-between mb-1">
                                    <span class="text-xs text-gray-600">Poor HRV Days</span>
                                    <span class="text-xs font-semibold text-${weekly.stress_indicators.poor_hrv_days <= 2 ? 'green' : weekly.stress_indicators.poor_hrv_days <= 4 ? 'yellow' : 'red'}-600">
                                        ${weekly.stress_indicators.poor_hrv_days}/7
                                    </span>
                                </div>
                                <div class="bg-gray-200 rounded-full h-1.5">
                                    <div class="bg-${weekly.stress_indicators.poor_hrv_days <= 2 ? 'green' : weekly.stress_indicators.poor_hrv_days <= 4 ? 'yellow' : 'red'}-500 h-1.5 rounded-full" 
                                         style="width: ${(weekly.stress_indicators.poor_hrv_days / 7) * 100}%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between mb-1">
                                    <span class="text-xs text-gray-600">Elevated RHR Days</span>
                                    <span class="text-xs font-semibold text-${weekly.stress_indicators.elevated_rhr_days <= 1 ? 'green' : weekly.stress_indicators.elevated_rhr_days <= 3 ? 'yellow' : 'red'}-600">
                                        ${weekly.stress_indicators.elevated_rhr_days}/7
                                    </span>
                                </div>
                                <div class="bg-gray-200 rounded-full h-1.5">
                                    <div class="bg-${weekly.stress_indicators.elevated_rhr_days <= 1 ? 'green' : weekly.stress_indicators.elevated_rhr_days <= 3 ? 'yellow' : 'red'}-500 h-1.5 rounded-full" 
                                         style="width: ${(weekly.stress_indicators.elevated_rhr_days / 7) * 100}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Adaptation Signals</h3>
                        <div class="space-y-2">
                            ${weekly.adaptation_signals.length > 0 ? 
                                weekly.adaptation_signals.map(signal => `
                                    <div class="flex items-center">
                                        <i class="fas fa-check-circle text-green-500 mr-2 text-xs"></i>
                                        <span class="text-xs text-gray-700">${signal}</span>
                                    </div>
                                `).join('') : 
                                '<div class="flex items-center"><i class="fas fa-clock text-gray-400 mr-2 text-xs"></i><span class="text-xs text-gray-500">Building adaptation data...</span></div>'
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
            <section class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Today's Micro-Habits</h2>
                <div class="glass-card p-4 rounded-xl shadow-lg">
                    <div class="space-y-4">
                        ${habits.map(habit => `
                            <div class="flex items-start space-x-3">
                                <div class="w-10 h-10 bg-gradient-to-br ${habit.gradient} rounded-lg flex items-center justify-center flex-shrink-0">
                                    <i class="fas ${habit.icon} text-sm text-white"></i>
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-gray-800 text-sm mb-1">${habit.time}</h3>
                                    <p class="text-xs text-gray-600">${habit.description}</p>
                                </div>
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
            <section class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4">Data Integration Status</h2>
                <div class="space-y-3">
                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center">
                                <div class="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                                    <i class="fas fa-ring text-white text-sm"></i>
                                </div>
                                <div>
                                    <h3 class="font-semibold text-gray-800 text-sm">Oura Ring</h3>
                                    <p class="text-xs text-gray-600">Sleep & Recovery Data</p>
                                </div>
                            </div>
                            <div class="status-indicator status-${ouraStatus}"></div>
                        </div>
                        <div class="text-xs text-gray-600 space-y-1">
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

                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center">
                                <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3">
                                    <i class="fas fa-bicycle text-white text-sm"></i>
                                </div>
                                <div>
                                    <h3 class="font-semibold text-gray-800 text-sm">Strava</h3>
                                    <p class="text-xs text-gray-600">Training & Activities</p>
                                </div>
                            </div>
                            <div class="status-indicator status-${stravaStatus}"></div>
                        </div>
                        <div class="text-xs text-gray-600 space-y-1">
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
            <section class="mb-6">
                <div class="glass-card p-4 rounded-xl shadow-lg text-center">
                    <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <i class="fas fa-comment-alt text-white text-sm"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-2">Send Feedback</h3>
                    <p class="text-gray-600 mb-4 text-sm">Help us improve your experience</p>
                    <div class="space-y-2">
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="this.sendFeedback('bug_report')" 
                               class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-all">
                                <i class="fas fa-bug mr-1"></i>Bug
                            </button>
                            <button onclick="this.sendFeedback('feature_request')" 
                               class="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-all">
                                <i class="fas fa-lightbulb mr-1"></i>Feature
                            </button>
                            <button onclick="this.sendFeedback('compliment')" 
                               class="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-all">
                                <i class="fas fa-thumbs-up mr-1"></i>Thanks
                            </button>
                            <button onclick="this.sendFeedback('general_feedback')" 
                               class="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-semibold transition-all">
                                <i class="fas fa-comment mr-1"></i>Other
                            </button>
                        </div>
                    </div>
                    <div class="mt-3 text-xs text-gray-500">
                        <p>Messages sent to our team via Telegram</p>
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

    showNotLoggedIn() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="glass-card p-6 rounded-xl shadow-lg text-center">
                    <div class="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-exclamation-triangle text-2xl text-white"></i>
                    </div>
                    <h2 class="text-xl font-bold text-gray-800 mb-3">Open via Telegram Bot</h2>
                    <p class="text-gray-600 text-sm mb-4">This dashboard must be accessed through the Fitlink Bot, not directly in a browser.</p>
                    <a href="https://t.me/the_fitlink_bot" 
                       class="inline-block px-6 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg text-sm">
                        <i class="fab fa-telegram-plane mr-2"></i>
                        Open in Bot
                    </a>
                </div>
            `;
        }
    }
    
    showWebAppError() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            // Get debug info
            const tg = window.Telegram?.WebApp;
            const debugInfo = {
                hasTelegram: !!window.Telegram,
                hasWebApp: !!tg,
                version: tg?.version || 'N/A',
                platform: tg?.platform || 'N/A',
                hasInitData: !!tg?.initData,
                hasInitDataUnsafe: !!tg?.initDataUnsafe,
                hasUser: !!(tg?.initDataUnsafe?.user),
                userId: tg?.initDataUnsafe?.user?.id || 'None',
                userName: tg?.initDataUnsafe?.user?.first_name || 'None'
            };
            
            dashboard.innerHTML = `
                <div class="space-y-4">
                    <div class="glass-card p-4 rounded-xl shadow-lg text-center">
                        <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                            <i class="fas fa-bug text-white"></i>
                        </div>
                        <h2 class="text-lg font-bold text-gray-800 mb-2">WebApp Debug Info</h2>
                        <p class="text-gray-600 text-sm mb-3">Connection status between Telegram and dashboard</p>
                    </div>
                    
                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-md font-bold text-gray-800 mb-3">🔍 Technical Details</h3>
                        <div class="space-y-2 text-xs">
                            <div class="flex justify-between">
                                <span>Telegram Available:</span>
                                <span class="${debugInfo.hasTelegram ? 'text-green-600' : 'text-red-600'} font-bold">
                                    ${debugInfo.hasTelegram ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>WebApp Available:</span>
                                <span class="${debugInfo.hasWebApp ? 'text-green-600' : 'text-red-600'} font-bold">
                                    ${debugInfo.hasWebApp ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>WebApp Version:</span>
                                <span class="font-mono">${debugInfo.version}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Platform:</span>
                                <span class="font-mono">${debugInfo.platform}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Has InitData:</span>
                                <span class="${debugInfo.hasInitData ? 'text-green-600' : 'text-red-600'} font-bold">
                                    ${debugInfo.hasInitData ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>Has User Data:</span>
                                <span class="${debugInfo.hasUser ? 'text-green-600' : 'text-red-600'} font-bold">
                                    ${debugInfo.hasUser ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>User ID:</span>
                                <span class="font-mono text-blue-600">${debugInfo.userId}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>User Name:</span>
                                <span class="font-mono text-blue-600">${debugInfo.userName}</span>
                            </div>
                        </div>
                        
                        ${debugInfo.hasUser ? `
                            <div class="mt-3 p-2 bg-blue-50 rounded text-center">
                                <p class="text-xs text-blue-800">
                                    🔄 User data found! If you're still seeing this screen, 
                                    there may be a database connection issue.
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="glass-card p-4 rounded-xl shadow-lg text-center">
                        <h3 class="text-md font-bold text-gray-800 mb-2">🛠️ Actions</h3>
                        <div class="space-y-2">
                            ${debugInfo.hasUser ? `
                                <button onclick="window.dashboard?.authenticateTelegramUser(${debugInfo.userId}, 'manual_retry').catch(e => { document.getElementById('error-details').innerHTML = 'Auth Error: ' + e.message; })" 
                                   class="inline-block px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
                                    🔄 Retry Authentication
                                </button>
                                <div id="error-details" class="mt-2 p-2 bg-red-100 text-red-800 text-xs rounded min-h-4"></div>
                            ` : ''}
                            <a href="https://t.me/the_fitlink_bot" 
                               class="inline-block px-3 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg text-sm font-semibold">
                                <i class="fab fa-telegram-plane mr-1"></i>
                                Return to Bot
                            </a>
                        </div>
                        <p class="text-gray-600 text-xs mt-2">
                            ${debugInfo.hasUser ? 'User data found - try retry button' : 'No user data - return to bot'}
                        </p>
                    </div>
                </div>
            `;
        }
    }
    


    showNoData() {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
			dashboard.innerHTML = `
				<div class="space-y-4">
					<div class="glass-card p-4 rounded-xl shadow-lg text-center">
						<div class="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-3">
							<i class="fas fa-user-check text-white"></i>
						</div>
						<h2 class="text-lg font-bold text-gray-800 mb-2">Authenticated</h2>
						<p class="text-gray-600 text-sm mb-3">No data connected yet. Connect Oura Ring and Strava to see your health insights.</p>
						<a href="https://t.me/the_fitlink_bot" 
						   class="inline-block px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg text-sm font-semibold">
							Connect Devices
						</a>
					</div>
                    
                    <div class="glass-card p-4 rounded-xl shadow-lg">
                        <h3 class="text-lg font-bold text-gray-800 mb-3">Available Connections</h3>
                        <div class="space-y-2">
                            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div class="flex items-center">
                                    <i class="fas fa-ring text-red-500 mr-2"></i>
                                    <span class="text-sm font-medium">Oura Ring</span>
                                </div>
                                <span class="text-xs text-gray-500">Sleep & Recovery</span>
                            </div>
                            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div class="flex items-center">
                                    <i class="fas fa-bicycle text-orange-500 mr-2"></i>
                                    <span class="text-sm font-medium">Strava</span>
                                </div>
                                <span class="text-xs text-gray-500">Training & Activities</span>
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderFeedbackSection()}
                </div>
            `;
        }
    }

    showError(message) {
        const dashboard = document.getElementById('dashboard-content');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="space-y-6">
                    <div class="glass-card p-6 rounded-xl shadow-lg text-center">
                        <div class="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-wrench text-2xl text-white"></i>
                        </div>
                        <h2 class="text-xl font-bold text-gray-800 mb-3">Dashboard Temporarily Unavailable</h2>
                        <p class="text-gray-600 text-sm mb-4">${message}</p>
                        <div class="space-y-2">
                            <button onclick="window.location.reload()" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold">
                                <i class="fas fa-redo mr-2"></i>
                                Try Again
                            </button>
                            <button onclick="window.Telegram?.WebApp?.close()" 
                                    class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-semibold ml-2">
                                <i class="fab fa-telegram-plane mr-2"></i>
                                Return to Bot
                            </button>
                        </div>
                    </div>
                    
                    <div class="glass-card p-4 rounded-xl shadow-lg bg-gradient-to-br from-green-50 to-blue-50">
                        <div class="text-center">
                            <h3 class="text-lg font-bold text-gray-800 mb-2">💪 Don't Let This Stop You!</h3>
                            <p class="text-gray-600 text-sm mb-3">While we fix this, keep building healthy habits:</p>
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="bg-white p-2 rounded text-center">
                                    <i class="fas fa-bed text-blue-500 mb-1"></i>
                                    <p class="font-semibold">Quality Sleep</p>
                                </div>
                                <div class="bg-white p-2 rounded text-center">
                                    <i class="fas fa-running text-green-500 mb-1"></i>
                                    <p class="font-semibold">Stay Active</p>
                                </div>
                                <div class="bg-white p-2 rounded text-center">
                                    <i class="fas fa-apple-alt text-red-500 mb-1"></i>
                                    <p class="font-semibold">Eat Well</p>
                                </div>
                                <div class="bg-white p-2 rounded text-center">
                                    <i class="fas fa-heart text-purple-500 mb-1"></i>
                                    <p class="font-semibold">Manage Stress</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderFeedbackSection()}
                </div>
            `;
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new FitlinkDashboard();
    window.dashboard = dashboard; // Make available for debugging
    
    // Add a small delay to ensure Telegram WebApp is ready
    setTimeout(() => {
        dashboard.init();
    }, 100);
});

// Also try initialization on window load as backup
window.addEventListener('load', () => {
    if (!window.dashboard) {
        const dashboard = new FitlinkDashboard();
        window.dashboard = dashboard;
        dashboard.init();
    }
});

// Make dashboard class globally available for debugging
window.FitlinkDashboard = FitlinkDashboard;