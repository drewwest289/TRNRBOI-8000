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

/**
 * Format a YYYY-MM-DD string as "Jun 2" using local date constructors so
 * timezones behind UTC don't shift the displayed date to the previous day.
 */
function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Today's date as a YYYY-MM-DD string in local time */
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeekGrid({ week, runs, onDayClick }) {
  const weekData  = plan16[week - 1];
  const todayStr  = getTodayStr();

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekData.days.map((dayStr, i) => {
        const type    = getDayType(dayStr);
        const planned = getDayMiles(dayStr);
        const dateStr = getDateForCell(week, i);
        const logs    = getLogsForDate(dateStr, runs);
        const isRest  = type === 'rest';
        const isToday = dateStr === todayStr;

        // Distinguish "active run logged" from "rest/skip logged"
        const hasActiveLog = logs.some(l => l.type !== 'Rest');
        const hasRestLog   = logs.length > 0 && !hasActiveLog;
        const hasDone      = logs.length > 0;

        // Border and background driven by what was actually logged vs planned
        const borderColor = hasActiveLog && isRest  ? '#BA7517'
          : hasActiveLog                            ? TYPE_COLOR[type] ?? '#64748b'
          : hasRestLog                              ? '#475569'
          : type === 'rest'                         ? 'transparent'
          :                                           TYPE_COLOR[type] ?? '#64748b';

        const bgColor = hasActiveLog && isRest ? 'rgba(186,117,23,0.10)'
          : hasActiveLog                       ? TYPE_BG[type] ?? 'transparent'
          : hasRestLog                         ? 'rgba(71,85,105,0.15)'
          :                                      'transparent';

        const labelColor = isRest && !hasDone ? '#475569' : TYPE_COLOR[type] ?? '#64748b';

        return (
          <div
            key={i}
            className={`rounded-lg p-2 text-center border transition-colors select-none ${
              onDayClick ? 'cursor-pointer hover:brightness-125 active:scale-95' : ''
            } ${isToday ? 'ring-1 ring-emerald-500/60' : ''}`}
            style={{
              borderColor,
              backgroundColor: bgColor,
              opacity: isRest && !hasDone ? 0.45 : 1,
            }}
            onClick={() => onDayClick?.(dateStr, dayStr, logs)}
          >
            {/* Day name */}
            <div className={`text-xs mb-0.5 ${isToday ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
              {DAY_NAMES[i]}
            </div>
            {/* Calendar date */}
            <div className={`text-[10px] mb-1 leading-tight ${isToday ? 'text-emerald-400 font-medium' : 'text-slate-600'}`}>
              {shortDate(dateStr)}
            </div>
            {/* Plan type label */}
            <div className="text-xs font-semibold mb-1" style={{ color: labelColor }}>
              {TYPE_LABEL[type] || type}
            </div>
            {/* Planned miles */}
            <div className="text-xs text-slate-300">
              {planned ? `${planned}mi` : ''}
            </div>
            {/* Completion indicators */}
            {hasActiveLog && !isRest && (
              <div className="text-xs font-semibold mt-1" style={{ color: '#4ade80' }}>
                ✓ {logs.reduce((s, r) => s + r.dist, 0).toFixed(1)}
              </div>
            )}
            {hasActiveLog && isRest && (
              <div className="text-xs font-semibold mt-1" style={{ color: '#BA7517' }}>
                {logs.reduce((s, r) => s + r.dist, 0).toFixed(1)}mi
              </div>
            )}
            {hasRestLog && (
              <div className="text-xs font-medium mt-1" style={{ color: '#64748b' }}>
                —
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
