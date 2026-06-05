import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Trash2 } from '../../icons/PixelIcons';
import { db } from '../../db';
import { useRunners } from '../../hooks/useRunners';
import { useRuns } from '../../hooks/useRuns';
import { RUNNER_COLORS } from '../../lib/plan';
import { paceDecimal } from '../../lib/pace';

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

// ── Metric calculations ───────────────────────────────────────────────────────

function weekStart(date) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function calcMetrics(runner, runs) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Weekly mileage — current week
  const thisWeek = weekStart(today);
  const weeklyMiles = runs
    .filter(r => r.user === runner.name && weekStart(r.date) === thisWeek)
    .reduce((s, r) => s + r.dist, 0);

  // Longest run — rolling 30 days
  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cut30Str = cutoff30.toISOString().slice(0, 10);
  const longestRun = runs
    .filter(r => r.user === runner.name && r.date >= cut30Str && r.type !== 'Cross-train')
    .reduce((max, r) => Math.max(max, r.dist), 0);

  // Training streak — consecutive days ending today with any activity
  const activityDates = new Set(
    runs.filter(r => r.user === runner.name).map(r => r.date)
  );
  let streak = 0;
  const check = new Date(now);
  while (true) {
    const ds = check.toISOString().slice(0, 10);
    if (activityDates.has(ds)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  // Avg pace improvement — compare last 4 weeks vs prev 4 weeks (lower = faster = better)
  const cut8 = new Date(now); cut8.setDate(cut8.getDate() - 56);
  const cut4 = new Date(now); cut4.setDate(cut4.getDate() - 28);
  const cut8Str = cut8.toISOString().slice(0, 10);
  const cut4Str = cut4.toISOString().slice(0, 10);

  const runRuns = runs.filter(r => r.user === runner.name && r.type !== 'Cross-train' && r.dist > 0 && r.dur > 0);
  const recent  = runRuns.filter(r => r.date >= cut4Str);
  const prior   = runRuns.filter(r => r.date >= cut8Str && r.date < cut4Str);

  const avgPace = (arr) => arr.length
    ? arr.reduce((s, r) => s + paceDecimal(r.dist, r.dur), 0) / arr.length
    : null;

  const recentPace = avgPace(recent);
  const priorPace  = avgPace(prior);
  // Improvement = prior - recent (positive = got faster)
  const paceImprovement = recentPace != null && priorPace != null
    ? parseFloat((priorPace - recentPace).toFixed(2))
    : 0;

  return { weeklyMiles, longestRun, streak, paceImprovement };
}

// ── Metric config ─────────────────────────────────────────────────────────────

const METRICS = [
  {
    key:   'weeklyMiles',
    label: 'Weekly mileage',
    fmt:   v => `${v.toFixed(1)} mi`,
    desc:  'Miles logged this week',
  },
  {
    key:   'longestRun',
    label: 'Longest run',
    fmt:   v => `${v.toFixed(1)} mi`,
    desc:  'Rolling 30 days',
  },
  {
    key:   'streak',
    label: 'Streak',
    fmt:   v => `${v}d`,
    desc:  'Consecutive active days',
  },
  {
    key:   'paceImprovement',
    label: 'Pace improvement',
    fmt:   v => v >= 0 ? `+${v.toFixed(2)} min/mi` : `${v.toFixed(2)} min/mi`,
    desc:  'vs prior 4-week avg (positive = faster)',
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamTab() {
  const runners = useRunners();
  const runs    = useRuns();
  const [name,       setName]       = useState('');
  const [error,      setError]      = useState('');
  const [activeKey,  setActiveKey]  = useState('weeklyMiles');

  const metric = METRICS.find(m => m.key === activeKey);

  const ranked = runners
    .map(r => ({ runner: r, metrics: calcMetrics(r, runs) }))
    .sort((a, b) => {
      const va = a.metrics[activeKey];
      const vb = b.metrics[activeKey];
      // For paceImprovement: higher = more improved = better
      return vb - va;
    });

  const maxVal = ranked.reduce((m, e) => Math.max(m, Math.abs(e.metrics[activeKey])), 0.001);

  async function addRunner() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a name.'); return; }
    if (runners.find(r => r.name === trimmed)) { setError('Runner already exists.'); return; }
    const initials = trimmed.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const color    = RUNNER_COLORS[runners.length % RUNNER_COLORS.length];
    await db.runners.add({ name: trimmed, initials, color });
    setName('');
    setError('');
  }

  async function removeRunner(id, runnerName) {
    if (!confirm(`Remove ${runnerName}? Their runs will remain in the log.`)) return;
    await db.runners.delete(id);
  }

  return (
    <div>
      {/* Add runner */}
      <div className="card">
        <div className="section-label">Add a runner</div>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              className="field"
              placeholder="e.g. Alex"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRunner()}
            />
          </div>
          <button className="btn" onClick={addRunner}>
            <UserPlus size={14} /> Add
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      {/* Metric selector */}
      <div className="card">
        <div className="section-label">Leaderboard</div>
        <div className="flex gap-2 flex-wrap mb-4">
          {METRICS.map(m => (
            <button
              key={m.key}
              className={activeKey === m.key ? 'btn text-xs py-1 px-2.5' : 'btn-ghost text-xs py-1 px-2.5'}
              onClick={() => setActiveKey(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{metric.desc}</p>

        {ranked.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">No runners yet</div>
        ) : (
          <div className="space-y-2">
            {ranked.map(({ runner: r, metrics }, i) => {
              const val = metrics[activeKey];
              const pct = maxVal > 0 ? Math.max(0, (Math.abs(val) / maxVal) * 100) : 0;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3"
                >
                  <div className="text-base w-7 text-center">{medal(i + 1)}</div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: `${r.color}22`, color: r.color }}
                  >
                    {r.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{r.name}</div>
                    <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: r.color }}
                      />
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold text-right flex-shrink-0"
                    style={{ color: r.color, minWidth: 72 }}
                  >
                    {metric.fmt(val)}
                  </div>
                  {runners.length > 1 && (
                    <button
                      className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                      onClick={() => removeRunner(r.id, r.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
