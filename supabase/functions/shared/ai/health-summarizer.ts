import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export interface RecentTrends {
  sleep_trend: "declining" | "stable" | "improving";
  hrv_pattern: { avg: number; trend: number; alerts: string[] };
  training_load: { current: number; weekly_avg: number; fatigue_score: number };
  recovery_markers: { rhr_change: number; temp_deviation: number };
  energy_pattern: "consistent" | "variable" | "declining";
}

export interface WeeklyInsights {
  sleep_consistency: number; // 0-100 score
  training_progression: "building" | "maintaining" | "recovering" | "overreaching";
  stress_indicators: { elevated_rhr_days: number; poor_hrv_days: number };
  performance_markers: { quality_sessions: number; recovery_days: number };
  adaptation_signals: string[];
}

export interface MonthlyPatterns {
  seasonal_trends: string[];
  adaptation_cycles: { training_blocks: number; recovery_phases: number };
  health_correlations: { sleep_training: number; stress_recovery: number };
  baseline_shifts: { hrv_trend: number; rhr_trend: number };
  lifestyle_patterns: string[];
}

export interface HealthSummary {
  user_profile: {
    age: number;
    sex: string;
    training_goal: string;
    experience_level: "beginner" | "intermediate" | "advanced";
  };
  recent: RecentTrends;
  weekly: WeeklyInsights;
  monthly: MonthlyPatterns;
  predictive_flags: {
    illness_risk: "low" | "moderate" | "high";
    overtraining_risk: "low" | "moderate" | "high";
    peak_performance_window: string | null;
  };
}

