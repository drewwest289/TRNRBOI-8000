// Shared run-type vocabulary and per-run type override storage.
//
// Users can reclassify a run's type from the History list (e.g. "this Strava
// activity was actually a recovery walk — mark it Rest"). Overrides are kept
// in localStorage and looked up by Strava activity id when the run has one,
// so the same edit applies everywhere that activity appears — the History
// list/charts and the Dashboard's activity breakdown/averages alike.

export const TYPE_OPTIONS = [
  'Easy', 'Moderate', 'Hard', 'Long run', 'Race', 'Tempo', 'Intervals', 'Cross-train', 'Rest',
];

const LS_KEY = 'trnr_type_overrides';

export function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

export function overrideKey(run) {
  return run.strava_id ?? run.stravaId ?? run.id;
}

export function saveOverride(run, type) {
  const overrides = loadOverrides();
  overrides[overrideKey(run)] = type;
  localStorage.setItem(LS_KEY, JSON.stringify(overrides));
}

export function resolvedType(run, overrides) {
  return overrides[overrideKey(run)] ?? (run.type || 'Easy');
}
