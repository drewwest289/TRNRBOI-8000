import { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Plus, Trash2, Trophy } from '../../icons/PixelIcons';
import { X, MessageCircle } from 'lucide-react';
import {
  useActivities, addManualActivity, deleteManualActivity, updateManualActivity,
  setActivityOverride, TYPE_OPTIONS,
} from '../../hooks/useActivities';
import { useAuth } from '../../hooks/useAuth';
import { paceStr, getCurrentPRIds } from '../../lib/pace';
import { localDateStr } from '../../lib/plan';
import { TYPE_COLOR, CHART_COLORS, TOKENS } from '../../lib/colors';
import ActivityDetailModal from '../ActivityDetailModal';

const RUN_TYPES = ['Easy', 'Tempo', 'Long run', 'Intervals', 'Cross-train'];

const localToday = () => localDateStr(new Date());

// ── Chart data helpers ────────────────────────────────────────────────────────
// `type` arrives pre-resolved from /api/activities (override applied server-side),
// so these just read it directly — no local override store to consult.

function weeklyMileageData(runs) {
  const byWeek = {};
  runs.forEach(r => {
    if (r.type === 'Rest') return;
    const d = new Date(r.date + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay());
    const key = localDateStr(d);
    byWeek[key] = (byWeek[key] || 0) + r.distMi;
  });
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([weekStart, miles]) => ({ weekStart, date: weekStart.slice(5), miles: parseFloat(miles.toFixed(1)) }));
}

/** Runs falling within the 7-day window starting at weekStart (inclusive, local dates). */
function runsForWeek(runs, weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end   = new Date(start);
  end.setDate(end.getDate() + 7);
  return runs.filter(r => {
    const d = new Date(r.date + 'T00:00:00');
    return d >= start && d < end;
  });
}

