import { Calendar, Clock, Users, BarChart2, LayoutDashboard } from '../icons/PixelIcons';

export const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'plan',      label: 'Plan',      Icon: Calendar },
  { id: 'pace',      label: 'Stats',     Icon: Clock },
  { id: 'team',      label: 'Team',      Icon: Users },
  { id: 'history',   label: 'History',   Icon: BarChart2 },
];

const TAB_BASE = {
  fontFamily: '"Space Mono", monospace',
  fontWeight: 700,
  fontSize: '7px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'none',
  flex: '1 1 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '5px',
  padding: '10px 8px',
};

export default function Nav({ active, onChange }) {
  return (
    <nav
      className="flex mb-6 overflow-x-auto"
      style={{
        borderBottom: '1px solid var(--green)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'var(--bg-primary)',
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              ...TAB_BASE,
              background:   isActive ? 'var(--green)'    : 'transparent',
              color:        isActive ? 'var(--bg-primary)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--green)' : '2px solid transparent',
            }}
          >
            <Icon size={13} strokeWidth={2} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
