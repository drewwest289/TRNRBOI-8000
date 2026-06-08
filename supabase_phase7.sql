-- Phase 7: consolidate activity tracking onto the Strava API
-- Run this in the Supabase SQL editor.
--
-- Thin overrides table: holds only what Strava can't represent — user
-- type/notes corrections for a Strava activity (strava_id set), or
-- genuinely local-only entries with no Strava counterpart (strava_id null,
-- e.g. cross-training, rest-day markers — date/dist/dur/type required).

create table if not exists activity_overrides (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  strava_id   bigint,
  date        date,
  dist        numeric(6,2),
  dur         integer,        -- minutes
  type        text,
  notes       text,
  updated_at  timestamptz default now(),
  unique (user_id, strava_id)
);

create index if not exists activity_overrides_user on activity_overrides (user_id);
