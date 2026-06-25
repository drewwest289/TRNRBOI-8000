import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { RefreshCw } from '../../icons/PixelIcons';
import { TOKENS } from '../../lib/colors';
import ActivityDetailModal from '../ActivityDetailModal';
import { useAuth } from '../../hooks/useAuth';
import { MessageCircle } from 'lucide-react';

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
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

// Stable colours for avatars — cycle through design tokens
const AVATAR_COLORS = [
  TOKENS.green, TOKENS.blue, TOKENS.purple, TOKENS.red, TOKENS.yellow,
];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeamTab() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState(null);
  const [activeKey,   setActiveKey]   = useState('weeklyMiles');

  const [recentRuns,    setRecentRuns]    = useState(null);
  const [recentErr,     setRecentErr]     = useState(null);
  const [activeRecent,  setActiveRecent]  = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch('/api/team/leaderboard');
      setLeaderboard(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecent() {
    setRecentErr(null);
    try {
      const data = await apiFetch('/api/team/recent-runs');
      setRecentRuns(data);
    } catch (e) {
      setRecentErr(e.message);
    }
  }

  useEffect(() => { load(); loadRecent(); }, []);

  const metric = METRICS.find(m => m.key === activeKey);

  const sorted = leaderboard
    ? [...leaderboard].sort((a, b) => b.metrics[activeKey] - a.metrics[activeKey])
    : [];

  const maxVal = sorted.reduce((m, e) => Math.max(m, Math.abs(e.metrics[activeKey])), 0.001);

  return (
    <div>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="section-label mb-0">Leaderboard</div>
          <button className="btn-ghost text-xs" onClick={load} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Metric selector */}
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

        {err && (
          <p className="text-xs text-red-400 py-2">{err}</p>
        )}

        {!loading && !err && sorted.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-sm">No users found</div>
        )}

        {!err && sorted.length > 0 && (
          <div className="space-y-2">
            {sorted.map(({ id, name, metrics }, i) => {
              const val   = metrics[activeKey];
              const pct   = maxVal > 0 ? Math.max(0, (Math.abs(val) / maxVal) * 100) : 0;
              // paceImprovement is the only metric that can go negative — a long bar should
              // never read as "good" when it's actually a regression, so flag it red instead
              // of the usual rotating avatar color.
              const color = activeKey === 'paceImprovement' && val < 0
                ? TOKENS.red
                : AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3"
                >
                  <div className="text-base w-7 text-center flex-shrink-0">{medal(i + 1)}</div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{name}</div>
                    <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold text-right flex-shrink-0"
                    style={{ color, minWidth: 80 }}
                  >
                    {metric.fmt(val)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card mt-4">
        <div className="section-label mb-3">Recent team runs</div>

        {recentErr && <p className="text-xs text-red-400 py-2">{recentErr}</p>}

        {recentRuns === null && !recentErr && (
          <div className="text-center py-4 text-slate-500 text-sm">Loading…</div>
        )}

        {recentRuns?.length === 0 && (
          <div className="text-center py-4 text-slate-500 text-sm">No recent runs</div>
        )}

        {recentRuns?.length > 0 && (
          <div className="space-y-2">
            {recentRuns.map(r => (
              <button
                key={r.id}
                className="w-full flex items-center justify-between gap-3 bg-slate-800 rounded-xl px-4 py-2.5 text-left hover:bg-slate-700/60 transition-colors"
                onClick={() => setActiveRecent(r)}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                    {r.userName}
                    {r.commentCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-xs font-normal text-slate-500"
                        title={`${r.commentCount} comment${r.commentCount === 1 ? '' : 's'}`}
                      >
                        <MessageCircle size={11} />
                        {r.commentCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{r.date} · {r.type}</div>
                </div>
                <div className="text-sm font-semibold flex-shrink-0" style={{ color: TOKENS.blue }}>
                  {r.distMi.toFixed(1)} mi
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeRecent && (
        <ActivityDetailModal
          activity={{
            id:       activeRecent.id,
            name:     `${activeRecent.userName} · ${activeRecent.type}`,
            date:     activeRecent.date,
            distMi:   activeRecent.distMi,
            durMin:   activeRecent.durMin,
            // Strava detail/streams are fetched with the viewer's own token, which
            // can't read another athlete's activity — only request them for your own runs.
            stravaId:     activeRecent.userId === user?.id ? activeRecent.stravaId : null,
            hiddenStrava: activeRecent.userId !== user?.id && activeRecent.stravaId != null,
          }}
          onClose={() => setActiveRecent(null)}
        />
      )}
    </div>
  );
}
