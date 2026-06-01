import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { db } from '../db';
import { paceStr, formatPaceTick } from '../lib/pace';
import { TYPE_COLOR, chipClass, TOKENS } from '../lib/colors';
import {
  fetchStravaAthlete,
  fetchStravaActivities,
  fetchStravaStreams,
  normalizeStravaActivity,
  streamsToChartData,
} from '../lib/strava';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function checkDupe(w) {
  if (!w.distMi || !w.date) return { ...w, _status: 'invalid' };
  const onDate = await db.runs.where('date').equals(w.date).toArray();
  const isDupe = onDate.some(r => Math.abs(r.dist - w.distMi) < 0.01);
  return { ...w, _status: isDupe ? 'duplicate' : 'new' };
}

async function importToDb(activities, selected, user) {
  let imported = 0, dupes = 0;
  for (let i = 0; i < activities.length; i++) {
    if (!selected.has(i)) continue;
    const a = activities[i];
    if (a._status !== 'new') { dupes++; continue; }
    await db.runs.add({
      user,
      date:  a.date,
      dist:  a.distMi,
      dur:   a.durMin,
      type:  a.type,
      notes: a.hr ? `Avg HR ${a.hr} bpm` : '',
    });
    imported++;
  }
  return { imported, dupes };
}

// ── Streams detail chart ──────────────────────────────────────────────────────

const StreamsTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1.5">{d.t} min</p>
      {d.pace != null && (
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Pace</span>
          <span style={{ color: '#7F77DD' }}>{formatPaceTick(d.pace)}/mi</span>
        </div>
      )}
      {d.hr != null && (
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">Heart rate</span>
          <span style={{ color: '#f87171' }}>{d.hr} bpm</span>
        </div>
      )}
    </div>
  );
};

