import { DAY_NAMES, getDayType, getDayMiles, getDateForCell, getLogsForDate, plan16 } from '../lib/plan';
import { TYPE_COLOR, TYPE_BG } from '../lib/colors';

const TYPE_LABEL = {
  easy:     'Easy',
  long:     'Long',
  race:     'Race!',
  cross:    'Cross',
  tempo:    'Tempo',
  interval: 'Intv',
  rest:     'Rest',
};

export default function WeekGrid({ week, runs }) {
  const weekData = plan16[week - 1];

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekData.days.map((dayStr, i) => {
        const type      = getDayType(dayStr);
        const planned   = getDayMiles(dayStr);
        const dateStr   = getDateForCell(week, i);
        const logs      = getLogsForDate(dateStr, runs);
        const actual    = logs.reduce((s, r) => s + r.dist, 0);
        const isRest    = type === 'rest';
        const hasDone   = logs.length > 0;

        const borderColor = hasDone && isRest
          ? '#BA7517'
          : hasDone
          ? TYPE_COLOR[type]
          : type === 'rest'
          ? 'transparent'
          : TYPE_COLOR[type];

        const bgColor = hasDone
          ? TYPE_BG[type]
          : 'transparent';

        return (
          <div
            key={i}
            className="rounded-lg p-2 text-center border transition-colors"
            style={{
              borderColor,
              backgroundColor: bgColor,
              opacity: isRest && !hasDone ? 0.45 : 1,
            }}
          >
            <div className="text-xs text-slate-500 mb-1">{DAY_NAMES[i]}</div>
            <div
              className="text-xs font-semibold mb-1"
              style={{ color: isRest && !hasDone ? '#475569' : TYPE_COLOR[type] }}
            >
              {TYPE_LABEL[type] || type}
            </div>
            <div className="text-xs text-slate-300">
              {planned ? `${planned}mi` : ''}
            </div>
            {hasDone && !isRest && (
              <div className="text-xs font-semibold mt-1" style={{ color: '#4ade80' }}>
                ✓ {actual.toFixed(1)}
              </div>
            )}
            {hasDone && isRest && (
              <div className="text-xs font-semibold mt-1" style={{ color: '#BA7517' }}>
                {actual.toFixed(1)}mi
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
