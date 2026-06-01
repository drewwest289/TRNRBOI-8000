import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { plan16, getMiles, getActualMilesForWeek } from '../lib/plan';
import { TOKENS } from '../lib/colors';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const planned = payload.find(p => p.dataKey === 'planned')?.value ?? 0;
  const actual  = payload.find(p => p.dataKey === 'actual')?.value ?? 0;
  return (
    <div className="bg-slate-800 border border-slate-700 px-3 py-2 text-xs">
      <p className="mb-1" style={{ color: TOKENS.textMuted }}>{label}</p>
      <p style={{ color: TOKENS.textPrimary }}>
        Planned: <span style={{ color: TOKENS.green }}>{planned} mi</span>
      </p>
      {actual > 0 && (
        <p style={{ color: TOKENS.green }}>
          Logged: <span style={{ fontWeight: 700 }}>{actual} mi</span>
        </p>
      )}
    </div>
  );
};

export default function MileageChart({ runs, currentWeek }) {
  const data = plan16.map(w => ({
    week:    `W${w.week}`,
    weekNum: w.week,
    planned: getMiles(w),
    actual:  parseFloat(getActualMilesForWeek(w.week, runs).toFixed(1)),
    isRace:  w.week === 16,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={8} barGap={2} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="week"
          tick={{ fill: TOKENS.textMuted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fill: TOKENS.textMuted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        {currentWeek && (
          <ReferenceLine
            x={`W${currentWeek}`}
            stroke={TOKENS.border}
            strokeDasharray="4 4"
          />
        )}
        <Bar dataKey="planned" radius={[0, 0, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isRace ? 'rgba(179,107,255,0.22)' : 'rgba(124,255,158,0.18)'}
            />
          ))}
        </Bar>
        <Bar dataKey="actual" radius={[0, 0, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isRace ? TOKENS.purple : TOKENS.green}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
