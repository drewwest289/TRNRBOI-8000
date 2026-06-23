import { useState, useEffect } from 'react';
import { RefreshCw } from '../../icons/PixelIcons';
import {
  ComposedChart, Area, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '../../lib/api';
import { fetchStravaZones } from '../../lib/strava';
import { TOKENS } from '../../lib/colors';
import { secToMMSS, formatPaceTick } from '../../lib/pace';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** m/s → decimal min/mi (e.g. 9.75 = 9:45/mi) */
function speedToMinMi(mps) {
  if (!mps || mps <= 0) return null;
  return 1609.34 / mps / 60;
}

/** m/s → formatted "m:ss /mi" string */
function speedToPaceStr(mps) {
  const d = speedToMinMi(mps);
  if (!d) return '—';
  return secToMMSS(d * 60);
}

/** Which 1-based HR zone (1-5) does a given HR fall in, given zone boundaries array */
function getZone(hr, zones) {
  if (!hr || !zones?.length) return null;
  for (let i = 0; i < zones.length; i++) {
    const { min, max } = zones[i];
    if (hr >= min && (max === -1 || hr < max)) return i + 1;
  }
  return null;
}

/** Buckets runs into calendar weeks (Sun–Sat), oldest first. */
function bucketByWeek(runs, weeksCount = 10) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());

  const weeks = Array.from({ length: weeksCount }, (_, i) => {
    const start = new Date(thisWeekStart);
    start.setDate(thisWeekStart.getDate() - (weeksCount - 1 - i) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end, runs: [] };
  });

  for (const a of runs) {
    if (!a.start_date_local) continue;
    const d = new Date(a.start_date_local.slice(0, 10));
    for (const w of weeks) {
      if (d >= w.start && d <= w.end) { w.runs.push(a); break; }
    }
  }
  return weeks;
}

