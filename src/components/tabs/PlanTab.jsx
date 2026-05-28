import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRuns } from '../../hooks/useRuns';
import { plan16, getMiles, getActualMilesForWeek } from '../../lib/plan';
import WeekGrid from '../WeekGrid';
import MileageChart from '../MileageChart';

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${accent || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function PlanTab() {
  const [week, setWeek] = useState(1);
  const runs = useRuns();

  const weekData    = plan16[week - 1];
  const planned     = getMiles(weekData);
  const actual      = getActualMilesForWeek(week, runs);
  const total       = runs.reduce((s, r) => s + r.dist, 0);
  const plannedThru = plan16.slice(0, week).reduce((s, w) => s + getMiles(w), 0);
  const completion  = plannedThru > 0
    ? Math.min(100, Math.round((total / plannedThru) * 100))
    : 0;

  return (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MetricCard
          label="Viewing week"
          value={week}
          sub="of 16"
        />
        <MetricCard
          label="This week"
          value={actual.toFixed(1)}
          sub={`of ${planned} mi planned`}
          accent={actual >= planned && planned > 0 ? 'text-emerald-400' : 'text-white'}
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
