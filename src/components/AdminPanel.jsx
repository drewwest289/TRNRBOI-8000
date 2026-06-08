import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { RefreshCw, Trash2 } from '../icons/PixelIcons';
import { TOKENS } from '../lib/colors';

const AVATAR_COLORS = [TOKENS.green, TOKENS.blue, TOKENS.purple, TOKENS.red, TOKENS.yellow];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function exitAdmin() {
  window.location.hash = '';
}

export default function AdminPanel({ user }) {
  const [users,   setUsers]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);
  const [busyId,  setBusyId]  = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setUsers(await apiFetch('/api/admin/users'));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRemove(u) {
    if (!confirm(`Remove ${u.name}? This deletes their account, Strava connection, and all logged data. This cannot be undone.`)) return;
    setBusyId(u.id);
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      setUsers(list => list.filter(x => x.id !== u.id));
    } catch (e) {
      alert(`Failed to remove ${u.name}: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="card max-w-sm text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not authorized.</p>
          <button className="btn-ghost text-xs mt-3" onClick={exitAdmin}>← Back to app</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1
              className="text-white tracking-tight"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '14px', lineHeight: 1.4 }}
            >
              ADMIN
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              User management — owner only
            </p>
          </div>
          <button className="btn-ghost text-xs" onClick={exitAdmin}>← Back to app</button>
        </header>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="section-label mb-0">Connected users</div>
            <button className="btn-ghost text-xs" onClick={load} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {err && <p className="text-xs text-red-400 py-2">{err}</p>}

          {!loading && !err && users?.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm">No users found</div>
          )}

          {!err && users?.length > 0 && (
            <div className="space-y-2">
              {users.map((u, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const isSelf = u.id === user.id;
                return (
                  <div key={u.id} className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0 object-cover" />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {initials(u.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white flex items-center gap-2">
                        {u.name}
                        {u.isAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${TOKENS.yellow}22`, color: TOKENS.yellow }}>
                            owner
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Strava ID {u.stravaId} · joined {formatDate(u.joinedAt)} · active {relativeTime(u.lastActiveAt)}
                      </div>
                    </div>
                    <button
                      className="btn-icon flex-shrink-0"
                      onClick={() => handleRemove(u)}
                      disabled={isSelf || busyId === u.id}
                      title={isSelf ? "Can't remove your own account" : `Remove ${u.name}`}
                      aria-label={`Remove ${u.name}`}
                      style={{ opacity: isSelf ? 0.3 : 1 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
