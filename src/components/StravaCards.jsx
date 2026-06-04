import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { RefreshCw, Activity, PixelIcon } from '../icons/PixelIcons';
import ActivityDetailModal from './ActivityDetailModal';
import { db } from '../db';
import { paceStr } from '../lib/pace';
import { TYPE_COLOR, chipClass, TOKENS } from '../lib/colors';
import {
  fetchStravaAthlete,
  fetchStravaActivities,
  normalizeStravaActivity,
} from '../lib/strava';

// ── Run-type pixel glyph map ──────────────────────────────────────────────────

const TYPE_GLYPH = {
  'Easy':       'runner',
  'Long run':   'road',
  'Tempo':      'bolt',
  'Intervals':  'bolt',
  'Cross-train':'bike',
  'Rest':       'bed',
};

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
      date:     a.date,
      dist:     a.distMi,
      dur:      a.durMin,
      type:     a.type,
      notes:    a.hr ? `Avg HR ${a.hr} bpm` : '',
      stravaId: a.stravaId || null,
    });
    imported++;
  }
  return { imported, dupes };
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({ activity, checked, onToggle, onDismiss, disabled }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { name, date, distMi, durMin, hr, type, _status } = activity;

  const pace   = distMi && durMin ? paceStr(distMi, durMin) : null;
  const isDupe = _status === 'duplicate';

  return (
    <>
      <div className={`rounded-lg border transition-colors mb-1.5 ${
        isDupe
          ? 'border-slate-800 opacity-60'
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
              <span className={chipClass(type) + ' flex-shrink-0 inline-flex items-center gap-1'}>
                {TYPE_GLYPH[type] && <PixelIcon name={TYPE_GLYPH[type]} size={10} color={TYPE_COLOR[type]} />}
                {type}
              </span>
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
              onClick={() => setModalOpen(true)}
              aria-label="View activity details"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ActivityDetailModal activity={activity} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

// ── Strava activities card ────────────────────────────────────────────────────
// Fetches recent activities from Strava and lets the user import them to Dexie.
// TODO: /tmp on Render's free tier is wiped on redeploy, so the OAuth token is
// lost after each deploy. Re-run GET /auth/strava after redeploying until
// persistent token storage is added.

const COLLAPSED_KEY     = 'strava-activities-collapsed';
const SHOW_IMPORTED_KEY = 'strava-activities-show-imported';

export function StravaActivitiesCard({ defaultUser }) {
  const [phase,        setPhase]        = useState('loading'); // loading | ready | importing | done | error | disconnected
  const [activities,   setActivities]   = useState([]);
  const [selected,     setSelected]     = useState(new Set());
  const [dismissed,    setDismissed]    = useState(new Set()); // stravaIds individually hidden via × button
  const [result,       setResult]       = useState(null);
  const [errMsg,       setErrMsg]       = useState('');
  // Persist collapsed + showImported to localStorage so they survive reload.
  const [collapsed,    setCollapsed]    = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  const [showImported, setShowImported] = useState(() => localStorage.getItem(SHOW_IMPORTED_KEY) === 'true');

  function toggleCollapsed() {
    setCollapsed(c => {
      localStorage.setItem(COLLAPSED_KEY, String(!c));
      return !c;
    });
  }

  function toggleShowImported() {
    setShowImported(s => {
      localStorage.setItem(SHOW_IMPORTED_KEY, String(!s));
      return !s;
    });
  }

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

  // Activities hidden by the global "imported" filter (separate from individually dismissed)
  const importedCount     = activities.filter(a => a._status === 'duplicate').length;
  const visibleActivities = activities.filter(a =>
    !dismissed.has(a.stravaId) && (showImported || a._status !== 'duplicate')
  );
  const selectedCount = selected.size;
  const hasNew        = visibleActivities.some(a => a._status === 'new');

  return (
    <div className="card">
      {/* ── Header row — always visible, clicking title toggles collapse ── */}
      <div className="flex items-center justify-between mb-2">
        <button
          className="flex items-center gap-2 flex-1 text-left"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand Strava activities' : 'Collapse Strava activities'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <Activity size={16} className="text-orange-400" />
          <span className="section-label mb-0">Strava — recent activities</span>
          {collapsed
            ? <ChevronDown size={13} className="text-slate-500 ml-1" />
            : <ChevronUp   size={13} className="text-slate-500 ml-1" />
          }
        </button>

        {/* Right-side controls — only when not collapsed */}
        {!collapsed && (
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {/* Show/hide imported toggle */}
            {importedCount > 0 && (phase === 'ready' || phase === 'done') && (
              <button
                className="btn-icon"
                onClick={toggleShowImported}
                title={showImported ? 'Hide imported activities' : `Show ${importedCount} imported`}
                aria-label={showImported ? 'Hide imported' : 'Show imported'}
              >
                {showImported ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            )}
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
        )}
      </div>

      {/* ── Body — hidden when collapsed ── */}
      {!collapsed && (
        <>
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

              {/* Activity list — indices preserved for selection; both filters applied */}
              <div>
                {activities.map((a, i) => {
                  if (dismissed.has(a.stravaId)) return null;
                  if (!showImported && a._status === 'duplicate') return null;
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

              {/* Footer: individually-dismissed rows */}
              {dismissed.size > 0 && (
                <p className="text-xs text-slate-600 mt-2">
                  {dismissed.size} {dismissed.size === 1 ? 'activity' : 'activities'} dismissed ·{' '}
                  <button
                    className="underline hover:text-slate-400 transition-colors"
                    onClick={() => setDismissed(new Set())}
                  >
                    restore
                  </button>
                </p>
              )}
              {/* Footer: count hidden by the imported filter */}
              {!showImported && importedCount > 0 && (
                <p className="text-xs text-slate-600 mt-2">
                  {importedCount} already-imported {importedCount === 1 ? 'activity' : 'activities'} hidden ·{' '}
                  <button
                    className="underline hover:text-slate-400 transition-colors"
                    onClick={toggleShowImported}
                  >
                    show
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
        </>
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
