import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Trash2 } from '../../icons/PixelIcons';
import { db } from '../../db';
import { useRunners } from '../../hooks/useRunners';
import { useRuns } from '../../hooks/useRuns';
import { RUNNER_COLORS } from '../../lib/plan';

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function TeamTab() {
  const runners = useRunners();
  const runs    = useRuns();
  const [name, setName]   = useState('');
  const [error, setError] = useState('');

  const totals = {};
  runners.forEach(r => { totals[r.name] = 0; });
  runs.forEach(r => { if (totals[r.name] !== undefined) totals[r.name] += r.dist; });

  const maxMiles = Math.max(...Object.values(totals), 1);
  const sorted   = [...runners].sort((a, b) => (totals[b.name] || 0) - (totals[a.name] || 0));

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

      {/* Leaderboard */}
      <div className="card">
        <div className="section-label">Team leaderboard</div>
        {sorted.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">No runners yet</div>
        ) : (
          <div className="space-y-2">
            {sorted.map((r, i) => {
              const miles = totals[r.name] || 0;
              const pct   = (miles / maxMiles) * 100;
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
                  <div className="text-sm font-semibold text-white w-16 text-right">
                    {miles.toFixed(1)} mi
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
