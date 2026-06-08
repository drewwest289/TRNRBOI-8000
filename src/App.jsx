import { useState, useEffect } from 'react';
import { db } from './db';
import Nav from './components/Nav';
import DashboardTab from './components/tabs/DashboardTab';
import PlanTab from './components/tabs/PlanTab';
import LogTab from './components/tabs/LogTab';
import PaceTab from './components/tabs/PaceTab';
import TeamTab from './components/tabs/TeamTab';
import HistoryTab from './components/tabs/HistoryTab';
import LoginScreen from './components/LoginScreen';
import OnboardingFlow, { isOnboardingDone } from './components/OnboardingFlow';
import AdminPanel from './components/AdminPanel';
import { useTrainingPlan } from './hooks/useTrainingPlan';
import { useAuth } from './hooks/useAuth';

// Hidden, unlisted route — reachable only by navigating to #admin directly.
// Hash fragments never hit the server, so this needs no routing config.
function useIsAdminRoute() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.hash === '#admin');
  useEffect(() => {
    const onHashChange = () => setIsAdminRoute(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return isAdminRoute;
}

function RaceCountdown({ days }) {
  if (days === null) return <>Set start date</>;
  if (days > 0)     return <>{days} days out</>;
  if (days === 0)   return <>Race day! 🏁</>;
  return <>Plan complete</>;
}

export default function App() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [onboarded, setOnboarded] = useState(isOnboardingDone);
  const plan = useTrainingPlan();
  const isAdminRoute = useIsAdminRoute();

  // One-time cleanup: clear legacy Dexie runners table
  useEffect(() => {
    if (user && !localStorage.getItem('trnr_runners_cleared')) {
      db.runners.clear().then(() => localStorage.setItem('trnr_runners_cleared', '1'));
    }
  }, [user]);

  if (!user) return <LoginScreen />;
  if (isAdminRoute) return <AdminPanel user={user} />;
  if (!onboarded) return <OnboardingFlow onComplete={() => setOnboarded(true)} />;

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
            <button
              onClick={logout}
              className="text-xs mt-1"
              style={{ color: 'var(--text-muted)', opacity: 0.5 }}
              title={`Signed in as ${user.name}`}
            >
              sign out
            </button>
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
