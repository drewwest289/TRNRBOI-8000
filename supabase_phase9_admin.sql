-- Phase 9: admin flag for the owner account
-- Run this in the Supabase SQL editor.

alter table users add column if not exists is_admin boolean not null default false;

-- One-time: grant yourself admin access. Replace the strava_id below with your
-- own Strava athlete ID (visible in your Strava profile URL, e.g.
-- strava.com/athletes/12345678 → 12345678), then run this statement.
-- update users set is_admin = true where strava_id = 00000000;