export async function generateHealthSummary(
  userId: string,
  supabase: SupabaseClient,
  daysBack: number = 30
): Promise<HealthSummary> {
  // Get user profile
  const { data: user } = await supabase
    .from('users')
    .select('age, sex, training_goal')
    .eq('id', userId)
    .single();

  // Get recent sleep data (last 30 days)
  const { data: sleepData } = await supabase
    .from('oura_sleep')
    .select('*')
    .eq('user_id', userId)
    .gte('day', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('day', { ascending: false });

  // Get recent activity data from Strava
  const { data: activityData } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('user_id', userId)
    .gte('start_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
    .order('start_date', { ascending: false });

  // Generate summaries
  const recent = await analyzeRecentTrends(sleepData?.slice(0, 3) || [], activityData?.slice(0, 7) || []);
  const weekly = await analyzeWeeklyInsights(sleepData?.slice(0, 7) || [], activityData?.slice(0, 14) || []);
  const monthly = await analyzeMonthlyPatterns(sleepData || [], activityData || []);

  return {
    user_profile: {
      age: user?.age || 30,
      sex: user?.sex || 'unknown',
      training_goal: user?.training_goal || 'general_fitness',
      experience_level: inferExperienceLevel(activityData || [])
    },
    recent,
    weekly,
    monthly,
    predictive_flags: generatePredictiveFlags(recent, weekly, monthly)
  };
}

async function analyzeRecentTrends(sleepData: any[], activityData: any[]): Promise<RecentTrends> {
  // Analyze last 3 days of sleep
  const recentSleep = sleepData.slice(0, 3);
  const sleepEfficiencies = recentSleep.map(s => s.efficiency || 0);
  const hrvValues = recentSleep.map(s => s.heart_rate_variability || 0).filter(h => h > 0);
  const rhrValues = recentSleep.map(s => s.lowest_heart_rate || 0).filter(r => r > 0);

  // Calculate trends
  const sleepTrend = calculateTrend(sleepEfficiencies);
  const hrvTrend = calculateTrend(hrvValues);
  const rhrTrend = calculateTrend(rhrValues);

  // Training load analysis
  const recentActivities = activityData.slice(0, 7);
  const totalTSS = recentActivities.reduce((sum, a) => sum + (a.training_stress_score || a.suffer_score || 0), 0);
  const avgWeeklyTSS = totalTSS; // This week's TSS

  // Recovery markers
  const latestSleep = recentSleep[0];
  const rhrChange = rhrValues.length >= 2 ? rhrValues[0] - rhrValues[1] : 0;
  const tempDeviation = latestSleep?.temperature_deviation || 0;

  return {
    sleep_trend: sleepTrend > 5 ? "improving" : sleepTrend < -5 ? "declining" : "stable",
    hrv_pattern: {
      avg: hrvValues.length ? hrvValues.reduce((a, b) => a + b) / hrvValues.length : 0,
      trend: hrvTrend,
      alerts: generateHRVAlerts(hrvValues, hrvTrend)
    },
    training_load: {
      current: totalTSS,
      weekly_avg: avgWeeklyTSS,
      fatigue_score: calculateFatigueScore(totalTSS, hrvValues, rhrValues)
    },
    recovery_markers: {
      rhr_change: rhrChange,
      temp_deviation: tempDeviation
    },
    energy_pattern: analyzeEnergyPattern(recentSleep, recentActivities)
  };
}

async function analyzeWeeklyInsights(sleepData: any[], activityData: any[]): Promise<WeeklyInsights> {
  // Sleep consistency (coefficient of variation)
  const sleepDurations = sleepData.map(s => s.total_sleep_minutes || 0).filter(d => d > 0);
  const sleepConsistency = calculateConsistencyScore(sleepDurations);

  // Training progression analysis
  const weeklyTSS = activityData.reduce((sum, a) => sum + (a.tss_estimated || 0), 0);
  const sessionCount = activityData.length;
  const avgIntensity = sessionCount ? weeklyTSS / sessionCount : 0;

  // Stress indicators
  const hrvValues = sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0);
  const rhrValues = sleepData.map(s => s.resting_heart_rate || 0).filter(r => r > 0);
  
  const userHRVBaseline = calculateBaseline(hrvValues);
  const userRHRBaseline = calculateBaseline(rhrValues);
  
  const poorHRVDays = hrvValues.filter(hrv => hrv < userHRVBaseline * 0.9).length;
  const elevatedRHRDays = rhrValues.filter(rhr => rhr > userRHRBaseline * 1.05).length;

  return {
    sleep_consistency: sleepConsistency,
    training_progression: classifyTrainingProgression(weeklyTSS, sessionCount, avgIntensity),
    stress_indicators: {
      elevated_rhr_days: elevatedRHRDays,
      poor_hrv_days: poorHRVDays
    },
    performance_markers: {
      quality_sessions: activityData.filter(a => (a.tss_estimated || 0) > 50).length,
      recovery_days: 7 - sessionCount
    },
    adaptation_signals: generateAdaptationSignals(sleepData, activityData)
  };
}

async function analyzeMonthlyPatterns(sleepData: any[], activityData: any[]): Promise<MonthlyPatterns> {
  // Long-term trend analysis
  const hrvTrend = calculateLongTermTrend(sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0));
  const rhrTrend = calculateLongTermTrend(sleepData.map(s => s.resting_heart_rate || 0).filter(r => r > 0));

  return {
    seasonal_trends: identifySeasonalPatterns(sleepData, activityData),
    adaptation_cycles: analyzeAdaptationCycles(activityData),
    health_correlations: calculateHealthCorrelations(sleepData, activityData),
    baseline_shifts: {
      hrv_trend: hrvTrend,
      rhr_trend: rhrTrend
    },
    lifestyle_patterns: identifyLifestylePatterns(sleepData, activityData)
  };
}

// Helper functions
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const first = values[values.length - 1];
  const last = values[0];
  return ((last - first) / first) * 100;
}

function calculateConsistencyScore(values: number[]): number {
  if (values.length < 2) return 100;
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, 100 - (cv * 100)));
}

function calculateBaseline(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b) / values.length;
}

function calculateFatigueScore(tss: number, hrv: number[], rhr: number[]): number {
  // Complex fatigue scoring algorithm
  const tssScore = Math.min(100, tss / 5); // Normalize TSS
  const hrvScore = hrv.length ? (hrv[0] / calculateBaseline(hrv)) * 50 : 50;
  const rhrScore = rhr.length ? ((calculateBaseline(rhr) / rhr[0]) * 50) : 50;
  
  return Math.round((tssScore + hrvScore + rhrScore) / 3);
}

