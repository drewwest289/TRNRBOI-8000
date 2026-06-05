import { useState, useMemo, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

// localStorage keys kept as a fast local cache so the plan is usable before
// the API response arrives (avoids a blank flash on load).
export const LS_START = 'trnr_startDate';
export const LS_RACE  = 'trnr_raceDate';

function readStored(key) {
  const s = localStorage.getItem(key);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : s;
}

function parseLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function calendarDaysBetween(earlier, later) {
  const msPerDay = 86_400_000;
  const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = Date.UTC(later.getFullYear(),   later.getMonth(),   later.getDate());
  return Math.round((b - a) / msPerDay);
}

export function useTrainingPlan() {
  const [startStr, setStartStr] = useState(() => readStored(LS_START));
  const [raceStr,  setRaceStr]  = useState(() => readStored(LS_RACE));

  // Hydrate from backend on mount — overwrites stale localStorage cache.
  useEffect(() => {
    apiFetch('/api/plan/settings')
      .then(({ start_date, race_date }) => {
        if (start_date) { localStorage.setItem(LS_START, start_date); setStartStr(start_date); }
        if (race_date)  { localStorage.setItem(LS_RACE,  race_date);  setRaceStr(race_date);  }
      })
      .catch(() => {});
  }, []);

  const saveStart = useCallback(async (str) => {
    if (str) { localStorage.setItem(LS_START, str); }
    else     { localStorage.removeItem(LS_START); }
    setStartStr(str || null);
    await apiFetch('/api/plan/settings', {
      method: 'PUT',
      body: JSON.stringify({ start_date: str || null, race_date: raceStr }),
    }).catch(() => {});
  }, [raceStr]);

  const saveRace = useCallback(async (str) => {
    if (str) { localStorage.setItem(LS_RACE, str); }
    else     { localStorage.removeItem(LS_RACE); }
    setRaceStr(str || null);
    await apiFetch('/api/plan/settings', {
      method: 'PUT',
      body: JSON.stringify({ start_date: startStr, race_date: str || null }),
    }).catch(() => {});
  }, [startStr]);

  const currentWeek = useMemo(() => {
    if (!startStr) return null;
    const raw = parseLocal(startStr);
    const sunday = new Date(raw);
    sunday.setDate(raw.getDate() - raw.getDay());
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = calendarDaysBetween(sunday, todayMidnight);
    return Math.min(16, Math.max(1, Math.floor(days / 7) + 1));
  }, [startStr]);

  const daysUntilRace = useMemo(() => {
    let raceDate;
    if (raceStr) {
      raceDate = parseLocal(raceStr);
    } else if (startStr) {
      const raw = parseLocal(startStr);
      const sunday = new Date(raw);
      sunday.setDate(raw.getDate() - raw.getDay());
      raceDate = new Date(sunday);
      raceDate.setDate(sunday.getDate() + 16 * 7);
    } else {
      return null;
    }
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return calendarDaysBetween(todayMidnight, raceDate);
  }, [startStr, raceStr]);

  return { startStr, raceStr, currentWeek, daysUntilRace, saveStart, saveRace };
}
