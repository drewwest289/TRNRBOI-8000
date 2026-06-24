-- Enable RLS on tables that were missing it, closing the
-- rls_disabled_in_public and sensitive_columns_exposed security advisor alerts.
--
-- No policies are added, matching the existing pattern already in place on
-- runs / plan_overrides / training_plans: RLS-enabled + zero policies means
-- the anon and authenticated roles get default-deny (no select/insert/update/delete),
-- while the backend (server/index.js, using SUPABASE_SERVICE_ROLE_KEY) is
-- unaffected because the service role bypasses RLS entirely.
--
-- This app has no Supabase Auth session on the client (auth is a custom JWT
-- verified server-side), so there is no auth.uid() to scope per-user policies
-- against on the anon/authenticated side — the correct model here is that the
-- public API has no direct access at all, full stop.

alter table public.activity_overrides enable row level security;
alter table public.plan_settings enable row level security;
alter table public.strava_tokens enable row level security;
alter table public.users enable row level security;