function generateHRVAlerts(hrv: number[], trend: number): string[] {
  const alerts: string[] = [];
  
  if (trend < -15) alerts.push("HRV declining rapidly - stress/fatigue warning");
  if (hrv.length && hrv[0] < 20) alerts.push("Very low HRV detected");
  if (hrv.length >= 3 && hrv.every(h => h < hrv[hrv.length - 1])) {
    alerts.push("Consistent HRV decline over 3 days");
  }
  
  return alerts;
}

function classifyTrainingProgression(tss: number, sessions: number, avgIntensity: number): WeeklyInsights['training_progression'] {
  if (tss > 400 && sessions > 6) return "overreaching";
  if (tss > 200 && sessions >= 4) return "building";
  if (sessions <= 2) return "recovering";
  return "maintaining";
}

function generateAdaptationSignals(sleepData: any[], activityData: any[]): string[] {
  const signals: string[] = [];
  
  // Add logic for detecting adaptation signals
  const avgHRV = sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0);
  const avgRHR = sleepData.map(s => s.resting_heart_rate || 0).filter(r => r > 0);
  
  if (avgHRV.length >= 7) {
    const recent = avgHRV.slice(0, 3).reduce((a, b) => a + b) / 3;
    const older = avgHRV.slice(4, 7).reduce((a, b) => a + b) / 3;
    if (recent > older * 1.1) signals.push("Positive adaptation - HRV improving");
  }
  
  return signals;
}

function generatePredictiveFlags(recent: RecentTrends, weekly: WeeklyInsights, monthly: MonthlyPatterns) {
  // Advanced illness risk calculation
  let illnessRisk: "low" | "moderate" | "high" = "low";
  let riskFactors = 0;
  
  if (recent.recovery_markers.rhr_change > 5) riskFactors++;
  if (recent.recovery_markers.temp_deviation > 0.5) riskFactors++;
  if (recent.hrv_pattern.trend < -20) riskFactors++;
  if (recent.sleep_trend === "declining") riskFactors++;
  if (weekly.stress_indicators.poor_hrv_days >= 3) riskFactors++;
  
  if (riskFactors >= 3) illnessRisk = "high";
  else if (riskFactors >= 2) illnessRisk = "moderate";
  
  // Advanced overtraining risk calculation
  let overtrainingRisk: "low" | "moderate" | "high" = "low";
  let overtrainingFactors = 0;
  
  if (recent.training_load.fatigue_score > 70) overtrainingFactors++;
  if (weekly.stress_indicators.poor_hrv_days >= 4) overtrainingFactors++;
  if (weekly.stress_indicators.elevated_rhr_days >= 3) overtrainingFactors++;
  if (recent.energy_pattern === "declining") overtrainingFactors++;
  if (weekly.training_progression === "overreaching") overtrainingFactors++;
  if (recent.training_load.current > recent.training_load.weekly_avg * 1.3) overtrainingFactors++;
  
  if (overtrainingFactors >= 4) overtrainingRisk = "high";
  else if (overtrainingFactors >= 2) overtrainingRisk = "moderate";
  
  // Enhanced peak performance window prediction
  let peakPerformanceWindow: string | null = null;
  let performanceFactors = 0;
  
  if (recent.hrv_pattern.trend > 10) performanceFactors++;
  if (recent.training_load.fatigue_score < 40) performanceFactors++;
  if (recent.sleep_trend === "improving") performanceFactors++;
  if (recent.energy_pattern === "consistent") performanceFactors++;
  if (weekly.training_progression === "building") performanceFactors++;
  if (recent.recovery_markers.rhr_change < 2) performanceFactors++;
  
  if (performanceFactors >= 5) {
    peakPerformanceWindow = "next 2-3 days (optimal conditions)";
  } else if (performanceFactors >= 4) {
    peakPerformanceWindow = "next 3-5 days";
  } else if (performanceFactors >= 3) {
    peakPerformanceWindow = "next 5-7 days";
  }
  
  return {
    illness_risk: illnessRisk,
    overtraining_risk: overtrainingRisk,
    peak_performance_window: peakPerformanceWindow
  };
}

