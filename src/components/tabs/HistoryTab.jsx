import { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useRuns } from '../../hooks/useRuns';
import { useAuth } from '../../hooks/useAuth';
import { paceStr, formatPaceTick, paceDecimal } from '../../lib/pace';
import { localDateStr } from '../../lib/plan';
import { TYPE_COLOR, CHART_COLORS, chipClass, TOKENS } from '../../lib/colors';
import { StravaStatsCard, StravaActivitiesCard } from '../StravaCards';
import ActivityDetailModal from '../ActivityDetailModal';

// ── Chart data helpers ────────────────────────────────────────────────────────

function weeklyMileageData(runs) {
  const byWeek = {};
  runs.forEach(r => {
    const d = new Date(r.date + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay());
    const key = localDateStr(d);
    byWeek[key] = (byWeek[key] || 0) + r.dist;
  });
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([date, miles]) => ({ date: date.slice(5), miles: parseFloat(miles.toFixed(1)) }));
}

function paceTrendData(runs) {
  return [...runs]
    .filter(r => r.dist > 0 && r.dur > 0 && r.type !== 'Cross-train')
    .slice(0, 20)
    .reverse()
    .map(r => {
      // HR may be stored as a dedicated field or encoded in notes as "Avg HR 155 bpm"
      const hrMatch = r.notes?.match(/Avg HR (\d+) bpm/i);
      const hr = r.hr != null ? r.hr : (hrMatch ? parseInt(hrMatch[1], 10) : undefined);
      return {
        date:     r.date.slice(5),    // MM-DD for axis labels
        fullDate: r.date,             // YYYY-MM-DD for tooltip
        pace:     parseFloat(paceDecimal(r.dist, r.dur).toFixed(2)),
        hr:       hr != null ? hr : undefined,
        type:     r.type,
        dist:     r.dist,
        dur:      r.dur,
      };
    });
}

function runTypeData(runs) {
  const counts = {};
  runs.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}

// ── Tooltip components ────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#fff' }}>
          {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const PaceHRTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-xs shadow-xl" style={{ minWidth: 148 }}>
      <p className="text-slate-400 font-medium mb-2">{d.fullDate}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Pace</span>
          <span style={{ color: TOKENS.purple }}>{formatPaceTick(d.pace)}/mi</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Distance</span>
          <span className="text-white">{d.dist?.toFixed(2)} mi</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Time</span>
          <span className="text-white">{d.dur} min</span>
        </div>
        {d.hr != null && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Heart rate</span>
            <span style={{ color: TOKENS.red }}>{d.hr} bpm</span>
          </div>
        )}
      </div>
      <p className="text-slate-600 text-[10px] mt-2 pt-1.5 border-t border-slate-700">{d.type}</p>
    </div>
  );
};

// ── Workout type override (localStorage) ─────────────────────────────────────

const TYPE_OPTIONS = ['Easy', 'Moderate', 'Hard', 'Long run', 'Race', 'Tempo', 'Intervals', 'Cross-train'];
const LS_KEY = 'trnr_type_overrides';

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}

function saveOverride(runId, type) {
  const overrides = loadOverrides();
  overrides[runId] = type;
  localStorage.setItem(LS_KEY, JSON.stringify(overrides));
}

