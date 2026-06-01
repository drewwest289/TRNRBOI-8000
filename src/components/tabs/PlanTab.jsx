import { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useRuns } from '../../hooks/useRuns';
import { plan16, getMiles, getActualMilesForWeek } from '../../lib/plan';
import WeekGrid from '../WeekGrid';
import MileageChart from '../MileageChart';
import PlanSettings from '../PlanSettings';

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

/**
 * PlanTab receives the `plan` object from App (via useTrainingPlan) so the
 * race countdown in the header and the week calculation here share one source
 * of truth without prop-drilling through multiple layers.
 *
 * plan: { startStr, raceStr, currentWeek, daysUntilRace, saveStart, saveRace }
 */
export default function PlanTab({ plan }) {
  const { startStr, raceStr, currentWeek, saveStart, saveRace } = plan;

  // `week` is the week currently being *viewed* — starts at the calculated
  // current week, but the user can navigate away with the arrows.
  const [week,         setWeek]         = useState(() => currentWeek ?? 1);
  const [showSettings, setShowSettings] = useState(false);

  const runs = useRuns();

  // After saving new plan dates, jump the view to the recalculated current week.
  function handleSave(newStart, newRace) {
    saveStart(newStart);
    saveRace(newRace);

    // Compute the new current week immediately (can't wait for state to flush).
    const start = new Date(newStart + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days  = Math.floor((today - start) / 86_400_000);
    const newWeek = Math.min(16, Math.max(1, Math.floor(days / 7) + 1));
    setWeek(newWeek);
    setShowSettings(false);
  }

  // ── No start date configured — show setup prompt instead of the plan ──────

  if (!startStr) {
    return (
      <div>
        <div className="card mb-4 border-emerald-800/50">
          <p className="text-sm text-slate-300 mb-1">Welcome to TRNRBOI 8000 🏃</p>
          <p className="text-xs text-slate-500">
            Set your training start date and race date to anchor the 16-week plan
            to your real calendar. The current week and race countdown will be
            calculated automatically from that point forward.
          </p>
        </div>
        <PlanSettings
          startStr={null}
          raceStr={null}
          onSave={handleSave}
          // No onCancel — the user must set dates before seeing the plan.
        />
      </div>
    );
  }

  // ── Plan configured ───────────────────────────────────────────────────────

  const weekData       = plan16[week - 1];
  const planned        = getMiles(weekData);
  // Metric cards use the *current* week's data, not the viewed week.
  const currentWeekData   = plan16[(currentWeek ?? 1) - 1];
  const currentPlanned    = getMiles(currentWeekData);
  const currentActual     = getActualMilesForWeek(currentWeek ?? 1, runs);
  const total             = runs.reduce((s, r) => s + r.dist, 0);
  const plannedThru       = plan16.slice(0, currentWeek ?? 1).reduce((s, w) => s + getMiles(w), 0);
  const completion        = plannedThru > 0
    ? Math.min(100, Math.round((total / plannedThru) * 100))
    : 0;

  return (
    <div>
      {/* Settings panel (toggled via gear icon) */}
      {showSettings && (
        <PlanSettings
          startStr={startStr}
          raceStr={raceStr}
          onSave={handleSave}
          onCancel={() => setShowSettings(false)}
        />
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Current week"
          value={currentWeek}
          sub="of 16"
        />
        <MetricCard
          label="This week"
          value={currentActual.toFixed(1)}
          sub={`of ${currentPlanned} mi planned`}
          accent={currentActual >= currentPlanned && currentPlanned > 0 ? 'text-emerald-400' : 'text-white'}
        />
        <MetricCard
          label="Total logged"
          value={total.toFixed(1)}
          sub="miles"
        />
        <MetricCard
          label="Completion"
          value={`${completion}%`}
          sub="plan runs done"
          accent={completion >= 80 ? 'text-emerald-400' : 'text-white'}
        />
      </div>

      {/* Week navigation + grid */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="section-label mb-0">Week schedule</div>
          <div className="flex items-center gap-2">
            {/* Settings gear */}
            <button
              className="btn-icon"
              onClick={() => setShowSettings(s => !s)}
              aria-label="Plan settings"
              title="Edit training dates"
            >
              <Settings size={14} />
            </button>

            {/* Jump to today — shown when viewing a different week */}
            {week !== currentWeek && currentWeek !== null && (
              <button
                className="btn-ghost text-xs"
                onClick={() => setWeek(currentWeek)}
              >
                Today
              </button>
            )}

            <button
              className="btn-icon"
              onClick={() => setWeek(w => Math.max(1, w - 1))}
              disabled={week === 1}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-white w-16 text-center">
              Week {week}
            </span>
            <button
              className="btn-icon"
              onClick={() => setWeek(w => Math.min(16, w + 1))}
              disabled={week === 16}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <WeekGrid week={week} runs={runs} />

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { color: '#1D9E75', label: 'Easy' },
            { color: '#7F77DD', label: 'Long' },
            { color: '#378ADD', label: 'Cross' },
            { color: '#BA7517', label: 'Tempo / Interval' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 16-week overview chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="section-label mb-0">16-week mileage overview</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(29,158,117,0.25)' }} />
              <span className="text-xs text-slate-500">Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-emerald-500" />
              <span className="text-xs text-slate-500">Logged</span>
            </div>
          </div>
        </div>
        <MileageChart runs={runs} currentWeek={week} />
      </div>
    </div>
  );
}
