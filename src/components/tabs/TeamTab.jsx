import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api';
import { RefreshCw } from '../../icons/PixelIcons';
import { TOKENS } from '../../lib/colors';
import { useAuth } from '../../hooks/useAuth';

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '💩';
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
  const { user: authUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState(null);
  const [activeKey,   setActiveKey]   = useState('weeklyMiles');
  const [compareId,   setCompareId]   = useState(null);

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

  useEffect(() => { load(); }, []);

  const metric = METRICS.find(m => m.key === activeKey);

  const sorted = leaderboard
    ? [...leaderboard].sort((a, b) => b.metrics[activeKey] - a.metrics[activeKey])
    : [];

  const maxVal = sorted.reduce((m, e) => Math.max(m, Math.abs(e.metrics[activeKey])), 0.001);

  const meEntry      = leaderboard?.find(e => e.id === authUser?.id) ?? null;
  const compareEntry = leaderboard?.find(e => e.id === compareId) ?? null;

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
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const isMe  = id === authUser?.id;
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3"
                  style={{ outline: compareId === id ? `1px solid ${TOKENS.green}` : 'none' }}
                >
                  <div className="text-base w-7 text-center flex-shrink-0">{medal(i + 1)}</div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{name}{isMe ? ' (you)' : ''}</div>
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
                  {!isMe && meEntry && (
                    <button
                      className={compareId === id ? 'btn text-xs py-1 px-2 flex-shrink-0' : 'btn-ghost text-xs py-1 px-2 flex-shrink-0'}
                      onClick={() => setCompareId(c => c === id ? null : id)}
                      title={`Compare with ${name}`}
                    >
                      VS
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Head-to-head comparison */}
      {meEntry && compareEntry && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="section-label mb-0">Head to head</div>
            <button className="btn-ghost text-xs" onClick={() => setCompareId(null)}>Close</button>
          </div>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="text-center flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{meEntry.name}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>YOU</div>
            </div>
            <div className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>VS</div>
            <div className="text-center flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{compareEntry.name}</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>OPPONENT</div>
            </div>
          </div>
          <div className="space-y-3">
            {METRICS.map(m => {
              const meVal  = meEntry.metrics[m.key];
              const oppVal = compareEntry.metrics[m.key];
              const meWins  = meVal > oppVal;
              const oppWins = oppVal > meVal;
              return (
                <div key={m.key}>
                  <div className="text-[10px] text-center mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {m.label}
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: meWins ? TOKENS.green : 'var(--text-primary)' }}
                    >
                      {meWins ? '🏆 ' : ''}{m.fmt(meVal)}
                    </span>
                    <span
                      className="text-sm font-semibold text-right"
                      style={{ color: oppWins ? TOKENS.green : 'var(--text-primary)' }}
                    >
                      {m.fmt(oppVal)}{oppWins ? ' 🏆' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
