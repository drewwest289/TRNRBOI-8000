-- Phase 4: per-user data tables
-- Run this in the Supabase SQL editor.

create table if not exists plan_settings (
  user_id    uuid primary key references users(id) on delete cascade,
  start_date date,
  race_date  date,
  updated_at timestamptz default now()
);

create table if not exists plan_overrides (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  day_str    text not null,
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create table if not exists runs (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  date       date not null,
  dist       numeric(6,2) not null,
  dur        integer not null,       -- minutes
  type       text not null default 'Easy',
  notes      text,
  strava_id  bigint,
  created_at timestamptz default now()
);

create index if not exists runs_user_date on runs (user_id, date desc);
create index if not exists plan_overrides_user on plan_overrides (user_id);