function inferExperienceLevel(activities: any[]): "beginner" | "intermediate" | "advanced" {
  if (activities.length === 0) return "beginner";
  
  const avgTSS = activities.reduce((sum, a) => sum + (a.tss_estimated || 0), 0) / activities.length;
  const maxDuration = Math.max(...activities.map(a => a.duration_seconds || 0));
  
  if (avgTSS > 80 && maxDuration > 7200) return "advanced";
  if (avgTSS > 40 && maxDuration > 3600) return "intermediate";
  return "beginner";
}

function calculateLongTermTrend(values: number[]): number {
  // Simple linear regression slope
  if (values.length < 10) return 0;
  
  const n = values.length;
  const sumX = n * (n - 1) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, val, idx) => sum + (idx * val), 0);
  const sumXX = n * (n - 1) * (2 * n - 1) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
}

function identifySeasonalPatterns(sleepData: any[], activityData: any[]): string[] {
  const patterns: string[] = [];
  
  if (sleepData.length === 0) return patterns;
  
  // Analyze sleep duration changes over time
  const recentSleep = sleepData.slice(0, 10).map(s => s.total_sleep_minutes || 0);
  const olderSleep = sleepData.slice(-10).map(s => s.total_sleep_minutes || 0);
  
  if (recentSleep.length && olderSleep.length) {
    const recentAvg = recentSleep.reduce((a, b) => a + b) / recentSleep.length;
    const olderAvg = olderSleep.reduce((a, b) => a + b) / olderSleep.length;
    
    if (recentAvg > olderAvg + 30) patterns.push("Increased sleep need (seasonal/stress)");
    if (recentAvg < olderAvg - 30) patterns.push("Reduced sleep duration trend");
  }
  
  // Analyze activity patterns
  if (activityData.length > 0) {
    const weekendActivities = activityData.filter(a => {
      const day = new Date(a.start_time).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });
    
    if (weekendActivities.length > activityData.length * 0.4) {
      patterns.push("Weekend warrior pattern");
    }
    
    // Check for indoor vs outdoor activities by duration patterns
    const avgDuration = activityData.reduce((sum, a) => sum + (a.duration_seconds || 0), 0) / activityData.length;
    if (avgDuration < 2400) { // Less than 40 min average
      patterns.push("Short indoor session preference");
    }
  }
  
  return patterns.length ? patterns : ["Consistent activity patterns"];
}

function analyzeAdaptationCycles(activityData: any[]): { training_blocks: number; recovery_phases: number } {
  if (activityData.length < 7) {
    return { training_blocks: 0, recovery_phases: 0 };
  }
  
  // Group activities by weeks
  const weeks: { [key: string]: any[] } = {};
  activityData.forEach(activity => {
    const weekKey = getWeekKey(new Date(activity.start_time));
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(activity);
  });
  
  let trainingBlocks = 0;
  let recoveryPhases = 0;
  
  Object.values(weeks).forEach(weekActivities => {
    const weeklyTSS = weekActivities.reduce((sum, a) => sum + (a.tss_estimated || 0), 0);
    const sessionCount = weekActivities.length;
    
    // Training block: 4+ sessions or high TSS
    if (sessionCount >= 4 || weeklyTSS > 200) {
      trainingBlocks++;
    }
    // Recovery phase: 0-2 sessions and low TSS
    else if (sessionCount <= 2 && weeklyTSS < 100) {
      recoveryPhases++;
    }
  });
  
  return { training_blocks: trainingBlocks, recovery_phases: recoveryPhases };
}

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toISOString().split('T')[0];
}

