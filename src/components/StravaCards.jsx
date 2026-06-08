import { useState, useEffect } from 'react';
import { Activity } from '../icons/PixelIcons';
import { fetchStravaAthlete } from '../lib/strava';

// ── Strava athlete stats card ─────────────────────────────────────────────────

export function StravaStatsCard() {
  const [data, setData] = useState(null);
  const [err,  setErr]  = useState(null);

  useEffect(() => {
    fetchStravaAthlete()
      .then(setData)
      .catch(e => setErr(e.message));
  }, []);

  // If not connected or errored, render nothing — HAE stats are still shown below.
  if (err || !data) return null;

  const { athlete, stats } = data;
  const ytd = stats?.ytd_run_totals;
  const all = stats?.all_run_totals;

  const mi = m => (m / 1609.34).toFixed(0);
  const hrs = s => (s / 3600).toFixed(0);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-orange-400" />
        <span className="section-label mb-0">
          Strava — {athlete?.firstname} {athlete?.lastname}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">All time</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-white">{all?.count ?? '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">runs</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{all ? mi(all.distance) : '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">miles</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{all ? hrs(all.moving_time) : '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">hours</div>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">This year</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-semibold text-white">{ytd?.count ?? '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">runs</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{ytd ? mi(ytd.distance) : '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">miles</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{ytd ? hrs(ytd.moving_time) : '—'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
