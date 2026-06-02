import { DAY_NAMES, getDayType, getDayMiles, getDateForCell, getLogsForDate, plan16 } from '../lib/plan';
import { TYPE_COLOR, TYPE_BG, TOKENS } from '../lib/colors';
import { PixelIcon } from '../icons/PixelIcons';

/** Pixel icon name + fallback text label for each plan day type */
const TYPE_GLYPH = {
  easy:     { icon: 'runner', label: 'EASY'  },
  long:     { icon: 'road',   label: 'LONG'  },
  tempo:    { icon: 'bolt',   label: 'TEMPO' },
  interval: { icon: 'bolt',   label: 'INTV'  },
  cross:    { icon: 'bike',   label: 'CROSS' },
  rest:     { icon: 'bed',    label: 'REST'  },
  race:     { icon: null,     label: 'RACE!' },
};

function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeekGrid({ week, runs, onDayClick, planOverrides = {} }) {
  const weekData = plan16[week - 1];
  const todayStr = getTodayStr();

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekData.days.map((baseDayStr, i) => {
        const dateStr = getDateForCell(week, i);
        const dayStr  = planOverrides[dateStr] ?? baseDayStr;
        const type    = getDayType(dayStr);
        const planned = getDayMiles(dayStr);
        const logs    = getLogsForDate(dateStr, runs);
        const isRest  = type === 'rest';
        const isToday = dateStr === todayStr;

        const hasActiveLog = logs.some(l => l.type !== 'Rest');
        const hasRestLog   = logs.length > 0 && !hasActiveLog;
        const hasDone      = logs.length > 0;

        const borderColor = hasActiveLog && isRest ? TOKENS.red
          : hasActiveLog                            ? TYPE_COLOR[type] ?? TOKENS.border
          : hasRestLog                              ? TOKENS.textMuted
          : type === 'rest'                         ? 'transparent'
          :                                           TYPE_COLOR[type] ?? TOKENS.border;

        const bgColor = hasActiveLog && isRest ? TYPE_BG.tempo
          : hasActiveLog                        ? TYPE_BG[type] ?? 'transparent'
          : hasRestLog                          ? 'rgba(138,160,178,0.08)'
          :                                       'transparent';

        const labelColor = isRest && !hasDone ? TOKENS.textMuted : TYPE_COLOR[type] ?? TOKENS.textMuted;

        return (
          <div
            key={i}
            className={`p-2 text-center border select-none ${onDayClick ? 'cursor-pointer' : ''}`}
            style={{
              borderColor: isToday ? TOKENS.green : borderColor,
              backgroundColor: isToday ? 'rgba(124,255,158,0.06)' : bgColor,
              boxShadow: isToday ? '0 0 8px rgba(124,255,158,0.40)' : undefined,
              opacity: isRest && !hasDone ? 0.45 : 1,
            }}
            onClick={() => onDayClick?.(dateStr, dayStr, logs)}
          >
            {/* Day name */}
            <div
              className="text-xs mb-0.5"
              style={{
                color: isToday ? TOKENS.green : TOKENS.textMuted,
                fontWeight: isToday ? 700 : 400,
              }}
            >
              {DAY_NAMES[i]}
            </div>
            {/* Calendar date */}
            <div
              className="mb-1 leading-tight"
              style={{ fontSize: '9px', color: isToday ? TOKENS.green : TOKENS.textMuted, opacity: isToday ? 1 : 0.7 }}
            >
              {shortDate(dateStr)}
            </div>
            {/* Plan type glyph */}
            <div className="flex justify-center mb-1">
              {TYPE_GLYPH[type]?.icon ? (
                <PixelIcon
                  name={TYPE_GLYPH[type].icon}
                  size={10}
                  color={labelColor}
                />
              ) : (
                <span className="text-xs font-bold" style={{ color: labelColor }}>
                  {TYPE_GLYPH[type]?.label || type.toUpperCase()}
                </span>
              )}
            </div>
            {/* Planned miles */}
            <div className="text-xs" style={{ color: TOKENS.textPrimary }}>
              {planned ? `${planned}mi` : ''}
            </div>
            {/* Completion indicators */}
            {hasActiveLog && !isRest && (
              <div className="text-xs font-bold mt-1" style={{ color: TOKENS.green }}>
                ✓ {logs.reduce((s, r) => s + r.dist, 0).toFixed(1)}
              </div>
            )}
            {hasActiveLog && isRest && (
              <div className="text-xs font-bold mt-1" style={{ color: TOKENS.red }}>
                {logs.reduce((s, r) => s + r.dist, 0).toFixed(1)}mi
              </div>
            )}
            {hasRestLog && (
              <div className="text-xs font-bold mt-1" style={{ color: TOKENS.textMuted }}>
                —
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
