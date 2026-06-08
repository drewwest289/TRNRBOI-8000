export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RUNNER_COLORS = [
  '#1D9E75', '#3C3489', '#185FA5', '#BA7517', '#A32D2D', '#0F6E56', '#3B6D11',
];

// ── Per-ability 16-week core plans ────────────────────────────────────────────
// Day order: Sun Mon Tue Wed Thu Fri Sat
// Format: "type miles" or "rest" / "cross"

const plan16_beginner = [
  { week: 1,  days: ['rest','easy 2','easy 2','rest','easy 2','long 3','cross'] },
  { week: 2,  days: ['rest','easy 2','easy 3','rest','easy 3','long 4','cross'] },
  { week: 3,  days: ['rest','easy 3','easy 3','rest','easy 3','long 5','cross'] },
  { week: 4,  days: ['rest','easy 2','easy 2','rest','easy 2','long 3','rest']  },
  { week: 5,  days: ['rest','easy 3','tempo 2','rest','easy 3','long 6','cross'] },
  { week: 6,  days: ['rest','easy 3','tempo 2','rest','easy 3','long 7','cross'] },
  { week: 7,  days: ['rest','easy 4','tempo 3','rest','easy 4','long 8','cross'] },
  { week: 8,  days: ['rest','easy 3','easy 3','rest','easy 3','long 5','rest']  },
  { week: 9,  days: ['rest','easy 4','interval 3','rest','easy 4','long 9','cross'] },
  { week: 10, days: ['rest','easy 4','tempo 3','rest','easy 4','long 10','cross'] },
  { week: 11, days: ['rest','easy 4','interval 4','rest','easy 4','long 11','cross'] },
  { week: 12, days: ['rest','easy 3','easy 3','rest','easy 3','long 7','rest']  },
  { week: 13, days: ['rest','easy 4','tempo 4','rest','easy 4','long 9','cross'] },
  { week: 14, days: ['rest','easy 4','interval 4','rest','easy 4','long 10','cross'] },
  { week: 15, days: ['rest','easy 3','tempo 2','rest','easy 3','long 7','cross'] },
  { week: 16, days: ['rest','easy 2','easy 2','rest','easy 2','race 13.1','rest'] },
];

const plan16_intermediate = [
  { week: 1,  days: ['rest','easy 3','easy 3','rest','easy 3','long 4','cross'] },
  { week: 2,  days: ['rest','easy 3','easy 3','rest','easy 4','long 5','cross'] },
  { week: 3,  days: ['rest','easy 4','tempo 3','rest','easy 4','long 6','cross'] },
  { week: 4,  days: ['rest','easy 3','easy 3','rest','easy 3','long 4','rest']  },
  { week: 5,  days: ['rest','easy 4','tempo 4','rest','easy 4','long 7','cross'] },
  { week: 6,  days: ['rest','easy 4','tempo 4','rest','easy 5','long 8','cross'] },
  { week: 7,  days: ['rest','easy 5','interval 4','rest','easy 5','long 9','cross'] },
  { week: 8,  days: ['rest','easy 4','easy 4','rest','easy 4','long 6','rest']  },
  { week: 9,  days: ['rest','easy 5','tempo 5','rest','easy 5','long 10','cross'] },
  { week: 10, days: ['rest','easy 5','tempo 5','rest','easy 6','long 11','cross'] },
  { week: 11, days: ['rest','easy 5','interval 5','rest','easy 5','long 12','cross'] },
  { week: 12, days: ['rest','easy 4','easy 4','rest','easy 4','long 8','rest']  },
  { week: 13, days: ['rest','easy 5','tempo 5','rest','easy 6','long 10','cross'] },
  { week: 14, days: ['rest','easy 5','interval 5','rest','easy 5','long 11','cross'] },
  { week: 15, days: ['rest','easy 4','tempo 3','rest','easy 3','long 8','cross'] },
  { week: 16, days: ['rest','easy 3','easy 2','rest','easy 2','race 13.1','rest'] },
];

