import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { plan16, getMiles, getActualMilesForWeek } from '../lib/plan';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const planned = payload.find(p => p.dataKey === 'planned')?.value ?? 0;
  const actual  = payload.find(p => p.dataKey === 'actual')?.value ?? 0;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1 font-medium">{label}</p>
      <p className="text-slate-300">Planned: <span className="text-white font-semibold">{planned} mi</span></p>
      {actual > 0 && (
        <p style={{ color: '#4ade80' }}>Logged: <span className="font-semibold">{actual} mi</span></p>
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
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {currentWeek && (
          <ReferenceLine
            x={`W${currentWeek}`}
            stroke="#334155"
            strokeDasharray="3 3"
          />
        )}
        <Bar dataKey="planned" radius={[0, 0, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isRace ? 'rgba(187,153,255,0.25)' : 'rgba(0,255,136,0.18)'}
            />
          ))}
        </Bar>
        <Bar dataKey="actual" radius={[0, 0, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.isRace ? '#BB99FF' : '#00FF88'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
