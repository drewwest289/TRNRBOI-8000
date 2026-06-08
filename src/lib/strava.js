import { apiFetch } from './api';

const stravaFetch = (path) => apiFetch(`/api/strava${path}`);

export const fetchStravaAthlete    = ()         => stravaFetch('/athlete');
export const fetchStravaStreams     = (id)       => stravaFetch(`/activities/${id}/streams`);
export const fetchStravaActivity   = (id)       => stravaFetch(`/activities/${id}?include_all_efforts=true`);
export const fetchStravaStreamsAll  = (id)       => stravaFetch(`/activities/${id}/streams?keys=time,distance,heartrate,cadence,altitude,velocity_smooth&key_by_type=true`);
export const fetchStravaZones      = ()         => stravaFetch('/athlete/zones');

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
