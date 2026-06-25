# TRNR — Feature Roadmap


Status key: [ ] todo · [~] in-progress · [x] done · [!] blocked
Work items top-to-bottom within each phase unless otherwise directed.


Phase 1 — Polish & Fixes (Quick wins, frontend-only)

[x] the log tab seems unnecessary. I think we can remove it entirely. move the log a run function to the history tab. — Removed LogTab.jsx and the nav entry; the "Log a run" form (and delete for manual entries) now lives at the top of History's run list, right above "All runs".
[x] On the history tab, discrepency or lack of clarity between strava all time data and the summarized total runs total miles information. — It was a real "lack of clarity": the Strava card shows lifetime run totals from Strava's own records (your whole history there), while the cards below it are totals for what's actually logged in this app (synced + manual entries, including cross-training) — two genuinely different scopes that happened to share near-identical labels ("Total runs"/"Total miles" in both places, and on the Dashboard too). Renamed the app's own cards to "Logged runs"/"Logged miles" and added a one-line caption under each block explaining what it covers, so the difference reads as expected rather than as a bug.


Phase 2 — Richer Strava Data

 Audit available Strava endpoints — Review the full Strava API surface and document which endpoints are currently used vs. available. Identify high-value unused data (segments, splits, cadence, elevation, stream data).
 Per-activity detail view — Build a drill-down view for individual activities surfacing richer stream data: splits, elevation profile, cadence, heart rate over time.
 Surface additional data on dashboard — Based on audit findings, add the most valuable unused data points to existing views. investigate how run type is assigned by Strava, seems like many runs are coming in as easy when the effort level should be higher.


[x] there is no run information for Aaron Wallace, despite the fact that I belive he has connected his strava and i know he has runs. Let me know why. — Root cause: the Team leaderboard read from the old `runs` Supabase table (pre-OneTruth migration). Users who joined after the migration — Aaron included — have their data only in Strava's live API, never in `runs`. Fixed: the leaderboard endpoint now fetches Strava activities for all users server-side in parallel (last 90 days, using each user's stored token) and merges manual entries from `activity_overrides`. The old `runs` table is no longer consulted for Team stats.


Phase 3 — Social

 Comments on runs — Let teammates leave comments on each other's runs (e.g. on the History tab and/or Team view). Needs a new Supabase table for comments tied to a run, plus UI for viewing/adding/deleting comments.