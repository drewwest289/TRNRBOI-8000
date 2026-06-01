import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

function addWeeks(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().substring(0, 10);
}

/**
 * Inline settings card for training start date and race date.
 *
 * Props:
 *   startStr  — current YYYY-MM-DD start date string, or null
 *   raceStr   — current YYYY-MM-DD race date string, or null
 *   onSave(startStr, raceStr) — called when user saves
 *   onCancel  — called when user dismisses (omit to hide cancel button, e.g. on first setup)
 */
export default function PlanSettings({ startStr, raceStr, onSave, onCancel }) {
  const [start,      setStart]      = useState(startStr ?? '');
  const [race,       setRace]       = useState(raceStr ?? (startStr ? addWeeks(startStr, 16) : ''));
  const [raceEdited, setRaceEdited] = useState(!!raceStr); // true once user manually changes race date

  function handleStartChange(val) {
    setStart(val);
    // Auto-fill race date only if the user hasn't manually overridden it.
    if (!raceEdited) setRace(addWeeks(val, 16));
  }

  function handleRaceChange(val) {
    setRace(val);
    setRaceEdited(true);
  }

  function handleSave() {
    if (!start) return;
    onSave(start, race || addWeeks(start, 16));
  }

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-emerald-400" />
          <span className="section-label mb-0">Training plan dates</span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Training start date
          </label>
          <input
            type="date"
            className="field"
            value={start}
            onChange={e => handleStartChange(e.target.value)}
          />
          <p className="text-xs text-slate-600 mt-1">
            The first day of Week 1 — the current week is calculated from this.
          </p>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Race date
          </label>
          <input
            type="date"
            className="field"
            value={race}
            onChange={e => handleRaceChange(e.target.value)}
          />
          <p className="text-xs text-slate-600 mt-1">
            Auto-set to 16 weeks from start — override if your race date differs.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-5">
        <button className="btn" onClick={handleSave} disabled={!start}>
          Save dates
        </button>
        {onCancel && (
          <button className="btn-ghost text-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
