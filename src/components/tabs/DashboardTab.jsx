import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, MapPin, Users } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS, TOKENS } from '../../lib/colors';
import { fetchStravaAthlete } from '../../lib/strava';

// ── Helpers ───────────────────────────────────────────────────────────────────

const metersToMiles = m => m / 1609.34;
const metersToFeet  = m => m * 3.28084;

function formatHours(secs) {
  return (secs / 3600).toFixed(0);
}

function formatDuration(secs) {
  if (!secs) return '--';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPaceFromMps(mps) {
  if (!mps || mps <= 0) return '--';
  const minPerMile = 1609.34 / mps / 60;
  const mins = Math.floor(minPerMile);
  const secs = Math.round((minPerMile - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function fetchAllActivities() {
  const res = await fetch('/api/strava/activities/all');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Derived data ──────────────────────────────────────────────────────────────

const PR_TARGETS = [
  { name: '1 Mile',       targetM: 1609,  rangeM: [1300,  1900] },
  { name: '5K',           targetM: 5000,  rangeM: [4750,  5400] },
  { name: '10K',          targetM: 10000, rangeM: [9500, 10800] },
  { name: 'Half Marathon', targetM: 21097, rangeM: [19800, 22500] },
];

function computePRs(activities) {
  return PR_TARGETS.map(({ name, rangeM }) => {
    const runs = activities.filter(a => {
      const sport = (a.sport_type || a.type || '').toLowerCase();
      return sport === 'run' && a.distance >= rangeM[0] && a.distance <= rangeM[1];
    });
    if (!runs.length) return { name, time: null, date: null };
    const best = runs.reduce((b, a) => (a.elapsed_time < b.elapsed_time ? a : b));
    return {
      name,
      time: formatDuration(best.elapsed_time),
      date: best.start_date_local?.slice(0, 10) ?? null,
    };
  });
}

// Strava workout_type: 0=default, 1=race, 2=long run, 3=workout
const WORKOUT_TYPE_MAP = { 0: 'Easy', 1: 'Race', 2: 'Long run', 3: 'Workout' };
const WORKOUT_TYPE_COLORS = {
  Easy:      TOKENS.green,
  'Long run': TOKENS.purple,
  Race:       TOKENS.yellow,
  Workout:    TOKENS.red,
};

function computeBreakdown(activities) {
  const runs = activities.filter(a => (a.sport_type || a.type || '').toLowerCase() === 'run');
  const counts = {};
  runs.forEach(a => {
    const label = WORKOUT_TYPE_MAP[a.workout_type] ?? 'Easy';
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function computeAverages(activities) {
  const runs = activities.filter(a =>
    (a.sport_type || a.type || '').toLowerCase() === 'run' &&
    a.distance > 0 && a.moving_time > 0
  );
  if (!runs.length) return null;

  const totalDist = runs.reduce((s, a) => s + a.distance, 0);
  const totalTime = runs.reduce((s, a) => s + a.moving_time, 0);

  const withHR      = runs.filter(a => a.average_heartrate);
  const withCadence = runs.filter(a => a.average_cadence);

  return {
    avgPace:     formatPaceFromMps(totalDist / totalTime),
    avgDistMi:   metersToMiles(totalDist / runs.length).toFixed(2),
    avgHR:       withHR.length
      ? Math.round(withHR.reduce((s, a) => s + a.average_heartrate, 0) / withHR.length)
      : null,
    // Strava cadence is one-foot steps; ×2 for steps per minute
    avgCadence:  withCadence.length
      ? Math.round(withCadence.reduce((s, a) => s + a.average_cadence * 2, 0) / withCadence.length)
      : null,
  };
}

// ── Small shared components ───────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />;
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div
        className="text-2xl font-semibold"
        style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--green)' }}
      >
        {value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Athlete strip ─────────────────────────────────────────────────────────────

function AthleteStrip({ athlete }) {
  return (
    <div className="card flex items-center gap-4">
      {athlete.profile && (
        <img
          src={athlete.profile}
          alt={`${athlete.firstname} ${athlete.lastname}`}
          className="w-14 h-14 rounded-full flex-shrink-0 border-2 border-slate-700 object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-white leading-tight">
          {athlete.firstname} {athlete.lastname}
        </div>
        {(athlete.city || athlete.state) && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
            <MapPin size={11} />
            {[athlete.city, athlete.state, athlete.country].filter(Boolean).join(', ')}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Users size={11} />
            {(athlete.follower_count ?? 0).toLocaleString()} followers
          </span>
          <span className="text-slate-700">·</span>
          <span>{(athlete.friend_count ?? 0).toLocaleString()} following</span>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div>
      <div className="card flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="card">
        <Skeleton className="h-3 w-40 mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
      <div className="card">
        <Skeleton className="h-3 w-32 mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex justify-between py-3 border-b border-slate-800 last:border-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton className="h-3 w-44 mb-4" />
        <div className="flex items-center gap-6">
          <Skeleton className="w-28 h-28 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-40" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PR tooltip ────────────────────────────────────────────────────────────────

function BreakdownTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  const { name, value } = payload[0];
  const color = WORKOUT_TYPE_COLORS[name] || CHART_COLORS[0];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p style={{ color }}>{name}: {value}</p>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function DashboardTab() {
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [athlete,    setAthlete]    = useState(null);
  const [stats,      setStats]      = useState(null);
  const [activities, setActivities] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ athlete: ath, stats: st }, acts] = await Promise.all([
        fetchStravaAthlete(),
        fetchAllActivities(),
      ]);
      setAthlete(ath);
      setStats(st);
      setActivities(acts);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;

  const isNotConnected = error && (error.includes('not connected') || error.includes('OAuth'));

  if (error) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-slate-400 mb-3">
          {isNotConnected ? 'Strava not connected.' : `Failed to load: ${error}`}
        </p>
        {isNotConnected ? (
          <a
            href="/auth/strava"
            className="text-orange-400 hover:text-orange-300 underline text-sm"
            target="_blank"
            rel="noreferrer"
          >
            Connect Strava →
          </a>
        ) : (
          <button className="btn-ghost text-xs" onClick={load}>
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    );
  }

  const allTotals  = stats?.all_run_totals;
  const prs        = computePRs(activities);
  const breakdown  = computeBreakdown(activities);
  const averages   = computeAverages(activities);
  const totalRuns  = breakdown.reduce((s, e) => s + e.count, 0);

  return (
    <div>
      {/* Athlete strip */}
      {athlete && <AthleteStrip athlete={athlete} />}

      {/* Lifetime totals */}
      {allTotals && (
        <div className="card">
          <div className="section-label">Lifetime run totals</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Total runs"
              value={(allTotals.count ?? 0).toLocaleString()}
            />
            <MetricCard
              label="Total miles"
              value={allTotals.distance
                ? metersToMiles(allTotals.distance).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : '—'}
            />
            <MetricCard
              label="Total time"
              value={allTotals.moving_time ? formatHours(allTotals.moving_time) : '—'}
              sub="hours"
            />
            <MetricCard
              label="Elevation gain"
              value={allTotals.elevation_gain
                ? metersToFeet(allTotals.elevation_gain).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : '—'}
              sub="feet"
            />
          </div>
        </div>
      )}

      {/* Personal records */}
      <div className="card">
        <div className="section-label">Personal records</div>
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500">No activities found.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {prs.map(pr => (
              <div
                key={pr.name}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{pr.name}</div>
                <div className="text-right">
                  <div
                    className="text-sm font-bold tabular-nums"
                    style={{
                      fontFamily: '"Press Start 2P", monospace',
                      color: pr.time ? TOKENS.green : TOKENS.textMuted,
                    }}
                  >
                    {pr.time ?? '—'}
                  </div>
                  {pr.date && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{pr.date}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {activities.length > 0 && (
          <p className="text-[10px] text-slate-700 mt-3">
            Best times from {activities.length} activities · based on runs within ±10% of target distance
          </p>
        )}
      </div>

      {/* Activity breakdown */}
      {breakdown.length > 0 && (
        <div className="card">
          <div className="section-label">Activity breakdown</div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={54}
                  paddingAngle={3}
                >
                  {breakdown.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={WORKOUT_TYPE_COLORS[entry.type] || CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<BreakdownTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {breakdown.map((entry, i) => {
                const color = WORKOUT_TYPE_COLORS[entry.type] || CHART_COLORS[i % CHART_COLORS.length];
                const pct   = Math.round((entry.count / totalRuns) * 100);
                return (
                  <div key={entry.type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs w-20" style={{ color: 'var(--text-primary)' }}>{entry.type}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {entry.count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Average stats */}
      {averages && (
        <div className="card">
          <div className="section-label">Average stats</div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Avg pace" value={averages.avgPace} sub="/ mile" />
            <MetricCard label="Avg distance" value={`${averages.avgDistMi} mi`} />
            {averages.avgHR && (
              <MetricCard label="Avg heart rate" value={averages.avgHR} sub="bpm" />
            )}
            {averages.avgCadence && (
              <MetricCard label="Avg cadence" value={averages.avgCadence} sub="spm" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
