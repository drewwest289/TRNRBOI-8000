const BASE = '/api/strava';

async function stravaFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const fetchStravaAthlete    = ()         => stravaFetch('/athlete');
export const fetchStravaActivities = (n = 15)   => stravaFetch(`/activities?per_page=${n}`);
export const fetchStravaStreams     = (id)       => stravaFetch(`/activities/${id}/streams`);
export const fetchStravaActivity   = (id)       => stravaFetch(`/activities/${id}?include_all_efforts=true`);
export const fetchStravaStreamsAll  = (id)       => stravaFetch(`/activities/${id}/streams?keys=time,distance,heartrate,cadence,altitude,velocity_smooth&key_by_type=true`);

// Convert a Strava activity object into the shape the app uses internally.
// This matches what normalizeHAEWorkout produces so the existing Dexie
// import and chart helpers work without modification.
export function normalizeStravaActivity(a) {
  const distMi = parseFloat((a.distance / 1609.34).toFixed(2));
  const durMin = Math.round(a.moving_time / 60);
  const dateStr = a.start_date_local?.substring(0, 10) ?? null;
  const hr = a.average_heartrate ? Math.round(a.average_heartrate) : null;

  const sport = (a.sport_type || a.type || '').toLowerCase();
  const name  = (a.name || '').toLowerCase();
  let type = 'Easy';
  if (sport !== 'run') {
    type = 'Cross-train';
  } else if (name.includes('interval') || name.includes('hiit')) {
    type = 'Intervals';
  } else if (distMi >= 8) {
    type = 'Long run';
  }

  return {
    date:     dateStr,
    distMi,
    durMin,
    hr,
    type,
    name:     a.name || 'Activity',
    stravaId: a.id,
  };
}

// Convert a streams response (key_by_type format) into chart-friendly data points.
// Downsamples to maxPoints for chart performance.
// Returns array of { t (min), hr (bpm), pace (min/mi) }.
export function streamsToChartData(streams, maxPoints = 120) {
  const time = streams.time?.data;
  const hr   = streams.heartrate?.data;
  const vel  = streams.velocity_smooth?.data;
  if (!time?.length) return [];

  const step = Math.max(1, Math.floor(time.length / maxPoints));
  const out  = [];
  for (let i = 0; i < time.length; i += step) {
    // velocity_smooth is m/s; convert to min/mi, ignore near-stopped (<0.5 m/s)
    let pace = undefined;
    if (vel?.[i] != null && vel[i] > 0.5) {
      pace = parseFloat((1609.34 / vel[i] / 60).toFixed(2));
    }
    out.push({
      t:    Math.round(time[i] / 60),
      hr:   hr?.[i] != null ? Math.round(hr[i]) : undefined,
      pace,
    });
  }
  return out;
}