function runTypeData(runs) {
  const counts = {};
  runs.forEach(r => {
    if (r.type === 'Rest') return;
    counts[r.type] = (counts[r.type] || 0) + 1;
  });
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

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoryTab() {
  const activities         = useActivities();
  const { user: authUser } = useAuth();
  const [activeRun,  setActiveRun]  = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);

  const [form, setForm] = useState({
    date: localToday(), dist: '', dur: '', type: 'Easy', notes: '',
  });
  const [logFeedback, setLogFeedback] = useState('');

  const setField = (k, v) => {
    setLogFeedback('');
    setForm(f => ({ ...f, [k]: v }));
  };

  async function handleAddRun() {
    const dist = parseFloat(form.dist);
    const dur  = parseInt(form.dur);
    if (!form.date || !dist || isNaN(dist) || !dur || isNaN(dur)) {
      setLogFeedback('error:Date, distance, and duration are required.');
      return;
    }
    try {
      await addManualActivity({ date: form.date, dist, dur, type: form.type, notes: form.notes });
      setForm(f => ({ ...f, dist: '', dur: '', notes: '' }));
      setLogFeedback('ok');
      setTimeout(() => setLogFeedback(''), 2000);
    } catch (e) {
      setLogFeedback(`error:Could not save run: ${e.message}`);
    }
  }

  async function handleDeleteRun(id) {
    if (!confirm('Delete this run?')) return;
    await deleteManualActivity(id);
  }

  // Rest days are kept in the log (so a mistaken tag is easy to undo) but
  // excluded from every stat, chart, and average below.
  const trainingRuns = activities.filter(r => r.type !== 'Rest');
  const prIds         = getCurrentPRIds(activities);

  const weeklyData = weeklyMileageData(activities);
  const typeData   = runTypeData(activities);
  const selectedWeekRuns = selectedWeekStart ? runsForWeek(activities, selectedWeekStart) : [];

  const totalMiles = trainingRuns.reduce((s, r) => s + r.distMi, 0);
  const avgPace    = trainingRuns.length
    ? paceStr(trainingRuns.reduce((s, r) => s + r.distMi, 0), trainingRuns.reduce((s, r) => s + r.durMin, 0))
    : '--';

  // Type corrections persist server-side via activity_overrides — the same
  // mutation regardless of whether the row's facts come from Strava or a
  // manual entry, so Dashboard/History/Plan can never disagree again.
  async function handleTypeChange(run, newType) {
    if (run.source === 'strava') await setActivityOverride(run.stravaId, { type: newType });
    else                         await updateManualActivity(run.id, { type: newType });
  }

  return (
    <div>
      {activeRun && (
        <ActivityDetailModal
          activity={{
            id:       activeRun.id,
            name:     activeRun.notes?.match(/^(.+?)\n/)?.[1] || `${activeRun.type} · ${activeRun.date}`,
            date:     activeRun.date,
            distMi:   activeRun.distMi,
            durMin:   activeRun.durMin,
            hr:       activeRun.hr,
            stravaId: activeRun.stravaId,
          }}
          onClose={() => setActiveRun(null)}
        />
      )}

      {selectedWeekStart && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          onClick={() => setSelectedWeekStart(null)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white">
                Week of {selectedWeekStart}
              </h2>
              <button
                className="text-slate-500 hover:text-white transition-colors ml-4 flex-shrink-0"
                onClick={() => setSelectedWeekStart(null)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4">
              {selectedWeekRuns.length === 0 ? (
                <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No runs logged this week.
                </p>
              ) : (
                selectedWeekRuns.map(r => {
                  const pace = paceStr(r.distMi, r.durMin);
                  return (
                    <button
                      key={r.id}
                      className="w-full flex items-center justify-between gap-3 py-2 text-left border-b border-slate-800/50 last:border-0"
                      onClick={() => { setSelectedWeekStart(null); setActiveRun(r); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.date}</span>
                        <span className="text-xs" style={{ color: TYPE_COLOR[r.type] || 'var(--text-muted)' }}>{r.type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pace}/mi</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {r.distMi.toFixed(1)} mi
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <p className="text-xs mt-1 mb-2" style={{ color: 'var(--text-muted)' }}>
        Totals from the runs &amp; cross-training logged in this app. Lifetime Strava totals and PRs live on the Dashboard tab.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{trainingRuns.length}</div>
          <div className="text-xs text-slate-500 mt-1">Logged runs</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{totalMiles.toFixed(0)}</div>
          <div className="text-xs text-slate-500 mt-1">Logged miles</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{avgPace}</div>
          <div className="text-xs text-slate-500 mt-1">Avg pace</div>
        </div>
      </div>

      {trainingRuns.length > 0 && (
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
                <Bar
                  dataKey="miles"
                  fill={TOKENS.green}
                  radius={[0, 0, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => setSelectedWeekStart(data.weekStart)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

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
                    const pct   = Math.round((entry.count / trainingRuns.length) * 100);
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

      {/* Log a run */}
      <div className="card">
        <div className="section-label">Log a run</div>

        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>DATE</label>
          <input
            type="date" className="field" value={form.date}
            onChange={e => setField('date', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>DIST (MI)</label>
            <input type="number" className="field" placeholder="3.1" step="0.1" min="0"
              value={form.dist} onChange={e => setField('dist', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TIME (MIN)</label>
            <input type="number" className="field" placeholder="30" step="1" min="0"
              value={form.dur} onChange={e => setField('dur', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TYPE</label>
            <select className="field" value={form.type} onChange={e => setField('type', e.target.value)}>
              {RUN_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>NOTES</label>
            <input type="text" className="field" placeholder="How did it feel?"
              value={form.notes} onChange={e => setField('notes', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRun()} />
          </div>
          <div className="flex items-end">
            <button className="btn" onClick={handleAddRun}>
              <Plus size={14} /> Add run
            </button>
          </div>
        </div>

        {logFeedback.startsWith('error:') && (
          <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>{logFeedback.slice(6)}</p>
        )}
        {logFeedback === 'ok' && (
          <p className="text-xs mt-2" style={{ color: 'var(--green)' }}>Run added ✓</p>
        )}
      </div>

      {/* Full run log */}
      <div className="card">
        <div className="section-label">All runs</div>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No runs logged yet</div>
        ) : (
          <div>
            {activities.map((r, idx) => {
              const pace = paceStr(r.distMi, r.durMin);
              return (
                <div
                  key={r.id}
                  className="grid gap-2 items-center group"
                  style={{
                    gridTemplateColumns: '76px 1fr auto 52px 52px 28px',
                    minHeight: '48px',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: idx % 2 === 0 ? 'var(--bg-nested)' : 'transparent',
                    padding: '0 4px',
                    opacity: r.type === 'Rest' ? 0.5 : 1,
                  }}
                >
                  <div className="text-xs pl-1" style={{ color: 'var(--text-muted)' }}>{r.date}</div>
                  <button
                    className="flex items-center gap-2 flex-wrap text-left"
                    onClick={() => setActiveRun(r)}
                    title="View details"
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{authUser?.name}</span>
                    {r.stravaId != null && prIds.has(r.stravaId) && (
                      <span title="Current personal record">
                        <Trophy size={13} color={TOKENS.yellow} />
                      </span>
                    )}
                    {r.commentCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                        title={`${r.commentCount} comment${r.commentCount === 1 ? '' : 's'}`}
                      >
                        <MessageCircle size={12} />
                        {r.commentCount}
                      </span>
                    )}
                  </button>
                  <select
                    className="text-xs rounded px-1 py-0.5 border border-slate-700 bg-slate-800 cursor-pointer"
                    style={{ color: TYPE_COLOR[r.type] || 'var(--text-muted)' }}
                    value={r.type}
                    onChange={e => { e.stopPropagation(); handleTypeChange(r, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                  >
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{pace}/mi</div>
                  <div className="text-sm font-bold text-right pr-1" style={{ color: 'var(--text-primary)' }}>
                    {r.distMi.toFixed(1)} mi
                  </div>
                  {r.source === 'manual' ? (
                    <button
                      onClick={() => handleDeleteRun(r.id)}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      style={{ color: 'var(--text-muted)', transition: 'none' }}
                      aria-label="Delete run"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
