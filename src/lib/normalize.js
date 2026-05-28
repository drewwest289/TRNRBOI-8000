export function normalizeHAEWorkout(w) {
  try {
    let distMi = null;
    if (w.distance && typeof w.distance === 'object' && w.distance.qty) {
      const qty = parseFloat(w.distance.qty);
      const units = (w.distance.units || 'mi').toLowerCase();
      distMi = units.includes('km') ? qty * 0.621371 : qty;
    }
    const durMin = w.duration ? Math.round(parseFloat(w.duration) / 60) : null;
    const dateStr = w.start ? w.start.substring(0, 10) : null;
    let hr = null;
    if (w.avgHeartRate && typeof w.avgHeartRate === 'object') {
      hr = Math.round(parseFloat(w.avgHeartRate.qty));
    } else if (w.heartRate && w.heartRate.avg) {
      hr = Math.round(parseFloat(w.heartRate.avg.qty));
    }
    const name = (w.name || '').toLowerCase();
    let type = 'Easy';
    if (name.includes('interval') || name.includes('hiit')) type = 'Intervals';
    else if (name.includes('walk') || name.includes('other')) type = 'Cross-train';
    else if (distMi && distMi >= 8) type = 'Long run';
    const isRun = name.includes('run');
    return { date: dateStr, distMi, durMin, hr, type, name: w.name || 'Workout', isRun };
  } catch {
    return null;
  }
}

export function normalizeLegacyAppleHealth(d) {
  try {
    const distRaw = d.totalDistance || d.distance;
    const distMi = distRaw ? parseFloat(distRaw) : null;
    const durMin = d.duration ? Math.round(parseFloat(d.duration) / 60) : null;
    const dateStr = d.startDate
      ? d.startDate.substring(0, 10)
      : new Date().toISOString().substring(0, 10);
    return { date: dateStr, distMi, durMin, hr: null, type: 'Easy', name: 'Run', isRun: true };
  } catch {
    return null;
  }
}

export function parseHAEJson(raw) {
  const clean = raw.replace(/ /g, ' ');
  let d;
  try {
    d = JSON.parse(clean);
  } catch (e) {
    throw new Error('Invalid JSON — ' + e.message);
  }

  let workouts = [];
  if (d?.data?.workouts && Array.isArray(d.data.workouts)) {
    workouts = d.data.workouts.map(normalizeHAEWorkout);
  } else if (d?.name && d?.start) {
    workouts = [normalizeHAEWorkout(d)];
  } else if (d?.workoutActivityType || d?.totalDistance || d?.duration) {
    workouts = [normalizeLegacyAppleHealth(d)];
  } else if (Array.isArray(d) && d.length > 0) {
    workouts = d[0]?.name && d[0]?.start
      ? d.map(normalizeHAEWorkout)
      : d.map(normalizeLegacyAppleHealth);
  } else {
    throw new Error('Unrecognized format — expected Health Auto Export data.');
  }

  return workouts.filter(Boolean);
}
