import { useState, useEffect, useCallback } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { RefreshCw, Users } from '../../icons/PixelIcons';
import { TOKENS } from '../../lib/colors';
import { fetchStravaAthlete } from '../../lib/strava';
import { useActivities } from '../../hooks/useActivities';
import { paceStr, prCandidates, PR_TARGETS } from '../../lib/pace';

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

// ── Derived data ──────────────────────────────────────────────────────────────

function formatPacePerKm(mps) {
  if (!mps || mps <= 0) return '--';
  const minPerKm = 1000 / mps / 60;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function computePRs(activities) {
  const today = Date.now();
  // PR math needs precise raw Strava fields (distance, elapsed_time,
  // average_speed) — only present on source === 'strava' entries. The merged
  // `.type` (already override-aware) is what filters out anything the user
  // has corrected to 'Rest'.
  const stravaRuns = activities
    .filter(a => a.source === 'strava' && a.raw && a.type !== 'Rest')
    .map(a => a.raw);

  return PR_TARGETS.map(({ name, targetM, goalSecs, goalLabel, paceUnit }) => {
    const sorted = prCandidates(stravaRuns, targetM);
    if (!sorted.length) return { name, time: null, date: null, pace: null, elapsedSecs: null, top3: [], goalSecs, goalLabel };

    // Best = fastest average speed (proxy for best pace at that distance).
    const best = sorted[0];

    // Estimate time over the target distance at the best pace.
    const estSecs = Math.round(targetM / best.average_speed);
    const daysSincePR = best.start_date_local
      ? Math.floor((today - new Date(best.start_date_local).getTime()) / 86400000)
      : null;

    const bestPace = paceUnit === 'km'
      ? `${formatPacePerKm(best.average_speed)}/km`
      : `${formatPaceFromMps(best.average_speed)}/mi`;

    return {
      name,
      time:        formatDuration(estSecs),
      elapsedSecs: estSecs,
      date:        best.start_date_local?.slice(0, 10) ?? null,
      daysSincePR,
      pace:        bestPace,
      top3: sorted.slice(0, 3).map(a => ({
        time: formatDuration(Math.round(targetM / a.average_speed)),
        date: a.start_date_local?.slice(0, 10) ?? null,
        pace: paceUnit === 'km'
          ? `${formatPacePerKm(a.average_speed)}/km`
          : `${formatPaceFromMps(a.average_speed)}/mi`,
      })),
      goalSecs,
      goalLabel,
    };
  });
}

// ── Weekly trend ──────────────────────────────────────────────────────────────

const WEEKS_OF_HISTORY = 8;

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Buckets runs into calendar weeks (Sun–Sat) for the last WEEKS_OF_HISTORY
// weeks, oldest first, so a sparkline can be drawn left-to-right.
function computeWeeklyTrend(activities) {
  const runs = activities.filter(a => a.type !== 'Rest' && a.distMi > 0 && a.date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());

  const weeks = Array.from({ length: WEEKS_OF_HISTORY }, (_, i) => {
    const start = new Date(thisWeekStart);
    start.setDate(thisWeekStart.getDate() - (WEEKS_OF_HISTORY - 1 - i) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end, miles: 0 };
  });

  for (const run of runs) {
    const d = parseLocalDate(run.date);
    for (const week of weeks) {
      if (d >= week.start && d <= week.end) {
        week.miles += run.distMi;
        break;
      }
    }
  }

  const current = weeks[weeks.length - 1].miles;
  const previous = weeks[weeks.length - 2]?.miles ?? 0;
  const pctChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  return { weeks, current, previous, pctChange };
}

function WeeklyTrendCard({ trend }) {
  const maxMiles = Math.max(...trend.weeks.map(w => w.miles), 1);

  return (
    <div className="card">
      <div className="section-label">Weekly mileage</div>
      <div className="flex items-end justify-between gap-1.5" style={{ height: 64 }}>
        {trend.weeks.map((w, i) => {
          const isCurrent = i === trend.weeks.length - 1;
          const heightPct = Math.max(4, Math.round((w.miles / maxMiles) * 100));
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${w.miles.toFixed(1)} mi`}>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isCurrent ? TOKENS.green : 'var(--border)',
                  transition: 'height 0.4s ease',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-baseline justify-between mt-3">
        <div>
          <span
            className="text-xl font-semibold"
            style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--green)' }}
          >
            {trend.current.toFixed(1)}
          </span>
          <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>mi this week</span>
        </div>
        {trend.pctChange !== null && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: trend.pctChange >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: trend.pctChange >= 0 ? TOKENS.green : '#ef4444',
            }}
          >
            {trend.pctChange >= 0 ? '↑' : '↓'} {Math.abs(trend.pctChange)}% vs last week
          </span>
        )}
      </div>
    </div>
  );
}

function computeAverages(activities) {
  const runs = activities.filter(a => a.type !== 'Rest' && a.distMi > 0 && a.durMin > 0);
  if (!runs.length) return null;

  const totalDist = runs.reduce((s, a) => s + a.distMi, 0);
  const totalDur  = runs.reduce((s, a) => s + a.durMin, 0);

  const withHR      = runs.filter(a => a.hr);
  const withCadence = runs.filter(a => a.cadence);

  return {
    avgPace:     paceStr(totalDist, totalDur),
    avgDistMi:   (totalDist / runs.length).toFixed(2),
    avgHR:       withHR.length
      ? Math.round(withHR.reduce((s, a) => s + a.hr, 0) / withHR.length)
      : null,
    avgCadence:  withCadence.length
      ? Math.round(withCadence.reduce((s, a) => s + a.cadence, 0) / withCadence.length)
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

// ── PR row ────────────────────────────────────────────────────────────────────

function PRRow({ pr }) {
  const [expanded, setExpanded] = useState(false);

  const goalAchieved = pr.elapsedSecs != null && pr.goalSecs != null && pr.elapsedSecs <= pr.goalSecs;
  // progress toward goal: ratio of goal time to current time (capped at 100)
  const progress = pr.elapsedSecs && pr.goalSecs
    ? Math.min(100, Math.round((pr.goalSecs / pr.elapsedSecs) * 100))
    : null;

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Main row */}
      <button
        onClick={() => pr.top3.length > 0 && setExpanded(e => !e)}
        className="w-full text-left py-3"
        style={{ background: 'none', border: 'none', padding: '12px 0', cursor: pr.top3.length > 0 ? 'pointer' : 'default' }}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Left: label + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{pr.name}</span>
            {pr.daysSincePR !== null && pr.daysSincePR <= 30 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: TOKENS.green }}
              >
                ↑ {pr.daysSincePR === 0 ? 'today' : `${pr.daysSincePR}d ago`}
              </span>
            )}
            {pr.top3.length > 1 && (
              <span style={{ color: 'var(--text-muted)', lineHeight: 1 }}>
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            )}
          </div>

          {/* Right: time + date + pace */}
          <div className="text-right flex-shrink-0">
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
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{pr.date}</div>
            )}
            {pr.pace && pr.time && (
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pr.pace}</div>
            )}
          </div>
        </div>
      </button>

      {/* Progress bar toward goal */}
      {progress !== null && pr.time && (
        <div className="pb-2">
          <div className="flex justify-between items-center mb-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            <span>{goalAchieved ? '✓ Goal achieved' : pr.goalLabel}</span>
            {!goalAchieved && <span>{progress}%</span>}
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundColor: goalAchieved ? TOKENS.green : TOKENS.blue,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Expanded top-3 */}
      {expanded && pr.top3.length > 1 && (
        <div className="pb-3 space-y-1.5 pl-2">
          {pr.top3.map((t, i) => (
            <div key={i} className="flex justify-between items-center text-xs">
              <span style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: i === 0 ? TOKENS.green : 'var(--text-muted)', marginRight: 6 }}>#{i + 1}</span>
                {t.date}
              </span>
              <div className="text-right">
                <span
                  className="tabular-nums"
                  style={{ color: i === 0 ? TOKENS.green : 'var(--text-primary)' }}
                >
                  {t.time}
                </span>
                <span className="ml-2" style={{ color: 'var(--text-muted)' }}>{t.pace}</span>
              </div>
            </div>
          ))}
        </div>
      )}
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
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="card">
        <Skeleton className="h-3 w-32 mb-4" />
        {[...Array(6)].map((_, i) => (
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

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function DashboardTab() {
  const activities               = useActivities();
  const [loading,  setLoading]   = useState(true);
  const [error,    setError]     = useState(null);
  const [athlete,  setAthlete]   = useState(null);
  const [stats,    setStats]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { athlete: ath, stats: st } = await fetchStravaAthlete();
      setAthlete(ath);
      setStats(st);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;

  const isNotConnected = error && (
    error.includes('No Strava tokens') || error.includes('not connected') || error.includes('OAuth')
  );

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
  const ytdTotals  = stats?.ytd_run_totals;
  const prs        = computePRs(activities);
  const averages   = computeAverages(activities);
  const trend      = activities.length > 0 ? computeWeeklyTrend(activities) : null;

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
          {ytdTotals && (
            <>
              <div className="text-xs mt-4 mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>This year</div>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Runs" value={(ytdTotals.count ?? 0).toLocaleString()} />
                <MetricCard
                  label="Miles"
                  value={ytdTotals.distance
                    ? metersToMiles(ytdTotals.distance).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : '—'}
                />
                <MetricCard
                  label="Time"
                  value={ytdTotals.moving_time ? formatHours(ytdTotals.moving_time) : '—'}
                  sub="hours"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Weekly mileage trend */}
      {trend && <WeeklyTrendCard trend={trend} />}

      {/* Personal records */}
      <div className="card">
        <div className="section-label">Personal records</div>
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500">No activities found.</p>
        ) : (
          <div>
            {prs.map(pr => <PRRow key={pr.name} pr={pr} />)}
          </div>
        )}
        {activities.length > 0 && (
          <p className="text-[10px] text-slate-700 mt-3">
            Best times from {activities.length} activities · tap a row to see top 3
          </p>
        )}
      </div>

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
