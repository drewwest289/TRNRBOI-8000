import { useState, useMemo } from 'react';

// localStorage keys — shared with plan.js so getPlanStart() reads the same values.
export const LS_START = 'trnr_startDate'; // YYYY-MM-DD
export const LS_RACE  = 'trnr_raceDate';  // YYYY-MM-DD

function readStored(key) {
  const s = localStorage.getItem(key);
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : s;
}

export function useTrainingPlan() {
  const [startStr, setStartStr] = useState(() => readStored(LS_START));
  const [raceStr,  setRaceStr]  = useState(() => readStored(LS_RACE));

  function saveStart(str) {
    if (str) { localStorage.setItem(LS_START, str); }
    else     { localStorage.removeItem(LS_START); }
    setStartStr(str || null);
  }

  function saveRace(str) {
    if (str) { localStorage.setItem(LS_RACE, str); }
    else     { localStorage.removeItem(LS_RACE); }
    setRaceStr(str || null);
  }

  // currentWeek: null when no start date is configured, otherwise 1–16 clamped.
  const currentWeek = useMemo(() => {
    if (!startStr) return null;
    const start = new Date(startStr + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.floor((today - start) / 86_400_000);
    return Math.min(16, Math.max(1, Math.floor(days / 7) + 1));
  }, [startStr]);

  // daysUntilRace: null when no start date is configured.
  const daysUntilRace = useMemo(() => {
    let raceDate;
    if (raceStr) {
      raceDate = new Date(raceStr + 'T00:00:00');
    } else if (startStr) {
      raceDate = new Date(new Date(startStr + 'T00:00:00').getTime() + 16 * 7 * 86_400_000);
    } else {
      return null;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((raceDate - today) / 86_400_000);
  }, [startStr, raceStr]);

  return { startStr, raceStr, currentWeek, daysUntilRace, saveStart, saveRace };
}
