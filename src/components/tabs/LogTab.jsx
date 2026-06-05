import { useState, useEffect } from 'react';
import { Plus, Trash2 } from '../../icons/PixelIcons';
import { useRuns, addRun, deleteRun } from '../../hooks/useRuns';
import { useRunners } from '../../hooks/useRunners';
import { paceStr } from '../../lib/pace';
import { localDateStr } from '../../lib/plan';
import { chipClass } from '../../lib/colors';
import ActivityDetailModal from '../ActivityDetailModal';

const RUN_TYPES = ['Easy', 'Tempo', 'Long run', 'Intervals', 'Cross-train'];

const localToday = () => localDateStr(new Date());

export default function LogTab() {
  const runs    = useRuns();
  const runners = useRunners();

  const [form, setForm] = useState({
    user: '', date: localToday(), dist: '', dur: '', type: 'Easy', notes: '',
  });
  const [feedback,     setFeedback]     = useState('');
  const [detailRun,    setDetailRun]    = useState(null);

  useEffect(() => {
    if (runners.length > 0 && !form.user) {
      setForm(f => ({ ...f, user: runners[0].name }));
    }
  }, [runners]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => {
    setFeedback('');
    setForm(f => ({ ...f, [k]: v }));
  };

  async function handleAdd() {
    const dist = parseFloat(form.dist);
    const dur  = parseInt(form.dur);
    if (!form.date || !dist || isNaN(dist) || !dur || isNaN(dur)) {
      setFeedback('error:Date, distance, and duration are required.');
      return;
    }
    const user = form.user || runners[0]?.name || 'Drew';
    try {
      await addRun({ user, date: form.date, dist, dur, type: form.type, notes: form.notes });
      setForm(f => ({ ...f, dist: '', dur: '', notes: '' }));
      setFeedback('ok');
      setTimeout(() => setFeedback(''), 2000);
    } catch (e) {
      setFeedback(`error:Could not save run: ${e.message}`);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this run?')) return;
    await deleteRun(id);
  }

  return (
    <div>
      {/* Form */}
      <div className="card">
        <div className="section-label">Log a run</div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>RUNNER</label>
            <select className="field" value={form.user} onChange={e => set('user', e.target.value)}>
              {runners.map(r => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>DATE</label>
            <input
              type="date" className="field" value={form.date}
              onChange={e => set('date', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>DIST (MI)</label>
            <input type="number" className="field" placeholder="3.1" step="0.1" min="0"
              value={form.dist} onChange={e => set('dist', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TIME (MIN)</label>
            <input type="number" className="field" placeholder="30" step="1" min="0"
              value={form.dur} onChange={e => set('dur', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>TYPE</label>
            <select className="field" value={form.type} onChange={e => set('type', e.target.value)}>
              {RUN_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>NOTES</label>
            <input type="text" className="field" placeholder="How did it feel?"
              value={form.notes} onChange={e => set('notes', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
          <div className="flex items-end">
            <button className="btn" onClick={handleAdd}>
              <Plus size={14} /> Add run
            </button>
          </div>
        </div>

        {feedback.startsWith('error:') && (
          <p className="text-xs mt-2" style={{ color: 'var(--red)' }}>{feedback.slice(6)}</p>
        )}
        {feedback === 'ok' && (
          <p className="text-xs mt-2" style={{ color: 'var(--green)' }}>Run added ✓</p>
        )}
      </div>

      {detailRun && (
        <ActivityDetailModal
          activity={{
            name:     detailRun.notes || `${detailRun.type} run`,
            date:     detailRun.date,
            distMi:   detailRun.dist,
            durMin:   detailRun.dur,
            hr:       null,
            notes:    detailRun.notes,
            stravaId: detailRun.strava_id ?? detailRun.stravaId ?? null,
          }}
          onClose={() => setDetailRun(null)}
        />
      )}

      {/* Recent runs — 48px rows with chips */}
      <div className="card">
        <div className="section-label">Recent runs</div>
        {runs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            No runs logged yet
          </div>
        ) : (
          <div>
            {runs.slice(0, 25).map((r, idx) => {
              const pace = paceStr(r.dist, r.dur);
              return (
                <div
                  key={r.id}
                  className="grid gap-3 items-center group cursor-pointer"
                  style={{
                    gridTemplateColumns: '76px 1fr 60px 52px 32px',
                    minHeight: '48px',
                    padding: '0 0',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: idx % 2 === 0 ? 'var(--bg-nested)' : 'transparent',
                  }}
                  onClick={() => setDetailRun(r)}
                >
                  <div className="text-xs pl-2" style={{ color: 'var(--text-muted)' }}>{r.date}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{r.user}</span>
                    <span className={chipClass(r.type)}>{r.type}</span>
                  </div>
                  <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    {pace}/mi
                  </div>
                  <div className="text-sm font-bold text-right pr-2" style={{ color: 'var(--text-primary)' }}>
                    {r.dist.toFixed(1)} mi
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center"
                    style={{ color: 'var(--text-muted)', transition: 'none' }}
                    aria-label="Delete run"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
