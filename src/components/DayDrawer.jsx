import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { X, Trash2, Pencil } from '../icons/PixelIcons';
import ActivityDetailModal from './ActivityDetailModal';
import { useAuth } from '../hooks/useAuth';
import { addRun, deleteRun } from '../hooks/useRuns';
import { setPlanOverride } from '../hooks/usePlanOverrides';
import { paceStr } from '../lib/pace';
import { getDayType, getDayMiles, localDateStr } from '../lib/plan';
import { TYPE_COLOR } from '../lib/colors';

// ── Constants ─────────────────────────────────────────────────────────────────

const RUN_TYPES   = ['Easy', 'Tempo', 'Long run', 'Intervals', 'Cross-train'];
const CROSS_TYPES = ['Bike', 'Swim', 'Strength', 'Walk', 'Other'];

const LOG_TO_PLAN = {
  'Easy': 'easy', 'Tempo': 'tempo', 'Long run': 'long',
  'Intervals': 'interval', 'Cross-train': 'cross',
};

/** Map plan day type → default log type */
const PLAN_TO_LOG = {
  easy: 'Easy', tempo: 'Tempo', long: 'Long run',
  interval: 'Intervals', cross: 'Cross-train', race: 'Easy', rest: 'Easy',
};

/** Parse YYYY-MM-DD to a local-midnight Date without UTC timezone shift */
function parseLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format YYYY-MM-DD as "Monday, Jun 2" */
function longDate(str) {
  return parseLocal(str).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

/** Format YYYY-MM-DD as "Mon Jun 2" (for defer picker options) */
function shortDate(str) {
  return parseLocal(str).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** Return all 7 YYYY-MM-DD strings for the week containing dateStr */
function getWeekDates(dateStr) {
  const date = parseLocal(dateStr);
  const sun  = new Date(date);
  sun.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    return localDateStr(d);
  });
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

/** Stats view — shown when run(s) are already logged for the day */
function StatsView({ logs, onEdit, onDelete, onBack }) {
  const [detailRun, setDetailRun] = useState(null);

  return (
    <div>
      {detailRun && (
        <ActivityDetailModal
          activity={{
            name:     detailRun.notes || `${detailRun.type} run`,
            date:     detailRun.date,
            distMi:   detailRun.dist,
            durMin:   detailRun.dur,
            hr:       null,
            notes:    detailRun.notes,
            stravaId: detailRun.strava_id ?? detailRun.stravaId ?? null,
          }}
          onClose={() => setDetailRun(null)}
        />
      )}

      {logs.map((r, idx) => {
        const color = TYPE_COLOR[r.type] || '#64748b';
        const pace  = paceStr(r.dist, r.dur);
        return (
          <div key={r.id ?? idx} className={`${idx > 0 ? 'mt-4 pt-4 border-t border-slate-800' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ color, backgroundColor: `${color}22` }}
              >
                {r.type}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="btn-ghost text-xs"
                  onClick={() => setDetailRun(r)}
                  aria-label="View details"
                >
                  Details
                </button>
                {r.type !== 'Rest' && (
                  <button
                    className="btn-icon"
                    onClick={() => onEdit(r)}
                    aria-label="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                )}
                <button
                  className="btn-icon text-slate-500 hover:text-red-400"
                  onClick={() => onDelete(r)}
                  aria-label="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {r.type === 'Rest' ? (
              <p className="text-sm text-slate-400">
                {r.notes || 'Marked as rest / skipped'}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-white">{r.dist?.toFixed(2)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">miles</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-white">{pace}</div>
                  <div className="text-xs text-slate-500 mt-0.5">/mi pace</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-white">{r.dur}</div>
                  <div className="text-xs text-slate-500 mt-0.5">min</div>
                </div>
              </div>
            )}
            {r.notes && r.type !== 'Rest' && (
              <p className="text-xs text-slate-400 mt-1">📝 {r.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Run log form — used for both "log run" and "edit run" */
function RunForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [err, setErr] = useState('');

  function handleSave() {
    const dist = parseFloat(form.dist);
    const dur  = parseInt(form.dur, 10);
    if (!form.date || isNaN(dist) || dist <= 0 || isNaN(dur) || dur <= 0) {
      setErr('Date, distance, and duration are required.');
      return;
    }
    onSave({ ...form, dist, dur });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Distance (mi)</label>
          <input
            type="number" className="field" placeholder="3.1" step="0.1" min="0"
            value={form.dist}
            onChange={e => { setErr(''); set('dist', e.target.value); }}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Duration (min)</label>
          <input
            type="number" className="field" placeholder="30" step="1" min="0"
            value={form.dur}
            onChange={e => { setErr(''); set('dur', e.target.value); }}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Type</label>
        <select className="field" value={form.type} onChange={e => set('type', e.target.value)}>
          {RUN_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes</label>
        <input
          type="text" className="field" placeholder="How did it feel?"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button className="btn" onClick={handleSave}>Save</button>
        <button className="btn-ghost text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Cross-train log form */
function CrossForm({ dateStr, user, onSave, onCancel }) {
  const [activity, setActivity] = useState('Bike');
  const [dur,      setDur]      = useState('');
  const [notes,    setNotes]    = useState('');
  const [err,      setErr]      = useState('');

  function handleSave() {
    const d = parseInt(dur, 10);
    if (isNaN(d) || d <= 0) { setErr('Duration is required.'); return; }
    onSave({
      user, date: dateStr, type: 'Cross-train', dist: 0, dur: d,
      notes: [activity, notes].filter(Boolean).join(' — '),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Activity</label>
        <select className="field" value={activity} onChange={e => setActivity(e.target.value)}>
          {CROSS_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Duration (min)</label>
        <input
          type="number" className="field" placeholder="45" step="1" min="0"
          value={dur}
          onChange={e => { setErr(''); setDur(e.target.value); }}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Notes</label>
        <input
          type="text" className="field" placeholder="Optional notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button className="btn" onClick={handleSave}>Save</button>
        <button className="btn-ghost text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Defer-to picker — shows the other 6 days in the same week */
function DeferView({ dateStr, dayStr, user, onSave, onCancel }) {
  const weekDates  = getWeekDates(dateStr).filter(d => d !== dateStr);
  const [target, setTarget] = useState(weekDates[0] ?? '');

  function handleDefer() {
    if (!target) return;
    onSave(target);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Move this planned workout to another day this week. A rest marker will be added
        to today; the target day will show this workout as a reference.
      </p>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Defer to</label>
        <select className="field" value={target} onChange={e => setTarget(e.target.value)}>
          {weekDates.map(d => (
            <option key={d} value={d}>{shortDate(d)}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button className="btn" onClick={handleDefer}>Defer workout</button>
        <button className="btn-ghost text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** Plan a run form — saves an override via the API */
function PlanRunForm({ dateStr, planType, plannedMi, onSave, onCancel }) {
  const defaultType = RUN_TYPES.find(t => LOG_TO_PLAN[t] === planType) || 'Easy';
  const [type, setType] = useState(defaultType);
  const [dist, setDist] = useState(plannedMi ? String(plannedMi) : '');
  const [err,  setErr]  = useState('');

  function handleSave() {
    const d = parseFloat(dist);
    if (isNaN(d) || d <= 0) { setErr('Distance is required.'); return; }
    const prefix = LOG_TO_PLAN[type] || 'easy';
    onSave(`${prefix} ${d}`);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Type</label>
        <select className="field" value={type} onChange={e => setType(e.target.value)}>
          {RUN_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Distance (mi)</label>
        <input
          type="number" className="field" placeholder="3.1" step="0.1" min="0"
          value={dist}
          onChange={e => { setErr(''); setDist(e.target.value); }}
        />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button className="btn" onClick={handleSave}>Save</button>
        <button className="btn-ghost text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main DayDrawer ────────────────────────────────────────────────────────────

/**
 * Bottom-sheet drawer for a single plan day.
 *
 * Props:
 *   dateStr  — YYYY-MM-DD
 *   dayStr   — plan day string, e.g. "easy 3"
 *   logs     — array of Dexie run records for this date (may be empty)
 *   onClose  — close callback
 */
export default function DayDrawer({ dateStr, dayStr, logs, onClose }) {
  const { user }    = useAuth();
  const defaultUser = user?.name || 'Me';

  const planType    = getDayType(dayStr);   // e.g. 'easy'
  const plannedMi   = getDayMiles(dayStr);  // e.g. 3

  const hasActiveLog = logs.some(l => l.type !== 'Rest');
  const hasRestLog   = logs.length > 0 && !hasActiveLog;

  // Determine initial view
  const initialView = hasActiveLog ? 'stats'
    : hasRestLog                   ? 'stats'
    :                                'menu';

  const [view,    setView]    = useState(initialView);
  const [editing, setEditing] = useState(null); // run record being edited

  // ── DB operations ────────────────────────────────────────────────────────

  async function handleAddRun(fields) {
    await addRun({ user: defaultUser, ...fields });
    onClose();
  }

  async function saveEdit(fields) {
    // Delete + re-add since the API has no PATCH route.
    await deleteRun(editing.id);
    await addRun({
      user: defaultUser, date: editing.date,
      dist: parseFloat(fields.dist),
      dur:  parseInt(fields.dur, 10),
      type: fields.type,
      notes: fields.notes,
    });
    onClose();
  }

  async function handleDeleteRun(r) {
    if (!confirm(`Delete this ${r.type.toLowerCase()} entry?`)) return;
    await deleteRun(r.id);
    onClose();
  }

  async function markRest(note = '') {
    await addRun({ user: defaultUser, date: dateStr, type: 'Rest', dist: 0, dur: 0, notes: note });
    onClose();
  }

  async function savePlanOverride(dayStr) {
    await setPlanOverride(dateStr, dayStr);
    onClose();
  }

  async function handleDefer(targetDate) {
    await addRun({
      user: defaultUser, date: dateStr, type: 'Rest', dist: 0, dur: 0,
      notes: `Deferred to ${shortDate(targetDate)}`,
    });
    await addRun({
      user: defaultUser, date: targetDate,
      type: PLAN_TO_LOG[planType] || 'Easy',
      dist: plannedMi || 0, dur: 0,
      notes: `Deferred from ${shortDate(dateStr)} — update with actual`,
    });
    onClose();
  }

  // ── Header helpers ───────────────────────────────────────────────────────

  const viewTitle = {
    stats:      longDate(dateStr),
    menu:       longDate(dateStr),
    'log-run':  'Log a run',
    'log-cross':'Log cross-training',
    'plan-run': 'Plan a run',
    defer:      'Defer workout',
    edit:       'Edit entry',
  };

  const canGoBack = ['log-run', 'log-cross', 'plan-run', 'defer', 'edit'].includes(view);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl
                   max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-4" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                className="text-slate-400 hover:text-white transition-colors mr-1"
                onClick={() => setView(logs.length > 0 ? 'stats' : 'menu')}
                aria-label="Back"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-white">{viewTitle[view]}</h2>
              {(view === 'stats' || view === 'menu') && (
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {planType === 'rest' ? 'Rest day' : `${planType}${plannedMi ? ` · ${plannedMi} mi planned` : ''}`}
                </p>
              )}
            </div>
          </div>
          <button
            className="text-slate-500 hover:text-white transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-8">

          {/* ── STATS ── */}
          {view === 'stats' && (
            <StatsView
              logs={logs}
              onEdit={r => { setEditing(r); setView('edit'); }}
              onDelete={handleDeleteRun}
              onBack={() => setView('menu')}
            />
          )}

          {/* ── ACTION MENU ── */}
          {view === 'menu' && (
            <div className="space-y-2">
              <button
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700
                           transition-colors text-sm font-medium text-white"
                onClick={() => setView('log-run')}
              >
                Log a run
                {planType !== 'rest' && plannedMi > 0 && (
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    {plannedMi} mi {planType} planned
                  </span>
                )}
                {planType === 'rest' && (
                  <span className="text-xs text-slate-400 font-normal ml-2">rest day</span>
                )}
              </button>

              <button
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700
                           transition-colors text-sm font-medium text-white"
                onClick={() => setView('log-cross')}
              >
                Log cross-training
              </button>

              <button
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700
                           transition-colors text-sm font-medium text-slate-300"
                onClick={() => setView('plan-run')}
              >
                Add to schedule
                {planType !== 'rest' && plannedMi > 0 && (
                  <span className="text-xs text-slate-400 font-normal ml-2">override plan</span>
                )}
              </button>

              <button
                className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700
                           transition-colors text-sm font-medium text-slate-300"
                onClick={() => markRest()}
              >
                Mark as rest / skipped
              </button>

              {planType !== 'rest' && (
                <button
                  className="w-full text-left px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700
                             transition-colors text-sm font-medium text-slate-300"
                  onClick={() => setView('defer')}
                >
                  Defer to another day
                </button>
              )}
            </div>
          )}

          {/* ── LOG RUN ── */}
          {view === 'log-run' && (
            <RunForm
              initial={{
                date:  dateStr,
                dist:  plannedMi || '',
                dur:   '',
                type:  PLAN_TO_LOG[planType] || 'Easy',
                notes: '',
              }}
              onSave={fields => handleAddRun({ date: dateStr, ...fields })}
              onCancel={() => setView('menu')}
            />
          )}

          {/* ── LOG CROSS-TRAIN ── */}
          {view === 'log-cross' && (
            <CrossForm
              dateStr={dateStr}
              user={defaultUser}
              onSave={handleAddRun}
              onCancel={() => setView('menu')}
            />
          )}

          {/* ── PLAN RUN ── */}
          {view === 'plan-run' && (
            <PlanRunForm
              dateStr={dateStr}
              planType={planType}
              plannedMi={plannedMi}
              onSave={savePlanOverride}
              onCancel={() => setView('menu')}
            />
          )}

          {/* ── EDIT ── */}
          {view === 'edit' && editing && (
            <RunForm
              initial={{
                date:  editing.date,
                dist:  String(editing.dist ?? ''),
                dur:   String(editing.dur ?? ''),
                type:  editing.type,
                notes: editing.notes ?? '',
              }}
              onSave={saveEdit}
              onCancel={() => setView('stats')}
            />
          )}

          {/* ── DEFER ── */}
          {view === 'defer' && (
            <DeferView
              dateStr={dateStr}
              dayStr={dayStr}
              user={defaultUser}
              onSave={handleDefer}
              onCancel={() => setView('menu')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
