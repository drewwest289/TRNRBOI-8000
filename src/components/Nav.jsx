import { Calendar, Activity, Clock, Users, BarChart2 } from 'lucide-react';

const TABS = [
  { id: 'plan',    label: 'Plan',    Icon: Calendar },
  { id: 'log',     label: 'Log',     Icon: Activity },
  { id: 'pace',    label: 'Pace',    Icon: Clock },
  { id: 'team',    label: 'Team',    Icon: Users },
  { id: 'history', label: 'History', Icon: BarChart2 },
];

export default function Nav({ active, onChange }) {
  return (
    <nav className="flex gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            active === id
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </nav>
  );
}
