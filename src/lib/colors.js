// ── Design token color values ─────────────────────────────────────────────
// Single source of truth for JS contexts (inline styles, Recharts props).
// CSS contexts use var(--token) from index.css :root.
// No hex literals appear anywhere else in the codebase.

export const TOKENS = {
  green:      '#7CFF9E',   // Easy runs, brand primary
  blue:       '#4DA3FF',   // Cross-train, data
  purple:     '#B36BFF',   // Long run, highlights
  red:        '#FF5C5C',   // HR, alerts, Tempo
  orange:     '#FF8C42',   // Hard efforts
  yellow:     '#FFD44D',   // Achievements, Race
  bgPanel:    '#111827',
  bgNested:   '#1A2232',
  border:     '#283442',
  textPrimary:'#E6F5E6',
  textMuted:  '#8AA0B2',
};

// ── Run type → color ──────────────────────────────────────────────────────
export const TYPE_COLOR = {
  // Plan day types (lowercase keys)
  easy:     TOKENS.green,
  long:     TOKENS.purple,
  race:     TOKENS.yellow,
  cross:    TOKENS.blue,
  tempo:    TOKENS.red,
  interval: TOKENS.red,
  rest:     TOKENS.textMuted,
  // Log entry types (display-label keys)
  'Easy':        TOKENS.green,
  'Moderate':    TOKENS.blue,
  'Hard':        TOKENS.orange,
  'Long run':    TOKENS.purple,
  'Race':        TOKENS.yellow,
  'Cross-train': TOKENS.blue,
  'Tempo':       TOKENS.red,
  'Intervals':   TOKENS.red,
  'Rest':        TOKENS.textMuted,
};

export const TYPE_BG = {
  easy:     'rgba(124,255,158,0.10)',
  long:     'rgba(179,107,255,0.10)',
  race:     'rgba(255,212,77,0.10)',
  cross:    'rgba(77,163,255,0.10)',
  tempo:    'rgba(255,92,92,0.10)',
  interval: 'rgba(255,92,92,0.10)',
  rest:     'transparent',
  'Easy':        'rgba(124,255,158,0.10)',
  'Moderate':    'rgba(77,163,255,0.10)',
  'Hard':        'rgba(255,140,66,0.10)',
  'Long run':    'rgba(179,107,255,0.10)',
  'Race':        'rgba(255,212,77,0.10)',
  'Cross-train': 'rgba(77,163,255,0.10)',
  'Tempo':       'rgba(255,92,92,0.10)',
  'Intervals':   'rgba(255,92,92,0.10)',
};

// Chart color sequence (Recharts)
export const CHART_COLORS = [
  TOKENS.green,
  TOKENS.purple,
  TOKENS.blue,
  TOKENS.red,
  TOKENS.yellow,
];

// ── Helper: CSS chip class for a run type ─────────────────────────────────
export function chipClass(type) {
  const t = (type || '').toLowerCase().replace(/[\s-]/g, '');
  if (t === 'easy')                        return 'chip chip-easy';
  if (t === 'hard')                        return 'chip chip-hard';
  if (t === 'moderate')                    return 'chip chip-cross';
  if (t === 'longrun' || t === 'long')     return 'chip chip-long';
  if (t === 'crosstrain' || t === 'cross') return 'chip chip-cross';
  if (t === 'tempo')                       return 'chip chip-tempo';
  if (t === 'intervals' || t === 'interval') return 'chip chip-tempo';
  if (t === 'rest')                        return 'chip chip-rest';
  if (t === 'race')                        return 'chip chip-race';
  return 'chip';
}
