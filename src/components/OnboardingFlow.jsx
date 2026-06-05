import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { LS_RACE } from '../hooks/useTrainingPlan';

const LS_ABILITY  = 'trnr_ability';
const LS_DONE     = 'trnr_onboarding_done';

export function isOnboardingDone() {
  return localStorage.getItem(LS_DONE) === '1';
}

const ABILITIES = [
  { key: 'beginner',     label: 'Beginner',     desc: 'New to running or just getting back into it' },
  { key: 'intermediate', label: 'Intermediate',  desc: 'Running regularly, completed a race or two' },
  { key: 'advanced',     label: 'Advanced',      desc: 'Consistent training, chasing a PR' },
];

export default function OnboardingFlow({ onComplete }) {
  const [step,     setStep]     = useState(0);
  const [raceDate, setRaceDate] = useState('');
  const [ability,  setAbility]  = useState('');
  const [saving,   setSaving]   = useState(false);

  async function finish() {
    setSaving(true);
    if (raceDate) {
      localStorage.setItem(LS_RACE, raceDate);
      await apiFetch('/api/plan/settings', {
        method: 'PUT',
        body: JSON.stringify({ start_date: null, race_date: raceDate }),
      }).catch(() => {});
    }
    if (ability) {
      localStorage.setItem(LS_ABILITY, ability);
    }
    localStorage.setItem(LS_DONE, '1');
    onComplete();
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{ backgroundColor: i <= step ? 'var(--green)' : '#283442' }}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="text-center space-y-5">
            <h1
              className="text-white"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '13px', lineHeight: 1.6 }}
            >
              TRNRBOI 8000
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Your 16-week marathon training computer. Track your runs, follow your plan,
              and stay on pace to race day.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Syncs with Strava — no manual logging required.
            </p>
            <button className="btn w-full mt-4" onClick={() => setStep(1)}>
              Get started
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-semibold text-base mb-1">When is your race?</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                This sets the target date for your training plan countdown.
              </p>
            </div>
            <input
              type="date"
              className="field"
              value={raceDate}
              onChange={e => setRaceDate(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setStep(0)}>Back</button>
              <button className="btn flex-1" onClick={() => setStep(2)}>
                {raceDate ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-white font-semibold text-base mb-1">What's your level?</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Helps calibrate default workout intensities.
              </p>
            </div>
            <div className="space-y-2">
              {ABILITIES.map(a => (
                <button
                  key={a.key}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    ability === a.key
                      ? 'border-green-500/60 bg-green-900/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                  onClick={() => setAbility(a.key)}
                >
                  <div className="text-sm font-medium text-white">{a.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn flex-1"
                onClick={finish}
                disabled={saving}
              >
                {saving ? 'Saving…' : ability ? 'Start training' : 'Skip'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
