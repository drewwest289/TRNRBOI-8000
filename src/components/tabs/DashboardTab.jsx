import { useState, useEffect, useCallback } from 'react';
import { MapPin, ChevronDown, ChevronUp, Activity, Footprints, Clock, Mountain, Gauge, Heart, Repeat } from 'lucide-react';
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

function computeAverages(activities) {
  const runs = activities.filter(a => a.type !== 'Rest' && a.distMi > 0 && a.durMin > 0);
  if (!runs.length) return null;

  const totalDist = runs.reduce((s, a) => s + a.distMi, 0);
  const totalDur  = runs.reduce((s, a) => s + a.durMin, 0);

  const withHR      = runs.filter(a => a.hr);
  const withCadence = runs.filter(a => a.cadence);

  const dates    = runs.map(a => a.date).sort();
  const dateSpan = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : null;

  return {
    runCount:    runs.length,
    dateSpan,
    avgPace:     paceStr(totalDist, totalDur),
    avgDistMi:   (totalDist / runs.length).toFixed(2),
    totalDistMi: totalDist,
    avgHR:       withHR.length
      ? Math.round(withHR.reduce((s, a) => s + a.hr, 0) / withHR.length)
      : null,
    hrCount:     withHR.length,
    avgCadence:  withCadence.length
      ? Math.round(withCadence.reduce((s, a) => s + a.cadence, 0) / withCadence.length)
      : null,
    cadenceCount: withCadence.length,
  };
}

// ── Small shared components ───────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />;
}

// Icon-led stat strip, laid out as one row with dividers instead of boxed
// tiles. Each item is clickable — tapping it reveals a `detail` line below
// the strip explaining what the number is pulled from, since a bare number
// doesn't say whether it's lifetime Strava data or local logged runs.
function StatItem({ icon: Icon, value, label, detail, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 px-1 py-2"
      style={{ background: 'none', border: 'none', cursor: detail ? 'pointer' : 'default' }}
    >
      <Icon size={18} color={TOKENS.green} strokeWidth={2} />
      <div
        className="text-lg font-semibold leading-none"
        style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--green)' }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        {label}
      </div>
    </button>
  );
}

function StatStrip({ items }) {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div>
      <div className="flex divide-x divide-slate-800">
        {items.map((item, i) => (
          <StatItem
            key={i}
            {...item}
            active={openIdx === i}
            onClick={() => item.detail && setOpenIdx(openIdx === i ? null : i)}
          />
        ))}
      </div>
      {openIdx !== null && items[openIdx].detail && (
        <div className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {items[openIdx].detail}
        </div>
      )}
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
  const prs        = computePRs(activities);
  const averages   = computeAverages(activities);

  return (
    <div>
      {/* Athlete strip */}
      {athlete && <AthleteStrip athlete={athlete} />}

      {/* Lifetime totals */}
      {allTotals && (
        <div className="card">
          <div className="section-label">Lifetime run totals</div>
          <StatStrip
            items={[
              {
                icon: Activity, value: (allTotals.count ?? 0).toLocaleString(), label: 'Runs',
                detail: "Strava's all-time run count for your account, as of last sync.",
              },
              {
                icon: Footprints,
                value: allTotals.distance
                  ? metersToMiles(allTotals.distance).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '—',
                label: 'Miles',
                detail: "Strava's all-time run distance for your account, as of last sync.",
              },
              {
                icon: Clock, value: allTotals.moving_time ? formatHours(allTotals.moving_time) : '—', label: 'Hours',
                detail: "Strava's all-time moving time for your account, as of last sync.",
              },
              {
                icon: Mountain,
                value: allTotals.elevation_gain
                  ? metersToFeet(allTotals.elevation_gain).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '—',
                label: 'Feet climbed',
                detail: "Strava's all-time elevation gain for your account, as of last sync.",
              },
            ]}
          />
        </div>
      )}

      {/* Average stats */}
      {averages && (
        <div className="card">
          <div className="section-label">Average stats</div>
          <StatStrip
            items={[
              {
                icon: Gauge, value: averages.avgPace, label: '/ mile',
                detail: `Averaged across ${averages.runCount} logged runs (${averages.totalDistMi.toFixed(0)} mi total) from ${averages.dateSpan}.`,
              },
              {
                icon: Footprints, value: `${averages.avgDistMi}`, label: 'mi / run',
                detail: `Total logged distance ÷ ${averages.runCount} runs, from ${averages.dateSpan}.`,
              },
              ...(averages.avgHR ? [{
                icon: Heart, value: averages.avgHR, label: 'bpm',
                detail: `Averaged across ${averages.hrCount} of ${averages.runCount} logged runs that recorded heart rate.`,
              }] : []),
              ...(averages.avgCadence ? [{
                icon: Repeat, value: averages.avgCadence, label: 'spm',
                detail: `Averaged across ${averages.cadenceCount} of ${averages.runCount} logged runs that recorded cadence.`,
              }] : []),
            ]}
          />
        </div>
      )}

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
    </div>
  );
}
