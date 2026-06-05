import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

// Shared cache so WeekGrid and PlanTab share one fetch.
let _cache = null;
let _listeners = [];

function notify(map) {
  _cache = map;
  _listeners.forEach(fn => fn(map));
}

function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function fetchOverrides() {
  apiFetch('/api/plan/overrides')
    .then(rows => {
      const map = {};
      for (const r of rows) map[r.date] = r.day_str;
      notify(map);
    })
    .catch(() => {});
}

export function usePlanOverrides() {
  const [map, setMap] = useState(_cache ?? {});

  useEffect(() => {
    const unsub = subscribe(setMap);
    if (_cache === null) fetchOverrides();
    else setMap(_cache);
    return unsub;
  }, []);

  return map;
}

export async function setPlanOverride(date, day_str) {
  await apiFetch(`/api/plan/overrides/${date}`, {
    method: 'PUT',
    body: JSON.stringify({ day_str }),
  });
  notify({ ...(_cache ?? {}), [date]: day_str });
}

export async function deletePlanOverride(date) {
  await apiFetch(`/api/plan/overrides/${date}`, { method: 'DELETE' });
  const next = { ...(_cache ?? {}) };
  delete next[date];
  notify(next);
}
