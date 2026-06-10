import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Settings } from '../../icons/PixelIcons';
import { useActivities } from '../../hooks/useActivities';
import { usePlanOverrides } from '../../hooks/usePlanOverrides';
import { getPlanWeek, getMiles, getActualMilesForWeek } from '../../lib/plan';
import { TOKENS } from '../../lib/colors';
import WeekGrid from '../WeekGrid';
import MileageChart from '../MileageChart';
import PlanSettings from '../PlanSettings';
import DayDrawer from '../DayDrawer';

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div
        className="text-2xl font-semibold"
        style={{
          fontFamily: '"Press Start 2P", monospace',
          color: accent ? TOKENS.green : 'var(--green)',
        }}
      >
        {value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
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
  const { startStr, raceStr, currentWeek, totalWeeks, ability, saveStart, saveRace, saveAbility } = plan;

  // `week` is the week currently being *viewed* — starts at the calculated
  // current week, but the user can navigate away with the arrows.
  const [week,         setWeek]         = useState(() => currentWeek ?? 1);
  const [showSettings, setShowSettings] = useState(false);
  const [drawerDay,    setDrawerDay]    = useState(null); // { dateStr, dayStr, logs }

  const activities    = useActivities();
  const planOverrides = usePlanOverrides();

  // After saving new plan dates, jump the view to the recalculated current week.
  function handleSave(newStart, newRace) {
    saveStart(newStart);
    saveRace(newRace);

    // Compute the new current week immediately (can't wait for state to flush).
    const start = new Date(newStart + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days  = Math.floor((today - start) / 86_400_000);
    let newTotal = 16;
    if (newRace) {
      const daysToRace = Math.ceil((new Date(newRace + 'T00:00:00') - today) / 86_400_000);
      if (daysToRace > 0) newTotal = Math.max(16, Math.ceil(daysToRace / 7));
    }
    const newWeek = Math.min(newTotal, Math.max(1, Math.floor(days / 7) + 1));
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
          raceStr={raceStr}
          onSave={handleSave}
          ability={ability}
          onAbilityChange={saveAbility}
          // No onCancel — the user must set dates before seeing the plan.
        />
      </div>
    );
  }

  // ── Plan configured ───────────────────────────────────────────────────────

  const weekData       = getPlanWeek(week, totalWeeks, ability);
  const planned        = getMiles(weekData);
  // Metric cards use the *current* week's data, not the viewed week.
  const currentWeekData   = getPlanWeek(currentWeek ?? 1, totalWeeks, ability);
  const currentPlanned    = getMiles(currentWeekData);
  const currentActual     = getActualMilesForWeek(currentWeek ?? 1, activities);
  const total             = activities.reduce((s, r) => s + r.distMi, 0);
  const plannedThru       = Array.from({ length: currentWeek ?? 1 }, (_, i) => getPlanWeek(i + 1, totalWeeks, ability))
    .reduce((s, w) => s + getMiles(w), 0);
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
          ability={ability}
          onAbilityChange={saveAbility}
        />
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Current week"
          value={currentWeek}
          sub={`of ${totalWeeks}`}
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
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="section-label mb-0">Week schedule</div>
          <div className="flex items-center gap-2 flex-wrap">
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
              onClick={() => setWeek(w => Math.min(totalWeeks, w + 1))}
              disabled={week === totalWeeks}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <WeekGrid
          week={week}
          runs={activities}
          planOverrides={planOverrides}
          totalWeeks={totalWeeks}
          ability={ability}
          onDayClick={(dateStr, dayStr, logs) => setDrawerDay({ dateStr, dayStr, logs })}
        />

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { color: TOKENS.green,  label: 'EASY' },
            { color: TOKENS.purple, label: 'LONG' },
            { color: TOKENS.blue,   label: 'CROSS' },
            { color: TOKENS.red,    label: 'TEMPO / INTV' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5" style={{ backgroundColor: color }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mileage overview chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="section-label mb-0">{totalWeeks}-week mileage overview</div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2" style={{ backgroundColor: 'rgba(124,255,158,0.25)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>PLANNED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2" style={{ backgroundColor: TOKENS.green }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>GOAL MET</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2" style={{ backgroundColor: TOKENS.red }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>GOAL MISSED</span>
            </div>
          </div>
        </div>
        <MileageChart runs={activities} currentWeek={week} totalWeeks={totalWeeks} ability={ability} />
      </div>

      {/* Day detail drawer */}
      {drawerDay && (
        <DayDrawer
          dateStr={drawerDay.dateStr}
          dayStr={drawerDay.dayStr}
          logs={drawerDay.logs}
          onClose={() => setDrawerDay(null)}
        />
      )}
    </div>
  );
}