function weekLabel(start) {
  return `${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

// Rule-of-thumb adjustment: climbing costs roughly 12 sec/mile of pace for
// every 100ft of gain encountered in that mile. Flattens hilly runs so pace
// is comparable across routes of different terrain, not a true grade model.
const SEC_PER_100FT_PER_MILE = 12;

function elevationAdjustedPaceStr(runs) {
  const withElev = runs.filter(a => a.average_speed > 0 && a.distance > 0);
  if (!withElev.length) return null;

  const totalMi   = withElev.reduce((s, a) => s + a.distance, 0) / 1609.34;
  const totalSec  = withElev.reduce((s, a) => s + a.distance / a.average_speed, 0);
  const totalElevFt = withElev.reduce((s, a) => s + (a.total_elevation_gain || 0), 0) * 3.28084;

  const climbAdjustSec = (totalElevFt / 100) * SEC_PER_100FT_PER_MILE;
  const flatSecPerMile = (totalSec - climbAdjustSec) / totalMi;
  return secToMMSS(Math.max(flatSecPerMile, 0));
}

// Lightweight inline trend line — avoids spinning up a full recharts chart
// for a tiny sparkline embedded inside a stat card.
function Sparkline({ values, color, height = 22 }) {
  if (values.length < 2) return null;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const ZONE_COLORS = [TOKENS.blue, TOKENS.green, TOKENS.yellow, '#F0883E', TOKENS.red];
const ZONE_BG     = ['rgba(77,163,255,0.18)', 'rgba(124,255,158,0.18)', 'rgba(255,212,77,0.18)', 'rgba(240,136,62,0.18)', 'rgba(255,92,92,0.18)'];

const TYPE_ROWS = ['Easy', 'Long run', 'Tempo', 'Race'];

const TYPE_COLOR_MAP = {
  'Easy':     TOKENS.green,
  'Long run': TOKENS.purple,
  'Tempo':    TOKENS.red,
  'Race':     TOKENS.yellow,
  'Intervals':TOKENS.red,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color, trend }) {
  return (
    <div className="rounded-lg p-3 border" style={{ background: 'var(--bg-nested)', borderColor: 'var(--border)' }}>
      <div className="text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</div>
      <div className="text-2xl font-bold leading-none" style={{ color: color || TOKENS.green, fontFamily: '"Press Start 2P", monospace', fontSize: 18 }}>{value}</div>
      {unit && <div className="mt-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{unit}</div>}
      {trend && trend.length > 1 && (
        <div className="mt-2">
          <Sparkline values={trend} color={color || TOKENS.green} />
        </div>
      )}
    </div>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#1A2232', borderColor: 'var(--border)' }}>
      <p className="mb-1.5" style={{ color: 'var(--text-muted)' }}>{d.label}</p>
      {d.pace != null && (
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--text-muted)' }}>Pace</span>
          <span style={{ color: TOKENS.green }}>{formatPaceTick(d.pace)}/mi</span>
        </div>
      )}
      {d.hr != null && (
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--text-muted)' }}>Avg HR</span>
          <span style={{ color: TOKENS.red }}>{d.hr} bpm</span>
        </div>
      )}
      {d.dist != null && (
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--text-muted)' }}>Distance</span>
          <span style={{ color: 'var(--text-primary)' }}>{d.dist} mi</span>
        </div>
      )}
    </div>
  );
}

// ── Section 1: Pace + fitness dashboard ──────────────────────────────────────

function PaceDashboard({ runs, zones, typeById }) {
  // Last 30 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const recent = runs.filter(a => new Date(a.start_date_local) >= cutoff && a.average_speed > 0);

  // Stat cards
  const avgSpeedRecent = recent.length
    ? recent.reduce((s, a) => s + a.average_speed, 0) / recent.length : 0;
  const avgPaceStr = avgSpeedRecent > 0 ? speedToPaceStr(avgSpeedRecent) : '—';

  const fastest = runs.filter(a => a.average_speed > 0)
    .reduce((b, a) => (!b || a.average_speed > b.average_speed) ? a : b, null);
  const bestPaceStr  = fastest ? speedToPaceStr(fastest.average_speed) : '—';
  const bestPaceDate = fastest?.start_date_local?.substring(5, 10) ?? '';

  const runsWithHR = recent.filter(a => a.average_heartrate);
  const avgHR = runsWithHR.length
    ? Math.round(runsWithHR.reduce((s, a) => s + a.average_heartrate, 0) / runsWithHR.length) : null;

  const effRuns = recent.filter(a => a.average_speed > 0 && a.average_heartrate > 0);
  const effIdx = effRuns.length
    ? (effRuns.reduce((s, a) => s + (a.average_speed / a.average_heartrate), 0) / effRuns.length).toFixed(2)
    : '—';

  // Strava's average_cadence is per single foot — runs report half the true
  // steps/min, so double it to match what a runner would call cadence.
  const runsWithCadence = recent.filter(a => a.average_cadence > 0);
  const avgCadence = runsWithCadence.length
    ? Math.round(runsWithCadence.reduce((s, a) => s + a.average_cadence * 2, 0) / runsWithCadence.length)
    : null;

  const elevAdjPaceStr = elevationAdjustedPaceStr(recent);

  // Weekly mileage + weekly efficiency-index trends — same week buckets so
  // both read off the same timeline.
  const weeks = bucketByWeek(runs, 10);
  const mileageTrend = weeks.map(w => ({
    label: weekLabel(w.start),
    miles: parseFloat((w.runs.reduce((s, a) => s + a.distance, 0) / 1609.34).toFixed(1)),
  }));
  const effTrendValues = weeks
    .map(w => {
      const wEffRuns = w.runs.filter(a => a.average_speed > 0 && a.average_heartrate > 0);
      if (!wEffRuns.length) return null;
      return wEffRuns.reduce((s, a) => s + (a.average_speed / a.average_heartrate), 0) / wEffRuns.length;
    })
    .filter(v => v != null);

  // Pace trend — last 20 runs
  const trendRuns = [...runs].filter(a => a.average_speed > 0).slice(0, 20).reverse();
  const trendData = trendRuns.map((a, i) => ({
    idx:   i + 1,
    label: a.start_date_local?.substring(5, 10) ?? `Run ${i + 1}`,
    pace:  parseFloat(speedToMinMi(a.average_speed).toFixed(2)),
    hr:    a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
    dist:  parseFloat((a.distance / 1609.34).toFixed(1)),
  }));
  const hasHR = trendData.some(d => d.hr != null);

  // Pace by type
  const typeGroups = {};
  runs.filter(a => a.average_speed > 0).forEach(a => {
    const t = typeById.get(a.id) ?? 'Easy';
    if (!TYPE_ROWS.includes(t)) return;
    if (!typeGroups[t]) typeGroups[t] = [];
    typeGroups[t].push(a.average_speed);
  });
  const typeRows = TYPE_ROWS.map(t => {
    const speeds = typeGroups[t] || [];
    if (!speeds.length) return { type: t, paceStr: null, paceSec: 0 };
    const avgSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
    return { type: t, paceStr: speedToPaceStr(avgSpeed), paceSec: 1609.34 / avgSpeed };
  }).filter(r => r.paceStr);
  const maxPaceSec = Math.max(...typeRows.map(r => r.paceSec), 1);

  // HR zone distribution
  const zoneCounts = [0, 0, 0, 0, 0];
  runs.filter(a => a.average_heartrate).forEach(a => {
    const z = getZone(Math.round(a.average_heartrate), zones);
    if (z) zoneCounts[z - 1]++;
  });
  const zoneTotal = zoneCounts.reduce((s, c) => s + c, 0);
  const zonePcts  = zoneCounts.map(c => zoneTotal > 0 ? Math.round(c / zoneTotal * 100) : 0);
  const aerobic   = zonePcts[0] + zonePcts[1];
  const threshold = zonePcts[2] + zonePcts[3] + zonePcts[4];

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <StatCard label="Avg pace" value={avgPaceStr} unit="/ mile · last 30 days" color={TOKENS.green} />
        <StatCard label="Best pace" value={bestPaceStr} unit={bestPaceDate ? `/ mile · ${bestPaceDate}` : '/ mile'} color={TOKENS.blue} />
        <StatCard label="Avg HR" value={avgHR ?? '—'} unit="bpm · last 30 days" color={TOKENS.red} />
        <StatCard
          label="Eff. index" value={effIdx} unit="speed / HR ratio" color={TOKENS.purple}
          trend={effTrendValues}
        />
        <StatCard label="Cadence" value={avgCadence ?? '—'} unit="steps/min · last 30 days" color={TOKENS.yellow} />
        <StatCard label="Elev-adj pace" value={elevAdjPaceStr ?? '—'} unit="/ mile · flat-equivalent" color="#F0883E" />
      </div>

      {/* Pace trend chart */}
      {trendData.length > 1 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="section-label mb-0">Pace trend — last {trendData.length} runs</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5" style={{ color: TOKENS.green }}>
                <span style={{ display: 'inline-block', width: 12, height: 2, background: TOKENS.green }} />
                PACE
              </span>
              {hasHR && (
                <span className="flex items-center gap-1.5" style={{ color: TOKENS.red }}>
                  <span style={{ display: 'inline-block', width: 12, height: 2, background: TOKENS.red, borderTop: `2px dashed ${TOKENS.red}` }} />
                  HR
                </span>
              )}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={trendData} margin={{ top: 4, right: hasHR ? 8 : 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                interval={Math.max(0, Math.ceil(trendData.length / 5) - 1)}
              />
              <YAxis
                yAxisId="pace"
                orientation="left"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false} tickLine={false}
                tickFormatter={formatPaceTick}
                domain={['auto', 'auto']}
                reversed
                width={44}
              />
              {hasHR && (
                <YAxis
                  yAxisId="hr"
                  orientation="right"
                  tick={{ fill: TOKENS.red + '99', fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  domain={['auto', 'auto']}
                  width={36}
                />
              )}
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
              {/* Static fill — Area's stroke renders immediately regardless of
                  animation props, only its fill animates, so the visible
                  outline is drawn separately below via a Line. */}
              <Area
                yAxisId="pace"
                type="monotone"
                dataKey="pace"
                stroke="none"
                fill={`${TOKENS.green}18`}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                yAxisId="pace"
                type="monotone"
                dataKey="pace"
                stroke={TOKENS.green}
                strokeWidth={1.5}
                dot={{ fill: TOKENS.green, r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                animationDuration={2200}
                animationEasing="ease-out"
                animationBegin={0}
              />
              {hasHR && (
                <Line
                  yAxisId="hr"
                  type="monotone"
                  dataKey="hr"
                  stroke={TOKENS.red}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0 }}
                  connectNulls
                  animationDuration={2200}
                  animationEasing="ease-out"
                  animationBegin={0}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly mileage trend — separate from pace, since volume and pace tell different stories */}
      {mileageTrend.some(w => w.miles > 0) && (
        <div className="card mb-4">
          <div className="section-label mb-0">Weekly mileage — last {mileageTrend.length} weeks</div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Training volume, independent of pace</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={mileageTrend} barSize={14} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => active && payload?.[0] ? (
                  <div className="rounded-lg px-3 py-2 text-xs shadow-xl border" style={{ background: '#1A2232', borderColor: 'var(--border)' }}>
                    <span style={{ color: TOKENS.blue }}>{payload[0].value} mi</span>
                  </div>
                ) : null}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="miles" fill={TOKENS.blue} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pace by type + HR zones side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Pace by type */}
        {typeRows.length > 0 && (
          <div className="card">
            <div className="section-label mb-0">Pace by workout type</div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Average pace across logged runs of each type</p>
            <div className="space-y-2.5">
              {typeRows.map(r => {
                const color = TYPE_COLOR_MAP[r.type] || TOKENS.green;
                const widthPct = (r.paceSec / maxPaceSec) * 82;
                return (
                  <div key={r.type} className="flex items-center gap-2 text-xs">
                    <span className="w-16 flex-shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>{r.type}</span>
                    <div className="flex-1 h-3.5 rounded-sm overflow-hidden" style={{ background: 'var(--bg-nested)' }}>
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${widthPct}%`, background: color, opacity: 0.85 }}
                      />
                    </div>
                    <span className="w-11 flex-shrink-0 text-right" style={{ color: 'var(--text-primary)' }}>{r.paceStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* HR zone distribution */}
        {zoneTotal > 0 && (
          <div className="card">
            <div className="section-label">HR zone distribution</div>
            {/* Segmented bar */}
            <div className="flex h-6 rounded overflow-hidden mb-2">
              {zonePcts.map((pct, i) => pct > 0 && (
                <div
                  key={i}
                  className="flex items-center justify-center text-xs font-bold"
                  style={{ width: `${pct}%`, background: ZONE_BG[i], color: ZONE_COLORS[i], fontSize: 10 }}
                >
                  {pct >= 10 ? `Z${i + 1}` : ''}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
              {zonePcts.map((pct, i) => (
                <span key={i} className="text-xs" style={{ color: ZONE_COLORS[i] }}>
                  Z{i + 1} {pct}%
                </span>
              ))}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Aerobic base:{' '}
              <span style={{ color: TOKENS.green }}>{aerobic}%</span>
              &nbsp;·&nbsp;Threshold+:{' '}
              <span style={{ color: '#F0883E' }}>{threshold}%</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PaceTab() {
  // PR/pace-trend/HR-zone math needs precise raw Strava fields (average_speed,
  // distance, average_heartrate, ...) that only live on source === 'strava'
  // entries — so we keep working with raw activity objects here, just sourced
  // from the merged feed instead of a direct Strava pull. `typeById` carries
  // the server-resolved type (override-aware) for display, replacing the
  // tab's own classifier so every tab agrees on an activity's type.
  const [runs,         setRuns]         = useState([]);
  const [typeById,     setTypeById]     = useState(new Map());
  const [zones,        setZones]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [err,          setErr]          = useState(null);

  function load() {
    setLoading(true);
    setErr(null);
    Promise.all([
      apiFetch('/api/activities'),
      fetchStravaZones().catch(() => null), // zones are optional
    ])
      .then(([activities, z]) => {
        const stravaRuns = activities.filter(a => a.source === 'strava' && a.raw);
        setTypeById(new Map(stravaRuns.map(a => [a.stravaId, a.type])));
        setRuns(stravaRuns.map(a => a.raw).filter(a => (a.sport_type || a.type || '').toLowerCase() === 'run'));
        setZones(z?.heart_rate?.zones ?? null);
      })
      .catch(e => {
        const msg = e.message || '';
        if (msg.includes('No Strava tokens') || msg.includes('not connected') || msg.includes('OAuth') || msg.includes('401')) {
          setDisconnected(true);
        } else {
          setErr(msg);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs py-8 justify-center" style={{ color: 'var(--text-muted)' }}>
        <RefreshCw size={13} className="animate-spin" /> Loading Strava data…
      </div>
    );
  }

  if (disconnected) {
    return (
      <div className="card text-center py-8">
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Strava not connected</p>
        <a href="/auth/strava" className="text-orange-400 hover:text-orange-300 underline text-sm" target="_blank" rel="noreferrer">
          Connect Strava
        </a>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Required to display pace stats and personal records.</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="card">
        <p className="text-xs mb-2" style={{ color: TOKENS.red }}>Failed to load: {err}</p>
        <button className="btn-ghost text-xs" onClick={load}><RefreshCw size={12} /> Retry</button>
      </div>
    );
  }

  if (!runs.length) {
    return (
      <div className="card text-center py-8">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No runs found on Strava.</p>
      </div>
    );
  }

  return (
    <div>
      <PaceDashboard runs={runs} zones={zones} typeById={typeById} />
      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Personal records live on the Dashboard tab.
      </p>
    </div>
  );
}