function resolvedType(run, overrides) {
  if (overrides[run.id]) return overrides[run.id];
  return run.type || 'Easy';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoryTab() {
  const runs               = useRuns();
  const { user: authUser } = useAuth();
  const [overrides,  setOverrides]  = useState(loadOverrides);
  const [activeRun,  setActiveRun]  = useState(null);

  const defaultUser = authUser?.name || 'Me';

  const weeklyData = weeklyMileageData(runs);
  const paceData   = paceTrendData(runs);
  const typeData   = runTypeData(runs);
  const hasHR      = paceData.some(d => d.hr != null);

  const totalMiles = runs.reduce((s, r) => s + r.dist, 0);
  const avgPace    = runs.length
    ? paceStr(runs.reduce((s, r) => s + r.dist, 0), runs.reduce((s, r) => s + r.dur, 0))
    : '--';

  function handleTypeChange(run, newType) {
    saveOverride(run.id, newType);
    setOverrides(loadOverrides());
  }

  return (
    <div>
      <StravaStatsCard />
      <StravaActivitiesCard defaultUser={defaultUser} />

      {activeRun && (
        <ActivityDetailModal
          activity={{
            name:     activeRun.notes?.match(/^(.+?)\n/)?.[1] || `${activeRun.type} · ${activeRun.date}`,
            date:     activeRun.date,
            distMi:   activeRun.dist,
            durMin:   activeRun.dur,
            hr:       activeRun.hr ?? (activeRun.notes?.match(/Avg HR (\d+)/)?.[1] ? parseInt(activeRun.notes.match(/Avg HR (\d+)/)[1]) : null),
            stravaId: activeRun.strava_id ?? activeRun.stravaId ?? null,
          }}
          onClose={() => setActiveRun(null)}
        />
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{runs.length}</div>
          <div className="text-xs text-slate-500 mt-1">Total runs</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{totalMiles.toFixed(0)}</div>
          <div className="text-xs text-slate-500 mt-1">Total miles</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{avgPace}</div>
          <div className="text-xs text-slate-500 mt-1">Avg pace</div>
        </div>
      </div>

      {runs.length > 0 && (
        <>
          {/* Weekly mileage */}
          <div className="card">
            <div className="section-label">Weekly mileage (last 12 weeks)</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weeklyData} barSize={10} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip formatter={v => `${v} mi`} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="miles" fill={TOKENS.green} radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pace trend */}
          {paceData.length > 1 && (
            <div className="card">
              {/* Header row: title + optional HR legend */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pace trend · last 20 runs · lower is faster
                </span>
                {hasHR && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5" style={{ color: TOKENS.purple }}>
                      <span style={{ display:'inline-block', width:14, height:2, background: TOKENS.purple }} />
                      PACE
                    </span>
                    <span className="flex items-center gap-1.5" style={{ color: TOKENS.red }}>
                      <span style={{ display:'inline-block', width:14, height:2, background: TOKENS.red }} />
                      HR
                    </span>
                  </div>
                )}
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={paceData}
                  margin={{ top: 8, right: hasHR ? 8 : 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />

                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    // Show ~5 labels regardless of how many data points there are
                    interval={Math.max(0, Math.ceil(paceData.length / 5) - 1)}
                  />

                  {/* Left axis — pace (reversed: lower = faster = higher on screen) */}
                  <YAxis
                    yAxisId="pace"
                    orientation="left"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatPaceTick}
                    domain={['auto', 'auto']}
                    reversed
                    width={44}
                  />

                  {/* Right axis — heart rate (only rendered when data is present) */}
                  {hasHR && (
                    <YAxis
                      yAxisId="hr"
                      orientation="right"
                      tick={{ fill: TOKENS.red + '99', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      width={38}
                    />
                  )}

                  <Tooltip
                    content={<PaceHRTooltip />}
                    cursor={{ stroke: '#334155', strokeWidth: 1 }}
                  />

                  {/* Pace area — blue per spec, flat fill */}
                  <Area
                    yAxisId="pace"
                    type="monotone"
                    dataKey="pace"
                    stroke={TOKENS.blue}
                    strokeWidth={2}
                    fill="rgba(77,163,255,0.12)"
                    dot={{ fill: TOKENS.blue, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />

                  {/* Heart-rate line — red per spec */}
                  {hasHR && (
                    <Line
                      yAxisId="hr"
                      type="monotone"
                      dataKey="hr"
                      stroke={TOKENS.red}
                      strokeWidth={1.5}
                      dot={{ fill: TOKENS.red, r: 2.5, strokeWidth: 0 }}
                      activeDot={{ r: 4.5, strokeWidth: 0 }}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Run type breakdown */}
          {typeData.length > 0 && (
            <div className="card">
              <div className="section-label">Run type breakdown</div>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={typeData} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={34} outerRadius={54} paddingAngle={3}>
                      {typeData.map((entry, i) => (
                        <Cell key={i} fill={TYPE_COLOR[entry.type] || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                            <p style={{ color: TYPE_COLOR[payload[0].name] || '#fff' }}>
                              {payload[0].name}: {payload[0].value}
                            </p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {typeData.map((entry, i) => {
                    const color = TYPE_COLOR[entry.type] || CHART_COLORS[i % CHART_COLORS.length];
                    const pct   = Math.round((entry.count / runs.length) * 100);
                    return (
                      <div key={entry.type} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs w-24" style={{ color: 'var(--text-primary)' }}>{entry.type}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Full run log */}
      <div className="card">
        <div className="section-label">All runs</div>
        {runs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No runs logged yet</div>
        ) : (
          <div>
            {runs.map((r, idx) => {
              const pace        = paceStr(r.dist, r.dur);
              const displayType = resolvedType(r, overrides);
              return (
                <div
                  key={r.id}
                  className="grid gap-2 items-center"
                  style={{
                    gridTemplateColumns: '76px 1fr auto 52px 52px',
                    minHeight: '48px',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: idx % 2 === 0 ? 'var(--bg-nested)' : 'transparent',
                    padding: '0 4px',
                  }}
                >
                  <div className="text-xs pl-1" style={{ color: 'var(--text-muted)' }}>{r.date}</div>
                  <button
                    className="flex items-center gap-2 flex-wrap text-left"
                    onClick={() => setActiveRun(r)}
                    title="View details"
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{r.user || defaultUser}</span>
                  </button>
                  <select
                    className="text-xs rounded px-1 py-0.5 border border-slate-700 bg-slate-800 cursor-pointer"
                    style={{ color: TYPE_COLOR[displayType] || 'var(--text-muted)' }}
                    value={displayType}
                    onChange={e => { e.stopPropagation(); handleTypeChange(r, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                  >
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{pace}/mi</div>
                  <div className="text-sm font-bold text-right pr-1" style={{ color: 'var(--text-primary)' }}>
                    {r.dist.toFixed(1)} mi
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
