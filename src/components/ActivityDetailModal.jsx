import { useState, useEffect } from 'react';
import { X, RefreshCw } from '../icons/PixelIcons';
import {
  AreaChart, Area, ComposedChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { fetchStravaActivity, fetchStravaStreamsAll } from '../lib/strava';
import { TOKENS } from '../lib/colors';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatKmPace(avgSpeedMs) {
  if (!avgSpeedMs || avgSpeedMs <= 0) return '—';
  const total = Math.round(1000 / avgSpeedMs);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatElapsed(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function downsample(arr, max = 80) {
  if (!arr?.length) return [];
  const step = Math.max(1, Math.floor(arr.length / max));
  return arr.filter((_, i) => i % step === 0);
}

function buildStreamPoints(streams) {
  const dist = streams?.distance?.data;
  if (!dist?.length) return { elevPoints: [], hrCadPoints: [] };

  const step = Math.max(1, Math.floor(dist.length / 80));
  const alt  = streams.altitude?.data;
  const hr   = streams.heartrate?.data;
  const cad  = streams.cadence?.data;

  const elevPoints   = [];
  const hrCadPoints  = [];

  for (let i = 0; i < dist.length; i += step) {
    const km = parseFloat((dist[i] / 1000).toFixed(2));
    if (alt?.[i] != null) {
      elevPoints.push({ km, alt: parseFloat(alt[i].toFixed(1)) });
    }
    if (hr?.[i] != null || cad?.[i] != null) {
      hrCadPoints.push({
        km,
        hr:  hr?.[i]  != null ? Math.round(hr[i])      : undefined,
        spm: cad?.[i] != null ? Math.round(cad[i] * 2) : undefined,
      });
    }
  }
  return { elevPoints, hrCadPoints };
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function DistTooltip({ active, payload, unit, keys }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{d.km} km</p>
      {keys.map(({ key, label, color, fmt }) => d[key] != null && (
        <div key={key} className="flex justify-between gap-4">
          <span className="text-slate-500">{label}</span>
          <span style={{ color }}>{fmt ? fmt(d[key]) : d[key]}{unit ? ` ${unit}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

// ── Splits table ──────────────────────────────────────────────────────────────

function SplitsTable({ splits }) {
  if (!splits?.length) return null;
  const hasHR   = splits.some(s => s.average_heartrate != null);
  const hasElev = splits.some(s => s.elevation_difference != null);

  return (
    <section>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Per-km splits
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ fontFamily: '"Share Tech Mono", monospace' }}>
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-800">
              <th className="pb-1.5 pr-3 font-normal">KM</th>
              <th className="pb-1.5 pr-3 font-normal">Pace</th>
              {hasElev && <th className="pb-1.5 pr-3 font-normal">Elev</th>}
              {hasHR   && <th className="pb-1.5 font-normal">Avg HR</th>}
            </tr>
          </thead>
          <tbody>
            {splits.map((s, i) => {
              const elevDelta = s.elevation_difference;
              const elevStr = elevDelta == null ? null
                : `${elevDelta >= 0 ? '+' : ''}${elevDelta.toFixed(0)}m`;
              const elevColor = elevDelta == null ? undefined
                : elevDelta > 0 ? TOKENS.red : TOKENS.green;

              return (
                <tr
                  key={i}
                  className="border-b border-slate-800/50"
                  style={{ backgroundColor: i % 2 === 0 ? 'rgba(30,41,59,0.4)' : 'transparent' }}
                >
                  <td className="py-1.5 pr-3 text-slate-400">{s.split}</td>
                  <td className="py-1.5 pr-3" style={{ color: TOKENS.blue }}>
                    {formatKmPace(s.average_speed)}
                  </td>
                  {hasElev && (
                    <td className="py-1.5 pr-3" style={{ color: elevColor }}>
                      {elevStr ?? '—'}
                    </td>
                  )}
                  {hasHR && (
                    <td className="py-1.5" style={{ color: TOKENS.red }}>
                      {s.average_heartrate ? Math.round(s.average_heartrate) : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Elevation chart ───────────────────────────────────────────────────────────

function ElevationChart({ points }) {
  if (!points?.length) return null;
  return (
    <section>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Elevation
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={TOKENS.green} stopOpacity={0.25} />
              <stop offset="95%" stopColor={TOKENS.green} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="km"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}km`}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false} tickLine={false}
            domain={['auto', 'auto']}
            tickFormatter={v => `${v}m`}
            width={40}
          />
          <Tooltip
            content={
              <DistTooltip
                keys={[{ key: 'alt', label: 'Altitude', color: TOKENS.green, fmt: v => `${v}m` }]}
              />
            }
            cursor={{ stroke: '#334155', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="alt"
            stroke={TOKENS.green}
            strokeWidth={1.5}
            fill="url(#elevGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}

// ── HR + Cadence chart ────────────────────────────────────────────────────────

function HRCadenceChart({ points }) {
  if (!points?.length) return null;
  const hasHR  = points.some(p => p.hr  != null);
  const hasCad = points.some(p => p.spm != null);
  if (!hasHR && !hasCad) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Heart rate{hasCad ? ' & cadence' : ''}
        </p>
        <div className="flex items-center gap-3 text-xs">
          {hasHR && (
            <span className="flex items-center gap-1.5" style={{ color: TOKENS.red }}>
              <span style={{ display: 'inline-block', width: 12, height: 2, background: TOKENS.red }} />
              HR
            </span>
          )}
          {hasCad && (
            <span className="flex items-center gap-1.5" style={{ color: TOKENS.purple }}>
              <span style={{ display: 'inline-block', width: 12, height: 2, background: TOKENS.purple }} />
              SPM
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={points} margin={{ top: 4, right: hasCad ? 8 : 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="km"
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}km`}
            interval="preserveStartEnd"
          />
          {hasHR && (
            <YAxis
              yAxisId="hr"
              orientation="left"
              tick={{ fill: TOKENS.red + '99', fontSize: 10 }}
              axisLine={false} tickLine={false}
              domain={['auto', 'auto']}
              width={36}
            />
          )}
          {hasCad && (
            <YAxis
              yAxisId="spm"
              orientation="right"
              tick={{ fill: TOKENS.purple + '99', fontSize: 10 }}
              axisLine={false} tickLine={false}
              domain={['auto', 'auto']}
              width={36}
            />
          )}
          <Tooltip
            content={
              <DistTooltip
                keys={[
                  { key: 'hr',  label: 'Heart rate', color: TOKENS.red,    fmt: v => `${v} bpm` },
                  { key: 'spm', label: 'Cadence',    color: TOKENS.purple, fmt: v => `${v} spm` },
                ]}
              />
            }
            cursor={{ stroke: '#334155', strokeWidth: 1 }}
          />
          {hasHR && (
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr"
              stroke={TOKENS.red}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls
            />
          )}
          {hasCad && (
            <Line
              yAxisId="spm"
              type="monotone"
              dataKey="spm"
              stroke={TOKENS.purple}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

// ── Segments ──────────────────────────────────────────────────────────────────

function SegmentEfforts({ efforts }) {
  if (!efforts?.length) return null;
  return (
    <section>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Segments
      </p>
      <div className="space-y-1">
        {efforts.map((e, i) => {
          const rank = e.pr_rank;
          const rankLabel = rank === 1 ? 'KOM'
            : rank != null && rank <= 10 ? `Top ${rank}`
            : null;
          return (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(30,41,59,0.5)' }}
            >
              <span className="text-xs text-slate-300 truncate pr-3">{e.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {rankLabel && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      color: rank === 1 ? TOKENS.yellow : TOKENS.green,
                      backgroundColor: rank === 1 ? `${TOKENS.yellow}22` : `${TOKENS.green}22`,
                    }}
                  >
                    {rankLabel}
                  </span>
                )}
                <span className="text-xs" style={{ color: TOKENS.blue, fontFamily: '"Share Tech Mono", monospace' }}>
                  {formatElapsed(e.elapsed_time)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const detailCache  = new Map(); // stravaId → activity detail
const streamsCache = new Map(); // stravaId → streams

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ActivityDetailModal({ activity, onClose }) {
  const hasStrava = Boolean(activity.stravaId);

  const [detail,  setDetail]  = useState(() => detailCache.get(activity.stravaId) ?? null);
  const [streams, setStreams] = useState(() => streamsCache.get(activity.stravaId) ?? null);
  const [loading, setLoading] = useState(hasStrava && !detailCache.has(activity.stravaId));
  const [err,     setErr]     = useState(null);

  useEffect(() => {
    if (!hasStrava) return;
    if (detailCache.has(activity.stravaId)) return; // already cached
    Promise.all([
      fetchStravaActivity(activity.stravaId),
      fetchStravaStreamsAll(activity.stravaId),
    ])
      .then(([d, s]) => {
        detailCache.set(activity.stravaId, d);
        streamsCache.set(activity.stravaId, s);
        setDetail(d);
        setStreams(s);
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [activity.stravaId, hasStrava]);

  const { elevPoints, hrCadPoints } = streams
    ? buildStreamPoints(streams)
    : { elevPoints: [], hrCadPoints: [] };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl
                   max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">{activity.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activity.date}
              {activity.distMi  ? ` · ${activity.distMi.toFixed(2)} mi`  : ''}
              {activity.durMin  ? ` · ${activity.durMin} min`             : ''}
              {activity.hr      ? ` · ${activity.hr} bpm avg`             : ''}
            </p>
          </div>
          <button
            className="text-slate-500 hover:text-white transition-colors ml-4 flex-shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-6">
          {!hasStrava && (
            <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
              No Strava link — splits and charts unavailable for manually logged runs.
              {activity.notes && (
                <span className="block mt-2" style={{ color: 'var(--text-primary)' }}>
                  📝 {activity.notes}
                </span>
              )}
            </p>
          )}

          {hasStrava && loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
              <RefreshCw size={12} className="animate-spin" />
              Loading activity data…
            </div>
          )}

          {hasStrava && err && (
            <p className="text-xs text-red-400 py-2">Failed to load: {err}</p>
          )}

          {hasStrava && !loading && !err && (
            <>
              <SplitsTable splits={detail?.splits_metric} />
              <ElevationChart points={elevPoints} />
              <HRCadenceChart points={hrCadPoints} />
              <SegmentEfforts efforts={detail?.segment_efforts} />
              {!detail?.splits_metric?.length &&
               !elevPoints.length &&
               !hrCadPoints.length &&
               !detail?.segment_efforts?.length && (
                <p className="text-xs text-slate-500 py-2">No additional data available for this activity.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
