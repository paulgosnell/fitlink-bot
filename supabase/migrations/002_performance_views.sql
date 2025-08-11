-- Performance views for fast briefing generation

-- Weekly training load view
CREATE VIEW weekly_load_view AS
WITH weekly_activities AS (
    SELECT 
        user_id,
        DATE_TRUNC('week', start_time) as week_start,
        COUNT(*) as session_count,
        SUM(duration_seconds) as total_duration_seconds,
        SUM(distance_meters) as total_distance_meters,
        SUM(COALESCE(tss_estimated, 0)) as total_tss,
        AVG(CASE WHEN average_heart_rate IS NOT NULL THEN average_heart_rate END) as avg_hr,
        MAX(start_time) as last_activity_date
    FROM activities 
    WHERE start_time >= CURRENT_DATE - INTERVAL '8 weeks'
    GROUP BY user_id, DATE_TRUNC('week', start_time)
),
current_week AS (
    SELECT 
        user_id,
        session_count as current_week_sessions,
        total_duration_seconds as current_week_duration,
        total_distance_meters as current_week_distance,
        total_tss as current_week_tss,
        last_activity_date
    FROM weekly_activities 
    WHERE week_start = DATE_TRUNC('week', CURRENT_DATE)
),
previous_weeks AS (
    SELECT 
        user_id,
        AVG(session_count) as avg_weekly_sessions,
        AVG(total_duration_seconds) as avg_weekly_duration,
        AVG(total_tss) as avg_weekly_tss
    FROM weekly_activities 
    WHERE week_start BETWEEN DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '6 weeks' 
                         AND DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
    GROUP BY user_id
)
SELECT 
    u.id as user_id,
    COALESCE(cw.current_week_sessions, 0) as current_week_sessions,
    COALESCE(cw.current_week_duration, 0) as current_week_duration_seconds,
    COALESCE(cw.current_week_distance, 0) as current_week_distance_meters,
    COALESCE(cw.current_week_tss, 0) as current_week_tss,
    COALESCE(pw.avg_weekly_sessions, 0) as avg_weekly_sessions,
    COALESCE(pw.avg_weekly_duration, 0) as avg_weekly_duration_seconds,
    COALESCE(pw.avg_weekly_tss, 0) as avg_weekly_tss,
    cw.last_activity_date,
    CASE 
        WHEN pw.avg_weekly_tss > 0 THEN 
            ROUND((COALESCE(cw.current_week_tss, 0) / pw.avg_weekly_tss - 1) * 100, 1)
        ELSE 0 
    END as load_change_percent
FROM users u
LEFT JOIN current_week cw ON u.id = cw.user_id
LEFT JOIN previous_weeks pw ON u.id = pw.user_id
WHERE u.is_active = true;

-- Recent sleep trends view
CREATE VIEW sleep_recent_view AS
WITH daily_sleep AS (
    SELECT 
        user_id,
        date,
        total_sleep_minutes,
        sleep_efficiency,
        hrv_avg,
        resting_heart_rate,
        temperature_deviation,
        readiness_score,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as day_rank
    FROM oura_sleep 
    WHERE date >= CURRENT_DATE - INTERVAL '14 days'
),
recent_averages AS (
    SELECT 
        user_id,
        AVG(total_sleep_minutes) as avg_sleep_minutes,
        AVG(sleep_efficiency) as avg_sleep_efficiency,
        AVG(hrv_avg) as avg_hrv,
        AVG(resting_heart_rate) as avg_rhr,
        AVG(temperature_deviation) as avg_temp_dev,
        AVG(readiness_score) as avg_readiness
    FROM daily_sleep
    WHERE day_rank BETWEEN 2 AND 8  -- Days 2-8 (exclude yesterday for comparison)
    GROUP BY user_id
),
last_night AS (
    SELECT 
        user_id,
        total_sleep_minutes,
        sleep_efficiency,
        hrv_avg,
        resting_heart_rate,
        temperature_deviation,
        readiness_score,
        date as last_sleep_date
    FROM daily_sleep
    WHERE day_rank = 1
)
SELECT 
    u.id as user_id,
    ln.last_sleep_date,
    ln.total_sleep_minutes,
    ln.sleep_efficiency,
    ln.hrv_avg,
    ln.resting_heart_rate,
    ln.temperature_deviation,
    ln.readiness_score,
    ra.avg_sleep_minutes,
    ra.avg_sleep_efficiency,
    ra.avg_hrv,
    ra.avg_rhr,
    ra.avg_temp_dev,
    ra.avg_readiness,
    -- Trend indicators
    CASE 
        WHEN ln.hrv_avg IS NOT NULL AND ra.avg_hrv IS NOT NULL THEN
            CASE 
                WHEN ln.hrv_avg > ra.avg_hrv * 1.05 THEN 'up'
                WHEN ln.hrv_avg < ra.avg_hrv * 0.95 THEN 'down'
                ELSE 'stable'
            END
        ELSE NULL
    END as hrv_trend,
    CASE 
        WHEN ln.resting_heart_rate IS NOT NULL AND ra.avg_rhr IS NOT NULL THEN
            CASE 
                WHEN ln.resting_heart_rate > ra.avg_rhr + 2 THEN 'up'
                WHEN ln.resting_heart_rate < ra.avg_rhr - 2 THEN 'down'
                ELSE 'stable'
            END
        ELSE NULL
    END as rhr_trend,
    CASE 
        WHEN ln.readiness_score IS NOT NULL AND ra.avg_readiness IS NOT NULL THEN
            ln.readiness_score - ra.avg_readiness
        ELSE NULL
    END as readiness_change
FROM users u
LEFT JOIN last_night ln ON u.id = ln.user_id
LEFT JOIN recent_averages ra ON u.id = ra.user_id
WHERE u.is_active = true;

-- Today's weather and exercise windows
CREATE VIEW todays_conditions_view AS
SELECT 
    u.id as user_id,
    ed.date,
    ed.city,
    ed.temp_min_c,
    ed.temp_max_c,
    ed.humidity_percent,
    ed.wind_kph,
    ed.precipitation_mm,
    ed.air_quality_index,
    ed.sunrise_time,
    ed.sunset_time,
    ed.weather_description,
    ed.best_exercise_windows,
    CASE 
        WHEN ed.temp_max_c BETWEEN 10 AND 25 
         AND ed.wind_kph < 20 
         AND ed.precipitation_mm < 1 THEN 'excellent'
        WHEN ed.temp_max_c BETWEEN 5 AND 30 
         AND ed.wind_kph < 30 
         AND ed.precipitation_mm < 5 THEN 'good'
        WHEN ed.precipitation_mm > 10 OR ed.wind_kph > 40 THEN 'poor'
        ELSE 'fair'
    END as exercise_conditions
FROM users u
LEFT JOIN env_daily ed ON u.id = ed.user_id AND ed.date = CURRENT_DATE
WHERE u.is_active = true;