function calculateHealthCorrelations(sleepData: any[], activityData: any[]): { sleep_training: number; stress_recovery: number } {
  if (sleepData.length < 7 || activityData.length < 7) {
    return { sleep_training: 0, stress_recovery: 0 };
  }
  
  // Calculate sleep-training correlation
  const sleepTrainingCorr = calculateCorrelation(
    sleepData.map(s => s.sleep_efficiency || 0),
    sleepData.map(s => {
      // Find activities on same day as sleep
      const sleepDate = s.date;
      const dayActivities = activityData.filter(a => 
        a.start_time.split('T')[0] === sleepDate
      );
      return dayActivities.reduce((sum, a) => sum + (a.tss_estimated || 0), 0);
    })
  );
  
  // Calculate stress-recovery correlation (HRV vs RHR)
  const hrvValues = sleepData.map(s => s.hrv_avg || 0).filter(h => h > 0);
  const rhrValues = sleepData.map(s => s.resting_heart_rate || 0).filter(r => r > 0);
  
  const stressRecoveryCorr = hrvValues.length && rhrValues.length 
    ? calculateCorrelation(hrvValues, rhrValues.map(r => -r)) // Negative RHR for correlation
    : 0;
  
  return { 
    sleep_training: Math.round(sleepTrainingCorr * 100) / 100,
    stress_recovery: Math.round(stressRecoveryCorr * 100) / 100
  };
}

function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function identifyLifestylePatterns(sleepData: any[], activityData: any[]): string[] {
  const patterns: string[] = [];
  
  if (sleepData.length >= 7) {
    // Analyze bedtime consistency
    const bedtimes = sleepData
      .filter(s => s.bedtime_start)
      .map(s => {
        const bedtime = new Date(s.bedtime_start);
        return bedtime.getHours() + bedtime.getMinutes() / 60;
      });
    
    if (bedtimes.length >= 5) {
      const bedtimeVariance = calculateConsistencyScore(bedtimes);
      if (bedtimeVariance > 80) patterns.push("Consistent bedtime routine");
      else if (bedtimeVariance < 60) patterns.push("Variable sleep schedule");
    }
    
    // Analyze weekend vs weekday sleep
    const weekdaySleep = sleepData.filter(s => {
      const day = new Date(s.date).getDay();
      return day >= 1 && day <= 5;
    });
    const weekendSleep = sleepData.filter(s => {
      const day = new Date(s.date).getDay();
      return day === 0 || day === 6;
    });
    
    if (weekdaySleep.length && weekendSleep.length) {
      const weekdayAvg = weekdaySleep.reduce((sum, s) => sum + (s.total_sleep_minutes || 0), 0) / weekdaySleep.length;
      const weekendAvg = weekendSleep.reduce((sum, s) => sum + (s.total_sleep_minutes || 0), 0) / weekendSleep.length;
      
      if (weekendAvg > weekdayAvg + 60) patterns.push("Weekend sleep catch-up pattern");
    }
  }
  
  if (activityData.length >= 7) {
    // Morning vs evening exercise preference
    const morningWorkouts = activityData.filter(a => {
      const hour = new Date(a.start_time).getHours();
      return hour >= 5 && hour < 12;
    });
    const eveningWorkouts = activityData.filter(a => {
      const hour = new Date(a.start_time).getHours();
      return hour >= 17 && hour < 22;
    });
    
    if (morningWorkouts.length > eveningWorkouts.length * 1.5) {
      patterns.push("Morning exercise preference");
    } else if (eveningWorkouts.length > morningWorkouts.length * 1.5) {
      patterns.push("Evening exercise preference");
    }
    
    // Workout consistency
    const daysWithWorkouts = new Set(
      activityData.map(a => a.start_time.split('T')[0])
    ).size;
    const totalDays = Math.ceil((new Date().getTime() - new Date(activityData[activityData.length - 1].start_time).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysWithWorkouts / totalDays > 0.5) {
      patterns.push("High exercise consistency");
    }
  }
  
  return patterns.length ? patterns : ["Developing routine"];
}

function analyzeEnergyPattern(sleepData: any[], activityData: any[]): "consistent" | "variable" | "declining" {
  // Analyze energy patterns based on sleep quality and activity performance
  const sleepScores = sleepData.map(s => s.readiness_score || 0).filter(r => r > 0);
  
  if (sleepScores.length < 2) return "consistent";
  
  const trend = calculateTrend(sleepScores);
  const variance = calculateConsistencyScore(sleepScores);
  
  if (trend < -10) return "declining";
  if (variance < 70) return "variable";
  return "consistent";
}