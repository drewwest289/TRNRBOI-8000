import { useState } from 'react';
import { RefreshCw, Watch, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ComposedChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { db } from '../../db';
import { useRuns } from '../../hooks/useRuns';
import { useRunners } from '../../hooks/useRunners';
import { paceStr, formatPaceTick, paceDecimal } from '../../lib/pace';
import { localDateStr } from '../../lib/plan';
import { parseHAEJson } from '../../lib/normalize';
import { TYPE_COLOR, CHART_COLORS } from '../../lib/colors';

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
          <span style={{ color: '#7F77DD' }}>{formatPaceTick(d.pace)}/mi</span>
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
            <span style={{ color: '#f87171' }}>{d.hr} bpm</span>
          </div>
        )}
      </div>
      <p className="text-slate-600 text-[10px] mt-2 pt-1.5 border-t border-slate-700">{d.type}</p>
    </div>
  );
};

// ── Shared sync helpers ───────────────────────────────────────────────────────

/**
 * Annotate each normalised workout with its Dexie duplicate status.
 * Returns the same array with an added `_status` field:
 *   'new'       — safe to import
 *   'duplicate' — a run with the same date ± 0.01 mi already exists in Dexie
 *   'invalid'   — missing distMi or date, cannot be imported
 */
async function resolveWorkouts(rawList) {
  return Promise.all(
    rawList.map(async w => {
      if (!w.distMi || !w.date) return { ...w, _status: 'invalid' };
      const dist    = parseFloat(w.distMi.toFixed(2));
      const onDate  = await db.runs.where('date').equals(w.date).toArray();
      const isDupe  = onDate.some(r => Math.abs(r.dist - dist) < 0.01);
      return { ...w, _status: isDupe ? 'duplicate' : 'new' };
    })
  );
}

/**
 * Write the selected workouts to Dexie.
 * Respects the _status field — skips duplicates and invalids even if selected.
 * Returns { imported, dupes, invalid } counts.
 */
async function commitImports(workouts, selected, defaultUser) {
  let imported = 0, dupes = 0, invalid = 0;
  for (let i = 0; i < workouts.length; i++) {
    if (!selected.has(i)) continue;
    const w = workouts[i];
    if (w._status === 'invalid')   { invalid++; continue; }
    if (w._status === 'duplicate') { dupes++;   continue; }
    await db.runs.add({
      user:  defaultUser,
      date:  w.date,
      dist:  parseFloat(w.distMi.toFixed(2)),
      dur:   w.durMin,
      type:  w.type || 'Easy',
      notes: w.hr ? `Avg HR ${w.hr} bpm` : '',
    });
    imported++;
  }
  return { imported, dupes, invalid };
}

// ── Shared workout preview list ───────────────────────────────────────────────

