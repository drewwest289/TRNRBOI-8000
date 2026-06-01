import { useState, useMemo } from 'react';

// localStorage keys — shared with plan.js so getPlanStart() reads the same values.
export const LS_START = 'trnr_startDate'; // YYYY-MM-DD
export const LS_RACE  = 'trnr_raceDate';  // YYYY-MM-DD

function readStored(key) {
  const s = localStorage.getItem(key);
  if (!s) return null;
  // Validate the string parses to a real date.
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : s;
}

/**
 * Parse a YYYY-MM-DD string using LOCAL date constructors (new Date(y, m-1, d))
 * so there is no UTC-midnight-to-local-previous-day shift for users in timezones
 * behind UTC, and no DST-at-midnight edge case.
 */
function parseLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Count the number of calendar days between two Date objects using Date.UTC so
 * DST transitions (where one local "day" is 23 h) don't cause off-by-one errors.
 */
function calendarDaysBetween(earlier, later) {
  const msPerDay = 86_400_000;
  const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = Date.UTC(later.getFullYear(),   later.getMonth(),   later.getDate());
  return Math.round((b - a) / msPerDay); // Math.round absorbs any floating-point dust
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

  /**
   * currentWeek: null when no start date is configured, otherwise 1–16 clamped.
   *
   * The plan week starts on Sunday (column 0 = 'rest' day).  We snap the stored
   * start date to the previous-or-same Sunday — the same anchor getPlanStart()
   * uses — so the week number here stays in sync with the grid dates.
   */
  const currentWeek = useMemo(() => {
    if (!startStr) return null;
    const raw = parseLocal(startStr);
    // Snap to the Sunday of the week containing the stored start date.
    const sunday = new Date(raw);
    sunday.setDate(raw.getDate() - raw.getDay());

    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const days = calendarDaysBetween(sunday, todayMidnight);
    return Math.min(16, Math.max(1, Math.floor(days / 7) + 1));
  }, [startStr]);

  /**
   * daysUntilRace: null when no start date is configured.
   * Uses the explicit race date if set; otherwise derives it as startSunday + 16 weeks.
   */
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
