-- Phase 8: one-time migration of existing `runs` rows into `activity_overrides`
-- Run this in the Supabase SQL editor AFTER supabase_phase7.sql, and BEFORE
-- the frontend is repointed at /api/activities — otherwise this history
-- (cross-training, rest days, type/notes corrections) would briefly disappear,
-- since /api/activities reads only live Strava + activity_overrides, not `runs`.

-- Strava-linked runs: carry the user's existing type/notes forward as overrides.
-- Facts (date/dist/dur) now come live from Strava, so only copy what Strava can't
-- represent. ON CONFLICT makes this block idempotent (safe to re-run).
insert into activity_overrides (user_id, strava_id, type, notes)
select user_id, strava_id, type, notes
from runs
where strava_id is not null
on conflict (user_id, strava_id) do update
  set type = excluded.type, notes = excluded.notes, updated_at = now();

-- Local-only runs (cross-training, rest days, manual entries with no Strava
-- counterpart). No natural unique key here — same as `runs` itself, which has
-- no dedupe for manual entries — so run this block exactly once.
insert into activity_overrides (user_id, strava_id, date, dist, dur, type, notes)
select user_id, null, date, dist, dur, type, notes
from runs
where strava_id is null;
