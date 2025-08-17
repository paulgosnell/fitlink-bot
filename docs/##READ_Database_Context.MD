##Database Context

create table public.activities (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  date date not null,
  steps integer null default 0,
  calories integer null default 0,
  distance numeric(8, 2) null default 0,
  active_minutes integer null default 0,
  created_at timestamp with time zone null default now(),
  constraint activities_pkey primary key (id),
  constraint activities_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_activities_user_date on public.activities using btree (user_id, date desc) TABLESPACE pg_default;

create table public.activity_data (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  activity_type text null,
  distance numeric(10, 2) null,
  duration integer null,
  calories integer null,
  raw_data jsonb null,
  created_at timestamp with time zone null default now(),
  constraint activity_data_pkey primary key (id)
) TABLESPACE pg_default;

create table public.strava_activities (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  activity_id bigint not null,
  name character varying(500) null,
  distance numeric(10, 2) null,
  moving_time integer null,
  elapsed_time integer null,
  total_elevation_gain numeric(8, 2) null,
  activity_type character varying(100) null,
  start_date timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  constraint strava_activities_pkey primary key (id),
  constraint strava_activities_activity_id_key unique (activity_id),
  constraint strava_activities_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_strava_activities_user_date on public.strava_activities using btree (user_id, start_date desc) TABLESPACE pg_default;

create table public.briefings (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  content text not null,
  data_sources jsonb null,
  created_at timestamp with time zone null default now(),
  constraint briefings_pkey primary key (id),
  constraint briefings_user_id_date_key unique (user_id, date)
) TABLESPACE pg_default;

create table public.briefings (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  content text not null,
  data_sources jsonb null,
  created_at timestamp with time zone null default now(),
  constraint briefings_pkey primary key (id),
  constraint briefings_user_id_date_key unique (user_id, date)
) TABLESPACE pg_default;

create table public.oauth_tokens (
  id bigserial not null,
  user_id bigint null,
  provider text not null,
  access_token text not null,
  refresh_token text null,
  expires_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint oauth_tokens_pkey primary key (id),
  constraint oauth_tokens_user_id_provider_key unique (user_id, provider)
) TABLESPACE pg_default;

create table public.oura_sleep (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  date date not null,
  total_sleep_duration numeric(5, 2) null,
  deep_sleep_duration numeric(5, 2) null,
  rem_sleep_duration numeric(5, 2) null,
  light_sleep_duration numeric(5, 2) null,
  sleep_score integer null,
  created_at timestamp with time zone null default now(),
  constraint oura_sleep_pkey primary key (id),
  constraint oura_sleep_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_oura_sleep_user_date on public.oura_sleep using btree (user_id, date desc) TABLESPACE pg_default;

create table public.briefings (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  content text not null,
  data_sources jsonb null,
  created_at timestamp with time zone null default now(),
  constraint briefings_pkey primary key (id),
  constraint briefings_user_id_date_key unique (user_id, date)
) TABLESPACE pg_default;

create table public.env_daily (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  city text not null,
  temp_min_c numeric(4, 1) null,
  temp_max_c numeric(4, 1) null,
  humidity_percent integer null,
  wind_kph numeric(5, 2) null,
  precipitation_mm numeric(6, 2) null,
  air_quality_index integer null,
  sunrise_time time without time zone null,
  sunset_time time without time zone null,
  weather_description text null,
  best_exercise_windows jsonb null,
  raw_data jsonb null,
  created_at timestamp with time zone null default now(),
  constraint env_daily_pkey primary key (id),
  constraint env_daily_user_id_date_key unique (user_id, date),
  constraint env_daily_humidity_percent_check check (
    (
      (humidity_percent >= 0)
      and (humidity_percent <= 100)
    )
  )
) TABLESPACE pg_default;

create table public.oauth_tokens (
  id bigserial not null,
  user_id bigint null,
  provider text not null,
  access_token text not null,
  refresh_token text null,
  expires_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint oauth_tokens_pkey primary key (id),
  constraint oauth_tokens_user_id_provider_key unique (user_id, provider)
) TABLESPACE pg_default;

create table public.oura_sleep (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  date date not null,
  total_sleep_duration numeric(5, 2) null,
  deep_sleep_duration numeric(5, 2) null,
  rem_sleep_duration numeric(5, 2) null,
  light_sleep_duration numeric(5, 2) null,
  sleep_score integer null,
  created_at timestamp with time zone null default now(),
  constraint oura_sleep_pkey primary key (id),
  constraint oura_sleep_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_oura_sleep_user_date on public.oura_sleep using btree (user_id, date desc) TABLESPACE pg_default;

create table public.providers (
  id bigserial not null,
  provider public.provider_type not null,
  access_token text not null,
  refresh_token text null,
  expires_at timestamp with time zone null,
  provider_user_id text null,
  scopes text[] null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  user_id uuid null,
  constraint providers_pkey primary key (id),
  constraint providers_user_id_provider_key unique (user_id, provider),
  constraint providers_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.sleep_data (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  bedtime_start timestamp with time zone null,
  bedtime_end timestamp with time zone null,
  duration integer null,
  efficiency numeric(5, 2) null,
  score integer null,
  raw_data jsonb null,
  created_at timestamp with time zone null default now(),
  constraint sleep_data_pkey primary key (id),
  constraint sleep_data_user_id_date_key unique (user_id, date)
) TABLESPACE pg_default;

create table public.strava_activities (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  activity_id bigint not null,
  name character varying(500) null,
  distance numeric(10, 2) null,
  moving_time integer null,
  elapsed_time integer null,
  total_elevation_gain numeric(8, 2) null,
  activity_type character varying(100) null,
  start_date timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  constraint strava_activities_pkey primary key (id),
  constraint strava_activities_activity_id_key unique (activity_id),
  constraint strava_activities_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_strava_activities_user_date on public.strava_activities using btree (user_id, start_date desc) TABLESPACE pg_default;

create table public.users (
  id uuid not null default extensions.uuid_generate_v4 (),
  telegram_id bigint not null,
  username character varying(255) null,
  first_name character varying(255) null,
  last_name character varying(255) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  timezone text null default 'UTC'::text,
  city text null,
  briefing_hour integer null default 7,
  training_goal text null default 'general_fitness'::text,
  is_active boolean null default true,
  paused_until date null,
  constraint users_pkey primary key (id),
  constraint users_telegram_id_key unique (telegram_id),
  constraint users_briefing_hour_check check (
    (
      (briefing_hour >= 0)
      and (briefing_hour <= 23)
    )
  )
) TABLESPACE pg_default;

create table public.weather_data (
  id bigserial not null,
  user_id bigint null,
  date date not null,
  location text null,
  temperature numeric(5, 2) null,
  condition text null,
  humidity integer null,
  wind_speed numeric(5, 2) null,
  raw_data jsonb null,
  created_at timestamp with time zone null default now(),
  constraint weather_data_pkey primary key (id),
  constraint weather_data_user_id_date_key unique (user_id, date)
) TABLESPACE pg_default;