function WorkoutList({ workouts, selected, onToggle }) {
  if (!workouts.length) return null;
  return (
    <div className="space-y-1.5 mt-3">
      {workouts.map((w, i) => {
        const isDupe    = w._status === 'duplicate';
        const isInvalid = w._status === 'invalid';
        const checked   = selected.has(i);
        const color     = TYPE_COLOR[w.type] || '#64748b';
        const pace      = w.distMi && w.durMin ? paceStr(w.distMi, w.durMin) : null;
        const disabled  = isDupe || isInvalid;

        return (
          <label
            key={i}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
              disabled
                ? 'border-slate-800 opacity-50 cursor-default'
                : checked
                ? 'border-slate-600 bg-slate-800 cursor-pointer'
                : 'border-slate-800 bg-slate-900 hover:bg-slate-800/60 cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-emerald-500 cursor-pointer"
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && onToggle(i)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{w.name}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ color, backgroundColor: `${color}22` }}
                >
                  {w.type}
                </span>
                {isDupe && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-900/30 text-amber-500">
                    already in log
                  </span>
                )}
                {isInvalid && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500">
                    no distance
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {w.date}
                {w.distMi  ? ` · ${w.distMi.toFixed(2)} mi` : ''}
                {pace       ? ` · ${pace}/mi`                : ''}
                {w.durMin   ? ` · ${w.durMin} min`           : ''}
                {w.hr       ? ` · ${w.hr} bpm avg`           : ''}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

function ImportActions({ workouts, selected, onToggle, onSelectNew, onSelectAll, onImport, onCancel, note }) {
  const selectableCount = workouts.filter(w => w._status === 'new').length;
  const selectedNew     = [...selected].filter(i => workouts[i]?._status === 'new').length;
  return (
    <>
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <button className="btn" onClick={onImport} disabled={selectedNew === 0}>
          Import {selectedNew > 0 ? selectedNew : ''}
          {selectedNew !== 1 ? ' workouts' : ' workout'}
        </button>
        {selectableCount > 1 && (
          <button className="btn-ghost text-xs" onClick={onSelectNew}>
            Select new only
          </button>
        )}
        <button className="btn-ghost text-xs" onClick={onSelectAll}>Select all</button>
        <button className="btn-ghost text-xs" onClick={onCancel}>Cancel</button>
      </div>
      {note && <p className="text-xs text-slate-600 mt-2">{note}</p>}
    </>
  );
}

function ImportResult({ result, onReset, resetLabel = 'Sync again' }) {
  return (
    <div className="mt-3 text-xs space-y-1">
      {result.imported > 0 && (
        <p className="text-emerald-400">
          ✓ {result.imported} workout{result.imported !== 1 ? 's' : ''} imported
        </p>
      )}
      {result.dupes > 0 && (
        <p className="text-slate-500">{result.dupes} already in log (skipped)</p>
      )}
      {result.invalid > 0 && (
        <p className="text-slate-500">{result.invalid} had no distance data (skipped)</p>
      )}
      {result.imported === 0 && result.dupes === 0 && result.invalid === 0 && (
        <p className="text-slate-500">Nothing to import.</p>
      )}
      <button className="btn-ghost text-xs mt-2" onClick={onReset}>{resetLabel}</button>
    </div>
  );
}

// ── Apple Watch server sync ───────────────────────────────────────────────────
// Phases: idle → fetching → preview → importing → done | error

function WatchSyncCard({ defaultUser }) {
  const [phase,    setPhase]    = useState('idle');
  const [workouts, setWorkouts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [result,   setResult]   = useState(null);
  const [errMsg,   setErrMsg]   = useState('');

  function toggleItem(i) {
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }
  function selectNew()  { setSelected(new Set(workouts.map((w, i) => w._status === 'new' ? i : -1).filter(i => i >= 0))); }
  function selectAll()  { setSelected(new Set(workouts.map((_, i) => i))); }

  async function check() {
    setPhase('fetching');
    setErrMsg('');
    try {
      const res = await fetch('/api/workouts/pending');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const raw = await res.json();
      if (raw.length === 0) {
        setResult({ imported: 0, dupes: 0, invalid: 0 });
        setPhase('done');
        return;
      }
      const annotated = await resolveWorkouts(raw);
      setWorkouts(annotated);
      setSelected(new Set(annotated.map((w, i) => w._status === 'new' ? i : -1).filter(i => i >= 0)));
      setPhase('preview');
    } catch (e) {
      setErrMsg(`Could not reach API server — is it running? (${e.message})`);
      setPhase('error');
    }
  }

  async function doImport() {
    setPhase('importing');
    try {
      const res = await commitImports(workouts, selected, defaultUser);
      // Only clear the server queue if at least something was processed
      if (res.imported > 0 || res.dupes > 0 || res.invalid > 0) {
        await fetch('/api/workouts/pending', { method: 'DELETE' });
      }
      setResult(res);
      setPhase('done');
    } catch (e) {
      setErrMsg(`Import failed: ${e.message}`);
      setPhase('error');
    }
  }

  function reset() {
    setPhase('idle'); setWorkouts([]); setSelected(new Set());
    setResult(null);  setErrMsg('');
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Watch size={16} className="text-slate-400" />
          <span className="section-label mb-0">Apple Watch sync</span>
        </div>
        <div>
          {(phase === 'idle' || phase === 'error') && (
            <button className="btn-ghost text-xs" onClick={check}>
              <RefreshCw size={12} /> Check for workouts
            </button>
          )}
          {phase === 'done' && (
            <button className="btn-ghost text-xs" onClick={reset}>
              <RefreshCw size={12} /> Sync again
            </button>
          )}
          {phase === 'fetching' && (
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" /> Checking…
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Workouts POSTed from Apple Shortcuts to{' '}
        <code className="text-slate-400 bg-slate-800 px-1 rounded">:3001/api/workouts</code>{' '}
        queue here until synced.
      </p>

      {phase === 'preview' && (
        <>
          <WorkoutList workouts={workouts} selected={selected} onToggle={toggleItem} />
          <ImportActions
            workouts={workouts}
            selected={selected}
            onToggle={toggleItem}
            onSelectNew={selectNew}
            onSelectAll={selectAll}
            onImport={doImport}
            onCancel={reset}
            note="The server queue clears after import — unselected items will be discarded."
          />
        </>
      )}

      {phase === 'importing' && (
        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
          <RefreshCw size={12} className="animate-spin" /> Importing…
        </p>
      )}

      {phase === 'done' && result && (
        <ImportResult result={result} onReset={reset} />
      )}

      {phase === 'error' && (
        <p className="text-xs text-red-400 mt-2">{errMsg}</p>
      )}
    </div>
  );
}

// ── Manual JSON import ────────────────────────────────────────────────────────
// Phases: idle → preview → importing → done | error

function JsonImportCard({ defaultUser }) {
  const [open,     setOpen]     = useState(false);
  const [phase,    setPhase]    = useState('idle');
  const [raw,      setRaw]      = useState('');
  const [workouts, setWorkouts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [result,   setResult]   = useState(null);
  const [errMsg,   setErrMsg]   = useState('');

  function toggleItem(i) {
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }
  function selectNew() { setSelected(new Set(workouts.map((w, i) => w._status === 'new' ? i : -1).filter(i => i >= 0))); }
  function selectAll() { setSelected(new Set(workouts.map((_, i) => i))); }

  async function parse() {
    if (!raw.trim()) { setErrMsg('Paste some JSON first.'); return; }
    setErrMsg('');
    try {
      const normalised = parseHAEJson(raw);
      if (!normalised.length) throw new Error('No workouts found in this JSON.');
      const annotated = await resolveWorkouts(normalised);
      setWorkouts(annotated);
      setSelected(new Set(annotated.map((w, i) => w._status === 'new' ? i : -1).filter(i => i >= 0)));
      setPhase('preview');
    } catch (e) {
      setErrMsg(e.message);
    }
  }

  async function doImport() {
    setPhase('importing');
    try {
      const res = await commitImports(workouts, selected, defaultUser);
      setResult(res);
      setPhase('done');
    } catch (e) {
      setErrMsg(`Import failed: ${e.message}`);
      setPhase('idle');
    }
  }

  function reset() {
    setPhase('idle'); setRaw(''); setWorkouts([]);
    setSelected(new Set()); setResult(null); setErrMsg('');
  }

  return (
    <div className="card">
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-slate-400" />
          <span className="section-label mb-0">Import from Health Auto Export JSON</span>
        </div>
        {open
          ? <ChevronUp size={14} className="text-slate-500" />
          : <ChevronDown size={14} className="text-slate-500" />
        }
      </button>

      {open && (
        <div className="mt-4">
          {(phase === 'idle') && (
            <>
              <p className="text-xs text-slate-500 mb-3">
                Paste a full Health Auto Export JSON (bulk or single-workout format).
                Runs already in your log are detected and skipped automatically.
              </p>
              <textarea
                className="field font-mono text-xs resize-y mb-2"
                rows={6}
                placeholder={'{\n  "data": {\n    "workouts": [...]\n  }\n}'}
                value={raw}
                onChange={e => { setRaw(e.target.value); setErrMsg(''); }}
              />
              {errMsg && <p className="text-xs text-red-400 mb-2">{errMsg}</p>}
              <button className="btn" onClick={parse}>
                <Upload size={14} /> Parse workouts
              </button>
            </>
          )}

          {phase === 'preview' && (
            <>
              <WorkoutList workouts={workouts} selected={selected} onToggle={toggleItem} />
              <ImportActions
                workouts={workouts}
                selected={selected}
                onToggle={toggleItem}
                onSelectNew={selectNew}
                onSelectAll={selectAll}
                onImport={doImport}
                onCancel={reset}
              />
            </>
          )}

          {phase === 'importing' && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-3">
              <RefreshCw size={12} className="animate-spin" /> Importing…
            </p>
          )}

          {phase === 'done' && result && (
            <ImportResult result={result} onReset={reset} resetLabel="Import more" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HistoryTab() {
  const runs    = useRuns();
  const runners = useRunners();

  const defaultUser = runners[0]?.name || 'Drew';

  const weeklyData = weeklyMileageData(runs);
  const paceData   = paceTrendData(runs);
  const typeData   = runTypeData(runs);
  const hasHR      = paceData.some(d => d.hr != null);

  const totalMiles = runs.reduce((s, r) => s + r.dist, 0);
  const avgPace    = runs.length
    ? paceStr(runs.reduce((s, r) => s + r.dist, 0), runs.reduce((s, r) => s + r.dur, 0))
    : '--';

  return (
    <div>
      <WatchSyncCard  defaultUser={defaultUser} />
      <JsonImportCard defaultUser={defaultUser} />

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
                <CartesianGrid vertical={false} stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip formatter={v => `${v} mi`} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="miles" fill="#1D9E75" radius={[3, 3, 0, 0]} />
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
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span style={{ display:'inline-block', width:14, height:2, borderRadius:1, background:'#7F77DD' }} />
                      Pace
                    </span>
                    <span className="flex items-center gap-1.5" style={{ color:'#f87171' }}>
                      <span style={{ display:'inline-block', width:14, height:2, borderRadius:1, background:'#f87171' }} />
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
                  <defs>
                    {/* Gradient: transparent at top → semi-opaque at bottom.
                        With reversed Y-axis the Area fills upward (toward the
                        axis minimum at the top), so the fill is most opaque
                        right at the data line and fades away from it. */}
                    <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#7F77DD" stopOpacity={0.03} />
                      <stop offset="100%" stopColor="#7F77DD" stopOpacity={0.22} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />

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
                      tick={{ fill: '#f8716199', fontSize: 10 }}
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

                  {/* Pace area with gradient fill */}
                  <Area
                    yAxisId="pace"
                    type="monotone"
                    dataKey="pace"
                    stroke="#7F77DD"
                    strokeWidth={2}
                    fill="url(#paceGradient)"
                    dot={{ fill: '#7F77DD', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />

                  {/* Heart-rate line (coral/red, right axis) */}
                  {hasHR && (
                    <Line
                      yAxisId="hr"
                      type="monotone"
                      dataKey="hr"
                      stroke="#f87171"
                      strokeWidth={1.5}
                      dot={{ fill: '#f87171', r: 2.5, strokeWidth: 0 }}
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
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-300 w-24">{entry.type}</span>
                        <span className="text-xs text-slate-500">{entry.count} ({pct}%)</span>
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
          <div className="text-center py-8 text-slate-500 text-sm">No runs logged yet</div>
        ) : (
          <div>
            {runs.map(r => {
              const color = TYPE_COLOR[r.type] || '#64748b';
              const pace  = paceStr(r.dist, r.dur);
              return (
                <div
                  key={r.id}
                  className="grid gap-3 items-center py-3 border-b border-slate-800 last:border-0"
                  style={{ gridTemplateColumns: '80px 1fr auto' }}
                >
                  <div className="text-xs text-slate-500">{r.date}</div>
                  <div>
                    <div className="text-sm text-white flex items-center gap-2 flex-wrap">
                      {r.user}
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}22` }}>
                        {r.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.dur} min · {pace}/mi{r.notes ? ` · ${r.notes}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-white">{r.dist.toFixed(1)} mi</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
