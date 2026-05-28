import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { calcPaceFromGoal, secToMMSS, TRAINING_PACE_FACTORS } from '../../lib/pace';

const DISTANCES = [
  { label: 'Half marathon (13.1 mi)', value: '13.1' },
  { label: '5K (3.1 mi)',             value: '3.1' },
  { label: '10K (6.2 mi)',            value: '6.2' },
  { label: 'Marathon (26.2 mi)',      value: '26.2' },
  { label: 'Custom',                  value: 'custom' },
];

export default function PaceTab() {
  const [distSel, setDistSel] = useState('13.1');
  const [custom, setCustom]   = useState('');
  const [h, setH]             = useState('');
  const [m, setM]             = useState('');
  const [s, setS]             = useState('');
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  function calc() {
    const dist     = distSel === 'custom' ? parseFloat(custom) : parseFloat(distSel);
    const totalSec = (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
    if (!dist || dist <= 0 || !totalSec) {
      setError('Fill in distance and time.');
      return;
    }
    setError('');
    setResult({ ...calcPaceFromGoal(dist, totalSec), dist, totalSec });
  }

  return (
    <div>
      <div className="card">
        <div className="section-label">Pace calculator</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Distance</label>
            <select className="field" value={distSel} onChange={e => setDistSel(e.target.value)}>
              {DISTANCES.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          {distSel === 'custom' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Custom distance (mi)</label>
              <input
                type="number"
                className="field"
                placeholder="5"
                step="0.1"
                min="0.1"
                value={custom}
                onChange={e => setCustom(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hours</label>
            <input
              type="number"
              className="field"
              placeholder="2"
              min="0"
              max="9"
              value={h}
              onChange={e => setH(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Minutes</label>
            <input
              type="number"
              className="field"
              placeholder="15"
              min="0"
              max="59"
              value={m}
              onChange={e => setM(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Seconds</label>
            <input
              type="number"
              className="field"
              placeholder="0"
              min="0"
              max="59"
              value={s}
              onChange={e => setS(e.target.value)}
            />
          </div>
        </div>

        <button className="btn" onClick={calc}>
          <Calculator size={14} /> Calculate
        </button>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

        {result && (
          <div className="flex gap-6 mt-5 pt-5 border-t border-slate-800 flex-wrap">
            {[
              { val: result.perMile, unit: 'per mile' },
              { val: result.perKm,   unit: 'per km' },
              { val: result.mph,     unit: 'mph' },
            ].map(({ val, unit }) => (
              <div key={unit}>
                <div className="text-3xl font-semibold text-white">{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{unit}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {result && (
        <div className="card">
          <div className="section-label">Training paces based on your goal</div>
          <div className="space-y-2">
            {TRAINING_PACE_FACTORS.map(({ label, factor, note }) => (
              <div
                key={label}
                className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{note}</div>
                </div>
                <div className="text-sm font-semibold text-emerald-400">
                  {secToMMSS(result.perMileSec * factor)}/mi
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
