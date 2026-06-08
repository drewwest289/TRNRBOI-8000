# TRNR — Feature Roadmap

## Near term

### Explore all available Strava data
Audit all available Strava API endpoints and surface more data throughout the app.
- Segments, splits, cadence, elevation, 
- Per-activity detail views with richer stream data
- Identify any data currently unused that would be valuable to display


### Added by Drew
Small things I have noticed.
- tempo on the activity breakdown on the dashboard is purple instead of red. Make it match the other color.
- clarify what pace by workout type is on pace tab. Right now not sure if it is an average or what.
- personal records on pace tab do not match those on the dashboard.
- Recent runs list is probably unnessesary on the pase tab.
- change the Pace tab name to Stats
- this is probably bigger, but I need an admin side of things now that I have more people connected. I created a test account that I want to remove now. And would like the ability to remove users if I want to.
- colors for the pace trend dont match. I think it would be good to have 

Status key: [ ] todo · [~] in-progress · [x] done · [!] blocked
Work items top-to-bottom within each phase unless otherwise directed.


Phase 1 — Polish & Fixes (Quick wins, frontend-only)

 [ ] Tempo color fix — Tempo is showing purple in the activity breakdown on the dashboard. It should match the correct workout-type color (red). Check the color mapping object and align it with the rest of the chart.
     Note: TYPE_COLOR already maps 'Tempo' → red and the OneTruth merge now resolves every activity's type through one shared classifier, so this may already be fixed as a side effect — needs a visual recheck against live Strava data, not a code change.
 [x] Pace tab: clarify "Pace by Workout Type" — Added a "Average pace across logged runs of each type" subtitle under the section label.
 [x] Pace tab: investigate PR mismatch — Confirmed it was a real data bug: Dashboard and Pace tab used two different PR algorithms (different distance-match windows and time calculations). Extracted a shared `prCandidates` helper into lib/pace.js and pointed both tabs at it, so they now agree.
 [x] Pace tab: remove Recent Runs list — Removed the section and its now-unused helpers (TYPE_GLYPH_MAP, chipClass/PixelIcon imports).
 [x] Rename "Pace" tab to "Stats" — Updated the nav label (kept the internal `pace` id/route to avoid touching routing).
 [ ] Pace trend colors — description was incomplete ("I think it would be good to have "), so left untouched. The chart currently uses green for pace / red for HR, which matches brand tokens — clarify what specifically looks wrong before changing it.


Phase 2 — Admin & User Management (Requires backend work on Render)

 [x] Admin panel — protected route — Built as a hidden hash route (`#admin`, see src/App.jsx useIsAdminRoute) rather than a literal /admin path — there's no SPA-fallback (_redirects) configured for the Cloudflare Pages + custom-worker setup, and a hash never reaches the server, so this needed no routing/infra changes. Gated server-side by a new `is_admin` column on `users` (see supabase_phase9_admin.sql) carried through the JWT — not exposed in nav.
 [x] Admin panel — user list — src/components/AdminPanel.jsx calls GET /api/admin/users; shows name, avatar, Strava ID, join date, and "last active" (derived from strava_tokens.expires_at minus the ~6h Strava token TTL — the closest signal available, since the app fetches activities live rather than running a tracked sync job).
 [x] Admin panel — remove user — DELETE /api/admin/users/:id on the Render backend (server/index.js) wipes strava_tokens, activity_overrides, plan_settings, plan_overrides, runs, then the users row. Confirm dialog + self-delete guard in the UI.
 [ ] Remove test account — BLOCKED on you: run supabase_phase9_admin.sql, then `update users set is_admin = true where strava_id = <your strava id>`, redeploy the Render service, and open #admin to remove the test account.

 Setup needed before this works in prod:
   1. Run supabase_phase9_admin.sql in the Supabase SQL editor (adds `is_admin` column).
   2. Run the `update users set is_admin = true where strava_id = ...` statement for your own account (find your ID at strava.com/settings, or in your profile URL).
   3. Redeploy the Render service so the new /api/admin/* routes go live.
   4. Visit the app and navigate to #admin (e.g. .../trnrboi8000/#admin) while signed in as yourself.


Phase 3 — Richer Strava Data

 Audit available Strava endpoints — Review the full Strava API surface and document which endpoints are currently used vs. available. Identify high-value unused data (segments, splits, cadence, elevation, stream data).
 Per-activity detail view — Build a drill-down view for individual activities surfacing richer stream data: splits, elevation profile, cadence, heart rate over time.
 Surface additional data on dashboard — Based on audit findings, add the most valuable unused data points to existing views.


Backlog / Notes

Admin panel assumes the Render backend has a concept of "users" stored server-side. Verify this before building the frontend — if tokens are only stored client-side today, backend work is required first.
Pace trend color note was incomplete at time of writing — revisit before implementing Phase 1 color fix.