-- Phase 11: comments on runs.
--
-- run_id matches the unified `id` field already produced by the merged
-- /api/activities endpoint: either the raw Strava activity id, or
-- "local-{activity_overrides.id}" for manual-only entries. It is left as
-- plain text (not a typed FK) since it points at two different source
-- tables depending on prefix; the server deletes matching rows by hand
-- when a manual entry is removed (see /api/activities/manual/:id DELETE).

create table run_comments (
  id          bigserial primary key,
  run_id      text not null,
  author_id   uuid not null references users(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index run_comments_run_id_idx on run_comments (run_id);

-- Same default-deny RLS posture as the rest of the app (see
-- supabase_phase10_enable_rls.sql) — service role on the backend bypasses
-- this entirely; there is no direct client access.
alter table run_comments enable row level security;