function StreamsChart({ activityId }) {
  const [points, setPoints]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  useEffect(() => {
    fetchStravaStreams(activityId)
      .then(s => setPoints(streamsToChartData(s)))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [activityId]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 py-3">
        <RefreshCw size={11} className="animate-spin" /> Loading streams…
      </div>
    );
  }
  if (err) {
    return <p className="text-xs text-red-400 py-2">Streams unavailable: {err}</p>;
  }
  if (!points?.length) {
    return <p className="text-xs text-slate-500 py-2">No stream data for this activity.</p>;
  }

  const hasHR   = points.some(p => p.hr   != null);
  const hasPace = points.some(p => p.pace != null);

  return (
    <div className="mt-3">
      {(hasHR || hasPace) && (
        <div className="flex items-center gap-3 text-xs mb-2 justify-end">
          {hasPace && (
            <span className="flex items-center gap-1.5" style={{ color: TOKENS.blue }}>
              <span style={{ display: 'inline-block', width: 12, height: 2, background: TOKENS.blue }} />
              PACE
            </span>
          )}
          {hasHR && (
            <span className="flex items-center gap-1.5" style={{ color: TOKENS.red }}>
              <span style={{ display: 'inline-block', width: 12, height: 2, background: TOKENS.red }} />
              HR
            </span>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={points} margin={{ top: 4, right: hasHR ? 8 : 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}m`}
            interval="preserveStartEnd"
          />
          {hasPace && (
            <YAxis
              yAxisId="pace"
              orientation="left"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatPaceTick}
              domain={['auto', 'auto']}
              reversed
              width={42}
            />
          )}
          {hasHR && (
            <YAxis
              yAxisId="hr"
              orientation="right"
              tick={{ fill: TOKENS.red + '99', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              width={36}
            />
          )}
          <Tooltip content={<StreamsTooltip />} cursor={{ stroke: '#334155', strokeWidth: 1 }} />
          {hasPace && (
            <Area
              yAxisId="pace"
              type="monotone"
              dataKey="pace"
              stroke={TOKENS.blue}
              strokeWidth={1.5}
              fill="rgba(77,163,255,0.12)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          )}
          {hasHR && (
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr"
              stroke={TOKENS.red}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ activity, checked, onToggle, onDismiss, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const { name, date, distMi, durMin, hr, type, _status, stravaId } = activity;

  const color  = TYPE_COLOR[type] || '#64748b';
  const pace   = distMi && durMin ? paceStr(distMi, durMin) : null;
  const isDupe = _status === 'duplicate';

  return (
    <div className={`rounded-lg border transition-colors mb-1.5 ${
      isDupe
        ? 'border-slate-800 opacity-60'
        : expanded
        ? 'border-slate-600 bg-slate-800/70'
        : 'border-slate-800 bg-slate-900 hover:bg-slate-800/50'
    }`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          className="mt-0.5 accent-emerald-500 cursor-pointer flex-shrink-0"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{name}</span>
            <span className={chipClass(type) + ' flex-shrink-0'}>{type}</span>
            {isDupe && (
              <span className="chip flex-shrink-0" style={{ color: TOKENS.yellow, borderColor: TOKENS.yellow }}>
                in log
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {date}
            {distMi  ? ` · ${distMi.toFixed(2)} mi`  : ''}
            {pace    ? ` · ${pace}/mi`                : ''}
            {durMin  ? ` · ${durMin} min`             : ''}
            {hr      ? ` · ${hr} bpm`                 : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Dismiss button — only on "in log" rows */}
          {isDupe && onDismiss && (
            <button
              className="text-slate-600 hover:text-slate-300 transition-colors px-1"
              onClick={onDismiss}
              title="Mark as recorded — remove from list"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
          <button
            className="text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <StreamsChart activityId={stravaId} />
        </div>
      )}
    </div>
  );
}

// ── Strava activities card ────────────────────────────────────────────────────
// Fetches recent activities from Strava and lets the user import them to Dexie.
// TODO: /tmp on Render's free tier is wiped on redeploy, so the OAuth token is
// lost after each deploy. Re-run GET /auth/strava after redeploying until
// persistent token storage is added.

export function StravaActivitiesCard({ defaultUser }) {
  const [phase,      setPhase]      = useState('loading'); // loading | ready | importing | done | error | disconnected
  const [activities, setActivities] = useState([]);
  const [selected,   setSelected]   = useState(new Set());
  const [dismissed,  setDismissed]  = useState(new Set()); // stravaIds of "in log" rows the user has hidden
  const [result,     setResult]     = useState(null);
  const [errMsg,     setErrMsg]     = useState('');

  const load = useCallback(async () => {
    setPhase('loading');
    setErrMsg('');
    setDismissed(new Set());
    try {
      const raw        = await fetchStravaActivities(15);
      const normalized = raw.map(normalizeStravaActivity);
      const annotated  = await Promise.all(normalized.map(checkDupe));
      setActivities(annotated);
      // Pre-select new activities; still allow toggling duplicates manually.
      setSelected(new Set(
        annotated.map((a, i) => a._status !== 'invalid' ? i : -1).filter(i => i >= 0)
      ));
      setPhase('ready');
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('not connected') || msg.includes('OAuth')) {
        setPhase('disconnected');
      } else {
        setErrMsg(msg);
        setPhase('error');
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(i) {
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  // Dismiss hides an "in log" row and removes it from the selection.
  function dismiss(stravaId, idx) {
    setDismissed(prev => new Set([...prev, stravaId]));
    setSelected(prev => { const s = new Set(prev); s.delete(idx); return s; });
  }

  function selectAll() {
    setSelected(new Set(
      activities
        .map((a, i) => (!dismissed.has(a.stravaId) && a._status !== 'invalid') ? i : -1)
        .filter(i => i >= 0)
    ));
  }
  function deselectAll() { setSelected(new Set()); }
  function selectNew() {
    setSelected(new Set(
      activities
        .map((a, i) => (!dismissed.has(a.stravaId) && a._status === 'new') ? i : -1)
        .filter(i => i >= 0)
    ));
  }

  async function doImport() {
    setPhase('importing');
    try {
      const res = await importToDb(activities, selected, defaultUser);
      setResult(res);
      setPhase('done');
    } catch (e) {
      setErrMsg(`Import failed: ${e.message}`);
      setPhase('error');
    }
  }

  const visibleActivities = activities.filter(a => !dismissed.has(a.stravaId));
  const selectedCount     = selected.size;
  const hasNew            = visibleActivities.some(a => a._status === 'new');

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-orange-400" />
          <span className="section-label mb-0">Strava — recent activities</span>
        </div>
        {(phase === 'ready' || phase === 'done' || phase === 'error') && (
          <button className="btn-ghost text-xs" onClick={load}>
            <RefreshCw size={12} /> Refresh
          </button>
        )}
        {phase === 'loading' && (
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <RefreshCw size={12} className="animate-spin" /> Loading…
          </span>
        )}
      </div>

      {phase === 'disconnected' && (
        <p className="text-xs text-slate-500">
          Strava not connected.{' '}
          <a
            href="/auth/strava"
            className="text-orange-400 hover:text-orange-300 underline"
            target="_blank"
            rel="noreferrer"
          >
            Connect Strava
          </a>{' '}
          to pull your activities.
        </p>
      )}

      {phase === 'error' && (
        <p className="text-xs text-red-400">{errMsg}</p>
      )}

      {phase === 'ready' && activities.length === 0 && (
        <p className="text-xs text-slate-500">No recent activities found on Strava.</p>
      )}

      {phase === 'ready' && activities.length > 0 && (
        <>
          {/* Toolbar: selection controls + import button */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button className="btn" onClick={doImport} disabled={selectedCount === 0}>
              Import {selectedCount > 0 ? selectedCount : ''}{selectedCount !== 1 ? ' activities' : ' activity'}
            </button>
            <button className="btn-ghost text-xs" onClick={selectAll}>Select all</button>
            <button className="btn-ghost text-xs" onClick={deselectAll}>Deselect all</button>
            {hasNew && (
              <button className="btn-ghost text-xs" onClick={selectNew}>New only</button>
            )}
          </div>

          {/* Activity list — dismissed rows are hidden, indices unchanged for selection */}
          <div>
            {activities.map((a, i) => {
              if (dismissed.has(a.stravaId)) return null;
              return (
                <ActivityRow
                  key={a.stravaId ?? i}
                  activity={a}
                  checked={selected.has(i)}
                  onToggle={() => toggle(i)}
                  onDismiss={a._status === 'duplicate' ? () => dismiss(a.stravaId, i) : null}
                  disabled={phase !== 'ready'}
                />
              );
            })}
          </div>

          {dismissed.size > 0 && (
            <p className="text-xs text-slate-600 mt-2">
              {dismissed.size} {dismissed.size === 1 ? 'activity' : 'activities'} hidden ·{' '}
              <button
                className="underline hover:text-slate-400 transition-colors"
                onClick={() => setDismissed(new Set())}
              >
                show all
              </button>
            </p>
          )}
        </>
      )}

      {phase === 'importing' && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-2">
          <RefreshCw size={12} className="animate-spin" /> Importing…
        </p>
      )}

      {phase === 'done' && result && (
        <div className="mt-3 text-xs space-y-1">
          {result.imported > 0 && (
            <p className="text-emerald-400">
              ✓ {result.imported} {result.imported !== 1 ? 'activities' : 'activity'} added to log
            </p>
          )}
          {result.dupes > 0 && (
            <p className="text-slate-500">{result.dupes} already in log (skipped)</p>
          )}
          <button className="btn-ghost text-xs mt-1" onClick={load}>Refresh</button>
        </div>
      )}
    </div>
  );
}

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
