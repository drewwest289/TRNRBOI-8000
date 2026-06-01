import { Calendar, Activity, Clock, Users, BarChart2, LayoutDashboard } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'plan',      label: 'Plan',      Icon: Calendar },
  { id: 'log',       label: 'Log',       Icon: Activity },
  { id: 'pace',      label: 'Pace',      Icon: Clock },
  { id: 'team',      label: 'Team',      Icon: Users },
  { id: 'history',   label: 'History',   Icon: BarChart2 },
];

export default function Nav({ active, onChange }) {
  return (
    <nav
      className="flex gap-0 mb-6 overflow-x-auto"
      style={{ border: '2px solid #39FF14', boxShadow: '4px 4px 0px rgba(57,255,20,0.25)' }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={
              isActive
                ? {
                    backgroundColor: '#39FF14',
                    color: '#0c0c0c',
                    borderRight: '2px solid #25aa00',
                    boxShadow: 'inset 0 -3px 0 #1a6600',
                    flex: '1 1 0',
                  }
                : {
                    backgroundColor: 'transparent',
                    color: '#555',
                    borderRight: '1px solid #1e1e1e',
                    flex: '1 1 0',
                  }
            }
            className="flex items-center justify-center gap-1 px-2 py-2.5 text-sm font-medium"
          >
            {/* Pixel cursor indicator on active tab */}
            {isActive && (
              <span style={{ fontSize: '8px', lineHeight: 1, color: '#0c0c0c' }}>▶</span>
            )}
            <Icon size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline" style={{ fontSize: '7px' }}>
              {label.toUpperCase()}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