const plan16_advanced = [
  { week: 1,  days: ['rest','easy 4','tempo 4','rest','easy 5','long 6','cross'] },
  { week: 2,  days: ['rest','easy 4','tempo 5','rest','easy 5','long 8','cross'] },
  { week: 3,  days: ['rest','easy 5','interval 5','rest','tempo 4','long 10','cross'] },
  { week: 4,  days: ['rest','easy 4','easy 4','rest','easy 4','long 6','rest']  },
  { week: 5,  days: ['rest','easy 5','interval 5','rest','tempo 5','long 12','cross'] },
  { week: 6,  days: ['rest','easy 5','interval 6','rest','tempo 5','long 13','cross'] },
  { week: 7,  days: ['rest','easy 6','interval 6','rest','tempo 5','long 14','cross'] },
  { week: 8,  days: ['rest','easy 5','tempo 4','rest','easy 5','long 8','rest']  },
  { week: 9,  days: ['rest','easy 6','interval 6','rest','tempo 6','long 15','cross'] },
  { week: 10, days: ['rest','easy 6','interval 7','rest','tempo 6','long 15','cross'] },
  { week: 11, days: ['rest','easy 6','interval 7','rest','tempo 6','long 15','cross'] },
  { week: 12, days: ['rest','easy 5','tempo 5','rest','easy 5','long 10','rest']  },
  { week: 13, days: ['rest','easy 6','interval 6','rest','tempo 6','long 13','cross'] },
  { week: 14, days: ['rest','easy 6','interval 6','rest','tempo 6','long 14','cross'] },
  { week: 15, days: ['rest','easy 5','tempo 4','rest','easy 4','long 10','cross'] },
  { week: 16, days: ['rest','easy 4','easy 3','rest','easy 2','race 13.1','rest'] },
];

// Keep the intermediate plan as the default export for backward compatibility.
export const plan16 = plan16_intermediate;

/** Return the 16-week core plan for the given ability level. */
export function getPlan(ability) {
  if (ability === 'beginner')  return plan16_beginner;
  if (ability === 'advanced')  return plan16_advanced;
  return plan16_intermediate;
}

/**
 * Get the plan week data for a given 1-based week number.
 *
 * When totalWeeks > 16, the leading (totalWeeks - 16) weeks are base-building
 * weeks that ramp up from ~55 % to ~85 % of the first core-plan week, then the
 * structured 16-week plan follows.
 */
export function getPlanWeek(weekNum, totalWeeks = 16, ability = 'intermediate') {
  const core = getPlan(ability);
  const baseWeeks = Math.max(0, totalWeeks - 16);

  if (weekNum <= baseWeeks) {
    return makeBaseWeek(weekNum, baseWeeks, core[0]);
  }

  const coreIdx = weekNum - baseWeeks - 1;
  return { ...core[Math.min(coreIdx, core.length - 1)], week: weekNum };
}

function makeBaseWeek(weekNum, totalBaseWeeks, week1) {
  const pct = totalBaseWeeks <= 1
    ? 0.70
    : 0.55 + (0.30 * (weekNum - 1) / (totalBaseWeeks - 1));

  return {
    week: weekNum,
    days: week1.days.map(d => {
      const parts = d.split(' ');
      const miles = parseFloat(parts[1]);
      if (!miles) return d;
      const scaled = Math.max(1, Math.round(miles * pct * 2) / 2);
      return `${parts[0]} ${scaled}`;
    }),
  };
}

// ── Utility functions ─────────────────────────────────────────────────────────

export function getMiles(week) {
  return week.days.reduce((s, d) => s + (parseFloat(d.split(' ')[1]) || 0), 0);
}

export function getDayType(dayStr) {
  return dayStr.split(' ')[0];
}

export function getDayMiles(dayStr) {
  return parseFloat(dayStr.split(' ')[1]) || 0;
}

/**
 * Parse a YYYY-MM-DD string using LOCAL date parts (not UTC) so there is no
 * timezone shift on machines west of UTC.
 */
function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getPlanStart() {
  const stored = localStorage.getItem('trnr_startDate');
  if (stored) {
    const d = parseLocalDate(stored);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() - d.getDay());
      return d;
    }
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDateForCell(week, dayIdx) {
  const s = getPlanStart();
  const d = new Date(s);
  d.setDate(s.getDate() + (week - 1) * 7 + dayIdx);
  return localDateStr(d);
}

export function getRaceDate() {
  const stored = localStorage.getItem('trnr_raceDate');
  if (stored) {
    const d = parseLocalDate(stored);
    if (!isNaN(d.getTime())) return d;
  }
  const s = getPlanStart();
  const d = new Date(s);
  d.setDate(s.getDate() + 16 * 7);
  return d;
}

export function getDaysUntilRace() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = getRaceDate();
  return Math.ceil((race - today) / (1000 * 60 * 60 * 24));
}

export function getActualMilesForWeek(week, runs) {
  const dates = Array.from({ length: 7 }, (_, i) => getDateForCell(week, i));
  return runs.filter(r => dates.includes(r.date)).reduce((sum, r) => sum + r.distMi, 0);
}

export function getLogsForDate(dateStr, runs) {
  return runs.filter(r => r.date === dateStr);
}
