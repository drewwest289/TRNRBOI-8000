import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { getDateForCell } from '../lib/plan';

// Shared cache so multiple components share one fetch.
let _cache = null;
let _listeners = [];

function notify(runs) {
  _cache = runs;
  _listeners.forEach(fn => fn(runs));
}

function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function fetchRuns() {
  apiFetch('/api/runs').then(notify).catch(err => console.error('[useRuns] fetch failed:', err.message));
}

export function useRuns() {
  const [runs, setRuns] = useState(_cache ?? []);

  useEffect(() => {
    const unsub = subscribe(setRuns);
    if (_cache === null) fetchRuns();
    else setRuns(_cache);
    return unsub;
  }, []);

  return runs;
}

export function useWeekRuns(week) {
  const runs = useRuns();
  const dates = new Set(Array.from({ length: 7 }, (_, i) => getDateForCell(week, i)));
  return runs.filter(r => dates.has(r.date));
}

export async function addRun(run) {
  const { id } = await apiFetch('/api/runs', {
    method: 'POST',
    body: JSON.stringify(run),
  });
  notify([{ ...run, id }, ...(_cache ?? [])]);
  return id;
}

export async function deleteRun(id) {
  await apiFetch(`/api/runs/${id}`, { method: 'DELETE' });
  notify((_cache ?? []).filter(r => r.id !== id));
}
