export function secToMMSS(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function paceStr(distMi, durMin) {
  if (!distMi || !durMin) return '--';
  const totalSec = durMin * 60;
  const perMileSec = totalSec / distMi;
  return secToMMSS(perMileSec);
}

export function paceDecimal(distMi, durMin) {
  if (!distMi || !durMin) return null;
  return durMin / distMi;
}

export function calcPaceFromGoal(distMi, totalSec) {
  const perMileSec = totalSec / distMi;
  const perKmSec = totalSec / (distMi * 1.60934);
  const mph = distMi / (totalSec / 3600);
  return {
    perMile: secToMMSS(perMileSec),
    perKm: secToMMSS(perKmSec),
    mph: mph.toFixed(1),
    perMileSec,
  };
}

export const TRAINING_PACE_FACTORS = [
  { label: 'Easy run',  factor: 1.20, note: 'Conversational pace' },
  { label: 'Long run',  factor: 1.15, note: 'Comfortable effort' },
  { label: 'Tempo',     factor: 0.95, note: 'Comfortably hard' },
  { label: 'Interval',  factor: 0.88, note: 'Hard effort' },
];

/**
 * Strava runs at least as long as targetM, sorted fastest-pace-first
 * (by average_speed desc). PRs are estimated by pairing the fastest run's
 * average_speed with targetM — shared so the Dashboard and Pace tabs agree
 * on personal records instead of each running their own match/estimate logic.
 */
export function prCandidates(runs, targetM) {
  return runs
    .filter(a => {
      const sport = (a.sport_type || a.type || '').toLowerCase();
      return sport === 'run' && a.distance >= targetM * 0.95 && a.elapsed_time > 0 && a.average_speed > 0;
    })
    .sort((a, b) => b.average_speed - a.average_speed);
}

export function formatPaceTick(value) {
  const min = Math.floor(value);
  const sec = Math.round((value - min) * 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}
