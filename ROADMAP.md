# TRNR — Feature Roadmap

## Near term

### Consolidate activity tracking onto the Strava API
Remove the duplicate activity-tracking system. The app currently maintains two parallel sources of truth: a manual `runs` table (populated via the "Log a run" form and a manual Strava-import flow in `StravaCards`) and live Strava API pulls (used directly by the Dashboard and Pace tabs). This is why the homepage activity breakdown can disagree with the Log/History views — it reads fresh from Strava while edits land only in the `runs` table.
- Make Strava the single source of truth for actual activity data; auto-sync activities server-side instead of requiring a manual "import" step in `StravaCards`
- Remove (or significantly shrink) the manual "Log a run" form — keep it only for genuinely non-Strava entries (e.g. cross-training not tracked on Strava), if needed at all
- Repoint `LogTab`, `HistoryTab`, `WeekGrid`/`PlanTab` completion stats, and the Dashboard activity breakdown to read from the same merged dataset so they can never disagree
- Keep a thin local-overrides table for things Strava can't represent (notes, rest days, manual edits/corrections) rather than a full duplicate `runs` record per activity
- Migrate/reconcile existing manually-logged and imported `runs` rows so no history is lost
- Audit `strava_id` matching/dedupe logic (`checkDupe` in `StravaCards.jsx`) — much of it becomes unnecessary once import is replaced by sync

### Strava all-time dashboard
Populate the existing dashboard tab with lifetime stats, personal records, and activity breakdowns pulled from the Strava API.
- Use `GET /api/strava/athlete` for profile and lifetime totals
- Use `GET /api/strava/activities` for aggregated breakdowns
- Display total runs, total miles, avg pace, best efforts/PRs

### Explore all available Strava data
Audit all available Strava API endpoints and surface more data throughout the app.
- Segments, splits, cadence, elevation, gear
- Per-activity detail views with richer stream data
- Identify any data currently unused that would be valuable to display

### Skip day + schedule adjust
Allow the user to mark a scheduled run as skipped and have the training plan automatically adjust.
- Add a "skip" action to each day on the Plan tab
- When skipped, redistribute the missed workout later in the schedule
- Account for taper weeks and race day proximity when rescheduling
- More clarity between goal and actual result on cards

## Longer term

### Multi-user support
Open the app beyond a single user so others can use TRNR with their own Strava accounts.
- User authentication (login/signup)
- Per-user data isolation
- Individual Strava OAuth flow per user
- Persistent token storage per user (currently tokens are single-user, stored via Render env vars)
- Consider moving off free Render tier to support persistent storage at scale
