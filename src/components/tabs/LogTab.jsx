import { useState } from 'react';
import { Plus, Trash2 } from '../../icons/PixelIcons';
import { useActivities, addManualActivity, deleteManualActivity } from '../../hooks/useActivities';
import { useAuth } from '../../hooks/useAuth';
import { paceStr } from '../../lib/pace';
import { localDateStr } from '../../lib/plan';
import { chipClass } from '../../lib/colors';
import ActivityDetailModal from '../ActivityDetailModal';

const RUN_TYPES = ['Easy', 'Tempo', 'Long run', 'Intervals', 'Cross-train'];

const localToday = () => localDateStr(new Date());

export default function LogTab() {
  const activities  = useActivities();
  const { user: authUser } = useAuth();

  const [form, setForm] = useState({
    date: localToday(), dist: '', dur: '', type: 'Easy', notes: '',
  });
  const [feedback,  setFeedback]  = useState('');
  const [detailRun, setDetailRun] = useState(null);

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
    try {
      await addManualActivity({ date: form.date, dist, dur, type: form.type, notes: form.notes });
      setForm(f => ({ ...f, dist: '', dur: '', notes: '' }));
      setFeedback('ok');
      setTimeout(() => setFeedback(''), 2000);
    } catch (e) {
      setFeedback(`error:Could not save run: ${e.message}`);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this run?')) return;
    await deleteManualActivity(id);
  }

  return (
    <div>
      {/* Form */}
      <div className="card">
        <div className="section-label">Log a run</div>

        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>DATE</label>
          <input
            type="date" className="field" value={form.date}
            onChange={e => set('date', e.target.value)}
          />
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
            distMi:   detailRun.distMi,
            durMin:   detailRun.durMin,
            hr:       detailRun.hr,
            notes:    detailRun.notes,
            stravaId: detailRun.stravaId,
          }}
          onClose={() => setDetailRun(null)}
        />
      )}

      {/* Recent runs — 48px rows with chips */}
      <div className="card">
        <div className="section-label">Recent runs</div>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            No runs logged yet
          </div>
        ) : (
          <div>
            {activities.slice(0, 25).map((r, idx) => {
              const pace = paceStr(r.distMi, r.durMin);
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
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{authUser?.name}</span>
                    <span className={chipClass(r.type)}>{r.type}</span>
                  </div>
                  <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    {pace}/mi
                  </div>
                  <div className="text-sm font-bold text-right pr-2" style={{ color: 'var(--text-primary)' }}>
                    {r.distMi.toFixed(1)} mi
                  </div>
                  {r.source === 'manual' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      style={{ color: 'var(--text-muted)', transition: 'none' }}
                      aria-label="Delete run"
                    >
                      <Trash2 size={13} />
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
