import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { getDateForCell } from '../lib/plan';

// The full set of types a user can assign via an override — superset of what
// the server-side classifier produces, since users can correct to values it
// never infers on its own (Moderate, Hard, Race, Rest).
export const TYPE_OPTIONS = [
  'Easy', 'Moderate', 'Hard', 'Long run', 'Race', 'Tempo', 'Intervals', 'Cross-train', 'Rest',
];

// Shared cache so multiple tabs share one fetch of the merged
// Strava + local-overrides feed (mirrors the useRuns pattern).
let _cache = null;
let _listeners = [];

function notify(activities) {
  _cache = activities;
  _listeners.forEach(fn => fn(activities));
}

function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function fetchActivities() {
  return apiFetch('/api/activities')
    .then(notify)
    .catch(err => console.error('[useActivities] fetch failed:', err.message));
}

export function useActivities() {
  const [activities, setActivities] = useState(_cache ?? []);

  useEffect(() => {
    const unsub = subscribe(setActivities);
    if (_cache === null) fetchActivities();
    else setActivities(_cache);
    return unsub;
  }, []);

  return activities;
}

export function useWeekActivities(week) {
  const activities = useActivities();
  const dates = new Set(Array.from({ length: 7 }, (_, i) => getDateForCell(week, i)));
  return activities.filter(a => dates.has(a.date));
}

// Mutations re-fetch the merged feed afterward — the resolved shape (type,
// classification, source) is computed server-side and can't be constructed
// correctly client-side for an optimistic update.

export async function addManualActivity(entry) {
  await apiFetch('/api/activities/manual', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
  await fetchActivities();
}

// Manual entries carry a `local-<id>` prefix in the merged feed (so they
// can't collide with Strava's numeric ids in the same list) — strip it back
// off before hitting the server, which only knows the bare override row id.
const rawOverrideId = id => String(id).replace(/^local-/, '');

export async function updateManualActivity(id, fields) {
  await apiFetch(`/api/activities/manual/${rawOverrideId(id)}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  await fetchActivities();
}

export async function deleteManualActivity(id) {
  await apiFetch(`/api/activities/manual/${rawOverrideId(id)}`, { method: 'DELETE' });
  await fetchActivities();
}

export async function setActivityOverride(stravaId, fields) {
  await apiFetch(`/api/activities/${stravaId}/override`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  await fetchActivities();
}
