# TRNR — Feature Roadmap

## Near term

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
