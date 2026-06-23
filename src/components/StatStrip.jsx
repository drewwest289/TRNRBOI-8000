import { useState } from 'react';
import { TOKENS } from '../lib/colors';

// Icon-led stat strip, laid out as one row with dividers instead of boxed
// tiles. Each item is clickable — tapping it reveals a `detail` line below
// the strip explaining what the number is pulled from, since a bare number
// doesn't say what data it's computed from. Shared by Dashboard and Plan so
// every "row of stats" in the app looks and behaves the same way.
function StatItem({ icon: Icon, value, label, detail, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 px-1 py-2"
      style={{ background: 'none', border: 'none', cursor: detail ? 'pointer' : 'default' }}
    >
      <Icon size={18} color={TOKENS.green} strokeWidth={2} />
      <div
        className="text-lg font-semibold leading-none"
        style={{ fontFamily: '"Press Start 2P", monospace', color: 'var(--green)' }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
      >
        {label}
      </div>
    </button>
  );
}

export default function StatStrip({ items }) {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div>
      <div className="flex divide-x divide-slate-800">
        {items.map((item, i) => (
          <StatItem
            key={i}
            {...item}
            active={openIdx === i}
            onClick={() => item.detail && setOpenIdx(openIdx === i ? null : i)}
          />
        ))}
      </div>
      {openIdx !== null && items[openIdx].detail && (
        <div className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {items[openIdx].detail}
        </div>
      )}
    </div>
  );
}
