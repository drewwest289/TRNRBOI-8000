import { useState } from 'react';
import Nav from './components/Nav';
import DashboardTab from './components/tabs/DashboardTab';
import PlanTab from './components/tabs/PlanTab';
import LogTab from './components/tabs/LogTab';
import PaceTab from './components/tabs/PaceTab';
import TeamTab from './components/tabs/TeamTab';
import HistoryTab from './components/tabs/HistoryTab';
import { useTrainingPlan } from './hooks/useTrainingPlan';

function RaceCountdown({ days }) {
  if (days === null) return <>Set start date</>;
  if (days > 0)     return <>{days} days out</>;
  if (days === 0)   return <>Race day! 🏁</>;
  return <>Plan complete</>;
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  // Single source of truth for training dates — passed down to PlanTab so
  // the race countdown here and the week calculation in the plan stay in sync.
  const plan = useTrainingPlan();

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex justify-between items-start mb-6">
          <div>
            <h1
              className="text-white tracking-tight"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '14px', lineHeight: 1.4 }}
            >
              TRNRBOI 8000
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              16-WEEK TRAINING COMPUTER
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>RACE DAY</div>
            <div
              className="mt-0.5"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '11px', color: 'var(--green)' }}
            >
              <RaceCountdown days={plan.daysUntilRace} />
            </div>
          </div>
        </header>

        <Nav active={tab} onChange={setTab} />

        <main>
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'plan'      && <PlanTab plan={plan} />}
          {tab === 'log'       && <LogTab />}
          {tab === 'pace'      && <PaceTab />}
          {tab === 'team'      && <TeamTab />}
          {tab === 'history'   && <HistoryTab />}
        </main>
      </div>
    </div>
  );
}
