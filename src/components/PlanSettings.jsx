import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { X } from '../icons/PixelIcons';

const ABILITIES = [
  { key: 'beginner',     label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced',     label: 'Advanced' },
];

function addWeeks(dateStr, n) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d); // local midnight — no UTC shift
  date.setDate(date.getDate() + n * 7);
  // Format back to YYYY-MM-DD using local getters (not toISOString which is UTC)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Inline settings card for training start date, race date, and skill level.
 *
 * Props:
 *   startStr  — current YYYY-MM-DD start date string, or null
 *   raceStr   — current YYYY-MM-DD race date string, or null
 *   onSave(startStr, raceStr) — called when user saves
 *   onCancel  — called when user dismisses (omit to hide cancel button, e.g. on first setup)
 *   ability   — current ability key ('beginner' | 'intermediate' | 'advanced'), or null to hide the field
 *   onAbilityChange(key) — called immediately when the user picks a different level
 */
export default function PlanSettings({ startStr, raceStr, onSave, onCancel, ability, onAbilityChange }) {
  const [start,      setStart]      = useState(startStr ?? '');
  const [race,       setRace]       = useState(raceStr ?? (startStr ? addWeeks(startStr, 16) : ''));
  // True only when the stored race date differs from the auto-computed start+16w, meaning the user
  // deliberately picked a different date. If they match, treat as unedited so changing start date
  // still auto-updates the race date.
  const autoRace = startStr ? addWeeks(startStr, 16) : '';
  const [raceEdited, setRaceEdited] = useState(!!raceStr && raceStr !== autoRace);

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

        {ability != null && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Skill level
            </label>
            <select
              className="field"
              value={ability}
              onChange={e => onAbilityChange?.(e.target.value)}
            >
              {ABILITIES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
            <p className="text-xs text-slate-600 mt-1">
              Calibrates default workout intensities across the plan.
            </p>
          </div>
        )}
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
