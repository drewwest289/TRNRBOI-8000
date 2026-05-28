export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RUNNER_COLORS = [
  '#1D9E75', '#3C3489', '#185FA5', '#BA7517', '#A32D2D', '#0F6E56', '#3B6D11',
];

export const plan16 = [
  { week: 1,  days: ['rest','easy 3','easy 3','rest','easy 3','long 4','cross'] },
  { week: 2,  days: ['rest','easy 3','easy 3','rest','easy 4','long 5','cross'] },
  { week: 3,  days: ['rest','easy 4','tempo 3','rest','easy 4','long 6','cross'] },
  { week: 4,  days: ['rest','easy 3','easy 3','rest','easy 3','long 4','rest'] },
  { week: 5,  days: ['rest','easy 4','tempo 4','rest','easy 4','long 7','cross'] },
  { week: 6,  days: ['rest','easy 4','tempo 4','rest','easy 5','long 8','cross'] },
  { week: 7,  days: ['rest','easy 5','interval 4','rest','easy 5','long 9','cross'] },
  { week: 8,  days: ['rest','easy 4','easy 4','rest','easy 4','long 6','rest'] },
  { week: 9,  days: ['rest','easy 5','tempo 5','rest','easy 5','long 10','cross'] },
  { week: 10, days: ['rest','easy 5','tempo 5','rest','easy 6','long 11','cross'] },
  { week: 11, days: ['rest','easy 5','interval 5','rest','easy 5','long 12','cross'] },
  { week: 12, days: ['rest','easy 4','easy 4','rest','easy 4','long 8','rest'] },
  { week: 13, days: ['rest','easy 5','tempo 5','rest','easy 6','long 10','cross'] },
  { week: 14, days: ['rest','easy 5','interval 5','rest','easy 5','long 11','cross'] },
  { week: 15, days: ['rest','easy 4','tempo 3','rest','easy 3','long 8','cross'] },
  { week: 16, days: ['rest','easy 3','easy 2','rest','easy 2','race 13.1','rest'] },
];

export function getMiles(week) {
  return week.days.reduce((s, d) => s + (parseFloat(d.split(' ')[1]) || 0), 0);
}

export function getDayType(dayStr) {
  return dayStr.split(' ')[0];
}

export function getDayMiles(dayStr) {
  return parseFloat(dayStr.split(' ')[1]) || 0;
}

export function getPlanStart() {
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
  return runs.filter(r => dates.includes(r.date)).reduce((sum, r) => sum + r.dist, 0);
}

export function getLogsForDate(dateStr, runs) {
  return runs.filter(r => r.date === dateStr);
}
