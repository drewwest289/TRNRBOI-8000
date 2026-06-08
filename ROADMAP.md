# TRNR — Feature Roadmap


Status key: [ ] todo · [~] in-progress · [x] done · [!] blocked
Work items top-to-bottom within each phase unless otherwise directed.


Phase 1 — Polish & Fixes (Quick wins, frontend-only)

[ ] the log tab seems unnecessary. I think we can remove it entirely. move the log a run function to the history tab.
[ ] On the history tab, discrepency or lack of clarity between strava all time data and the summarized total runs total miles information.


Phase 2 — Richer Strava Data

 Audit available Strava endpoints — Review the full Strava API surface and document which endpoints are currently used vs. available. Identify high-value unused data (segments, splits, cadence, elevation, stream data).
 Per-activity detail view — Build a drill-down view for individual activities surfacing richer stream data: splits, elevation profile, cadence, heart rate over time.
 Surface additional data on dashboard — Based on audit findings, add the most valuable unused data points to existing views. investigate how run type is assigned by Strava, seems like many runs are coming in as easy when the effort level should be higher.


