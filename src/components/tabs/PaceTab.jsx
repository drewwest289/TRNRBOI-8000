import { useState, useEffect } from 'react';
import { RefreshCw, PixelIcon } from '../../icons/PixelIcons';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { fetchStravaActivities, fetchStravaZones } from '../../lib/strava';
import { TOKENS, chipClass } from '../../lib/colors';
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

/** Classify a raw Strava activity into a display type string */
function classifyActivity(a) {
  const sport = (a.sport_type || a.type || '').toLowerCase();
  if (sport !== 'run') return 'Cross-train';
  const wt   = a.workout_type;
  const name = (a.name || '').toLowerCase();
  if (wt === 1) return 'Race';
  if (wt === 2) return 'Long run';
  if (wt === 3) return 'Tempo';
  if (name.includes('tempo') || name.includes('threshold')) return 'Tempo';
  if (name.includes('interval') || name.includes('hiit') || name.includes('speed')) return 'Intervals';
  if (name.includes('long') || name.includes('lsd'))  return 'Long run';
  if (name.includes('race') || name.includes('5k') || name.includes('10k')) return 'Race';
  return 'Easy';
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

const ZONE_COLORS = [TOKENS.blue, TOKENS.green, TOKENS.yellow, '#F0883E', TOKENS.red];
const ZONE_BG     = ['rgba(77,163,255,0.18)', 'rgba(124,255,158,0.18)', 'rgba(255,212,77,0.18)', 'rgba(240,136,62,0.18)', 'rgba(255,92,92,0.18)'];

const PR_TARGETS = [
  { label: '1 mile',        targetM: 1609.34 },
  { label: '5K',            targetM: 5000    },
  { label: '10K',           targetM: 10000   },
  { label: 'Half marathon', targetM: 21097   },
];

const TYPE_ROWS = ['Easy', 'Long run', 'Tempo', 'Race'];

const TYPE_COLOR_MAP = {
  'Easy':     TOKENS.green,
  'Long run': TOKENS.purple,
  'Tempo':    TOKENS.red,
  'Race':     TOKENS.yellow,
  'Intervals':TOKENS.red,
};

const TYPE_GLYPH_MAP = {
  'Easy':     'runner',
  'Long run': 'road',
  'Tempo':    'bolt',
  'Intervals':'bolt',
  'Race':     'trophy',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, unit, color }) {
  return (
    <div className="rounded-lg p-3 border" style={{ background: 'var(--bg-nested)', borderColor: 'var(--border)' }}>
      <div className="text-xs mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</div>
      <div className="text-2xl font-bold leading-none" style={{ color: color || TOKENS.green, fontFamily: '"Press Start 2P", monospace', fontSize: 18 }}>{value}</div>
      {unit && <div className="mt-1" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{unit}</div>}
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

function PaceDashboard({ runs, zones }) {
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
    const t = classifyActivity(a);
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Avg pace" value={avgPaceStr} unit="/ mile · last 30 days" color={TOKENS.green} />
        <StatCard label="Best pace" value={bestPaceStr} unit={bestPaceDate ? `/ mile · ${bestPaceDate}` : '/ mile'} color={TOKENS.blue} />
        <StatCard label="Avg HR" value={avgHR ?? '—'} unit="bpm · last 30 days" color={TOKENS.red} />
        <StatCard label="Eff. index" value={effIdx} unit="speed / HR ratio" color={TOKENS.purple} />
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
              <Area
                yAxisId="pace"
                type="monotone"
                dataKey="pace"
                stroke={TOKENS.green}
                strokeWidth={1.5}
                fill={`${TOKENS.green}18`}
                dot={{ fill: TOKENS.green, r: 2.5, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
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
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pace by type + HR zones side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Pace by type */}
        {typeRows.length > 0 && (
          <div className="card">
            <div className="section-label">Pace by workout type</div>
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

// ── Section 2: PRs + recent bests ────────────────────────────────────────────

function PRsAndRecents({ runs }) {
  // PR table
  const prRows = PR_TARGETS.map(({ label, targetM }) => {
    const candidates = runs.filter(a =>
      a.distance >= targetM * 0.9 &&
      a.distance <= targetM * 1.1 &&
      a.average_speed > 0
    );
    if (!candidates.length) return { label, best: null };
    const best    = candidates.reduce((b, a) => a.average_speed > b.average_speed ? a : b);
    const timeSec = Math.round(best.distance / best.average_speed);
    const h = Math.floor(timeSec / 3600);
    const timeStr = h > 0
      ? `${h}:${String(Math.floor((timeSec % 3600) / 60)).padStart(2, '0')}:${String(timeSec % 60).padStart(2, '0')}`
      : secToMMSS(timeSec);
    return {
      label,
      best,
      timeStr,
      date: best.start_date_local?.substring(0, 10),
      isPR: true,
    };
  });

  // Recent runs — last 8
  const recentRuns = runs.slice(0, 8);

  return (
    <>
      {/* PR table */}
      <div className="card mb-4">
        <div className="section-label">Personal records</div>
        <div className="space-y-1.5">
          {prRows.map(({ label, best, timeStr, date }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-nested)' }}
            >
              <span className="text-xs w-28 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
              {best ? (
                <>
                  <span className="text-base font-bold flex-1" style={{ color: TOKENS.green, fontFamily: '"Share Tech Mono", monospace' }}>
                    {timeStr}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: TOKENS.green, background: `${TOKENS.green}18`, border: `1px solid ${TOKENS.green}44`, fontSize: 10 }}
                  >
                    PR
                  </span>
                </>
              ) : (
                <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>no effort logged</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <div className="card">
          <div className="section-label">Recent runs</div>
          <div>
            {recentRuns.map((a, i) => {
              const type  = classifyActivity(a);
              const pace  = speedToPaceStr(a.average_speed);
              const dist  = (a.distance / 1609.34).toFixed(1);
              const hr    = a.average_heartrate ? Math.round(a.average_heartrate) : null;
              const date  = a.start_date_local?.substring(5, 10) ?? '';
              const color = TYPE_COLOR_MAP[type] || TOKENS.green;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 py-2"
                  style={{
                    borderBottom: i < recentRuns.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <PixelIcon
                    name={TYPE_GLYPH_MAP[type] || 'runner'}
                    size={12}
                    color={color}
                    className="flex-shrink-0"
                  />
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.name}</span>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{date}</span>
                  <span className={chipClass(type) + ' flex-shrink-0 hidden sm:inline-block'}>{type}</span>
                  <span className="text-xs font-mono flex-shrink-0" style={{ color: TOKENS.green, minWidth: 48, textAlign: 'right' }}>{pace}</span>
                  {hr && <span className="text-xs font-mono flex-shrink-0" style={{ color: TOKENS.red, minWidth: 44, textAlign: 'right' }}>{hr}</span>}
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{dist} mi</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PaceTab() {
  const [runs,         setRuns]         = useState([]);
  const [zones,        setZones]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const [err,          setErr]          = useState(null);

  function load() {
    setLoading(true);
    setErr(null);
    Promise.all([
      fetchStravaActivities(100),
      fetchStravaZones().catch(() => null), // zones are optional
    ])
      .then(([acts, z]) => {
        setRuns(acts.filter(a => (a.sport_type || a.type || '').toLowerCase() === 'run'));
        setZones(z?.heart_rate?.zones ?? null);
      })
      .catch(e => {
        const msg = e.message || '';
        if (msg.includes('not connected') || msg.includes('OAuth') || msg.includes('401')) {
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
      <PaceDashboard runs={runs} zones={zones} />
      <PRsAndRecents runs={runs} />
    </div>
  );
}
