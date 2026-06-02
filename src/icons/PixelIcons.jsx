/* ════════════════════════════════════════════════════════════════════════
   TRNRBOI 8000 — Pixel Icon Components  (React, drop-in for lucide-react)
   ────────────────────────────────────────────────────────────────────────
   Generated from icons/icon-data.js — DO NOT edit matrices here by hand;
   edit the data file and regenerate so the gallery + app stay in sync.

   Usage (matches the lucide API — size + currentColor inheritance):
     import { Runner, Calendar, Heart } from './icons/PixelIcons';
     <Runner size={16} />                  // inherits CSS color
     <Heart  size={20} color="#FF5C5C" />  // explicit color
     <Runner size={24} glow />             // CRT drop-shadow

   Lucide-compatible aliases are exported too, so existing imports can be
   swapped at the source path with no JSX changes:
     - import { Calendar, Activity, Clock, Users, BarChart2,
                LayoutDashboard } from 'lucide-react';
     + import { Calendar, Activity, Clock, Users, BarChart2,
                LayoutDashboard } from '../icons/PixelIcons';
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   TRNRBOI 8000 — Pixel Icon Set
   Every glyph is hand-placed on a 16×16 grid. '#' = filled pixel, '.' = empty.
   Bold & blocky, designed to match Section 10 of the design system.
   Single source of truth — the gallery and the React components both read this.
   ════════════════════════════════════════════════════════════════════════ */

export const ICON_MATRICES = {

  /* ── CORE (Section 10) ─────────────────────────────────────────────── */

  calendar: [
    "....##....##....",
    "....##....##....",
    "..############..",
    "..############..",
    "..#..........#..",
    "..#.##.##.##.#..",
    "..#..........#..",
    "..#.##.##.##.#..",
    "..#..........#..",
    "..#.##.##.##.#..",
    "..#..........#..",
    "..############..",
    "................",
    "................",
    "................",
    "................",
  ],

  runner: [
    "................",
    ".........###....",
    ".........###....",
    ".........###....",
    "........##......",
    "...#####..##....",
    ".......####.##..",
    "......#####.....",
    ".....#####......",
    ".....####.##....",
    "....###...###...",
    "...###......##..",
    "..###...........",
    ".##.............",
    "................",
    "................",
  ],

  chart: [
    "................",
    "................",
    ".............##.",
    ".........##..##.",
    ".........##..##.",
    ".....##..##..##.",
    ".....##..##..##.",
    ".....##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    "################",
    "................",
    "................",
    "................",
  ],

  heart: [
    "................",
    "................",
    "..###....###....",
    ".#####..#####...",
    ".#############..",
    ".#############..",
    ".#############..",
    "..###########...",
    "...#########....",
    "....#######.....",
    ".....#####......",
    "......###.......",
    ".......#........",
    "................",
    "................",
    "................",
  ],

  shoe: [
    "................",
    "................",
    "...........###..",
    "..........#####.",
    ".........######.",
    ".......#.######.",
    "......##.######.",
    "....####.######.",
    "...############.",
    "..#############.",
    ".##############.",
    ".##############.",
    ".##############.",
    "..#.##.##.##.#..",
    "................",
    "................",
  ],

  trophy: [
    "................",
    "..##########....",
    ".#.########.#...",
    ".#.########.#...",
    "...########.....",
    "...########.....",
    "....######......",
    ".....####.......",
    "......##........",
    "......##........",
    "....######......",
    "...########.....",
    "................",
    "................",
    "................",
    "................",
  ],

  team: [
    "................",
    "...###....###...",
    "...###....###...",
    "...###....###...",
    "................",
    "..#####..#####..",
    ".######..######.",
    ".######..######.",
    ".######..######.",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],

  sync: [
    "................",
    "................",
    "..........#.....",
    "..........##....",
    ".##############.",
    "..........##....",
    "..........#.....",
    "................",
    "................",
    ".....#..........",
    "....##..........",
    ".##############.",
    "....##..........",
    ".....#..........",
    "................",
    "................",
  ],

  goal: [
    "...#............",
    "...##...........",
    "...####.........",
    "...######.......",
    "...########.....",
    "...##########...",
    "...########.....",
    "...######.......",
    "...####.........",
    "...##...........",
    "...#............",
    "...#............",
    "...#............",
    "..#####.........",
    "................",
    "................",
  ],

  achieve: [
    "................",
    ".......##.......",
    ".......##.......",
    "......####......",
    "......####......",
    "..############..",
    "..############..",
    "...##########...",
    "....########....",
    "....########....",
    "...###....###...",
    "..###......###..",
    ".###........###.",
    "................",
    "................",
    "................",
  ],

  /* ── RUN TYPES ─────────────────────────────────────────────────────── */

  bolt: [
    "................",
    ".........###....",
    "........###.....",
    ".......###......",
    "......###.......",
    ".....######.....",
    "....#######.....",
    "......####......",
    ".....###........",
    "....###.........",
    "...###..........",
    "..###...........",
    ".###............",
    "................",
    "................",
    "................",
  ],

  road: [
    "................",
    "......#..#......",
    "......#..#......",
    ".....#....#.....",
    ".....#.##.#.....",
    "....#......#....",
    "....#......#....",
    "...#..##....#...",
    "...#........#...",
    "..#..........#..",
    "..#...##.....#..",
    ".#............#.",
    ".#............#.",
    "#......##......#",
    "................",
    "................",
  ],

  bike: [
    "................",
    "................",
    "................",
    "................",
    "......#####.##..",
    "......#...#.#...",
    ".....#...#..#...",
    "....#...#...#...",
    "..###..#...###..",
    ".#...#.#..#...#.",
    ".#...#....#...#.",
    ".#...#....#...#.",
    "..###......###..",
    "................",
    "................",
    "................",
  ],

  bed: [
    "................",
    "................",
    "................",
    ".##.............",
    ".##...####......",
    ".##..######.....",
    ".##############.",
    ".##############.",
    ".##############.",
    ".#..........##..",
    ".#..........##..",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],

  /* ── NAVIGATION ────────────────────────────────────────────────────── */

  dashboard: [
    "................",
    "................",
    "..#####..#####..",
    "..#####..#####..",
    "..#####..#####..",
    "..#####..#####..",
    "................",
    "................",
    "..#####..#####..",
    "..#####..#####..",
    "..#####..#####..",
    "..#####..#####..",
    "................",
    "................",
    "................",
    "................",
  ],

  clock: [
    "................",
    ".....######.....",
    "...##......##...",
    "..#..........#..",
    ".#............#.",
    ".#.....#......#.",
    "#......#.......#",
    "#......####....#",
    "#......#.......#",
    ".#............#.",
    ".#............#.",
    "..#..........#..",
    "...##......##...",
    ".....######.....",
    "................",
    "................",
  ],

  /* ── UTILITY ───────────────────────────────────────────────────────── */

  plus: [
    "................",
    "................",
    "................",
    "......####......",
    "......####......",
    "......####......",
    "..############..",
    "..############..",
    "..############..",
    "..############..",
    "......####......",
    "......####......",
    "......####......",
    "................",
    "................",
    "................",
  ],

  gear: [
    "................",
    "................",
    "......####......",
    "......####......",
    ".....######.....",
    "....########....",
    "..####....####..",
    "..####....####..",
    "..####....####..",
    "..####....####..",
    "....########....",
    ".....######.....",
    "......####......",
    "......####......",
    "................",
    "................",
  ],

  pencil: [
    "............##..",
    "...........####.",
    "..........#####.",
    ".........####...",
    "........####....",
    ".......####.....",
    "......####......",
    ".....####.......",
    "....####........",
    "...####.........",
    "..####..........",
    ".###............",
    "#.#.............",
    "##..............",
    "................",
    "................",
  ],

  trash: [
    "................",
    ".....####.......",
    "...##########...",
    "................",
    "...##########...",
    "...#..#..#..#...",
    "...#..#..#..#...",
    "...#..#..#..#...",
    "...#..#..#..#...",
    "...#..#..#..#...",
    "...#..#..#..#...",
    "...##########...",
    "................",
    "................",
    "................",
    "................",
  ],

  check: [
    "................",
    "................",
    "............###.",
    "...........###..",
    "..........###...",
    ".##......###....",
    ".###....###.....",
    "..###..###......",
    "...######.......",
    "....####........",
    ".....##.........",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],

  close: [
    "................",
    "................",
    "..##........##..",
    "..###......###..",
    "...###....###...",
    "....###..###....",
    ".....######.....",
    "......####......",
    ".....######.....",
    "....###..###....",
    "...###....###...",
    "..###......###..",
    "..##........##..",
    "................",
    "................",
    "................",
  ],

};

/* ── Metadata: label, category, semantic color, lucide icon it replaces ─ */
export const ICON_META = {
  calendar:  { label: "Calendar",   cat: "Core",       color: "green",  replaces: "Calendar" },
  runner:    { label: "Runner",     cat: "Core",       color: "green",  replaces: "Activity" },
  chart:     { label: "Chart",      cat: "Core",       color: "green",  replaces: "BarChart2" },
  heart:     { label: "Heart",      cat: "Core",       color: "red",    replaces: "Heart" },
  shoe:      { label: "Shoe",       cat: "Core",       color: "green",  replaces: "Footprints" },
  trophy:    { label: "Trophy",     cat: "Core",       color: "yellow", replaces: "Trophy" },
  team:      { label: "Team",       cat: "Core",       color: "green",  replaces: "Users" },
  sync:      { label: "Sync",       cat: "Core",       color: "green",  replaces: "RefreshCw" },
  goal:      { label: "Goal",       cat: "Core",       color: "green",  replaces: "Flag" },
  achieve:   { label: "Achieve",    cat: "Core",       color: "yellow", replaces: "Star" },
  bolt:      { label: "Tempo",      cat: "Run types",  color: "red",    replaces: "Zap" },
  road:      { label: "Long run",   cat: "Run types",  color: "purple", replaces: "Route" },
  bike:      { label: "Cross-train",cat: "Run types",  color: "blue",   replaces: "Bike" },
  bed:       { label: "Rest",       cat: "Run types",  color: "muted",  replaces: "BedDouble" },
  dashboard: { label: "Dashboard",  cat: "Navigation", color: "green",  replaces: "LayoutDashboard" },
  clock:     { label: "Pace",       cat: "Navigation", color: "green",  replaces: "Clock" },
  plus:      { label: "Add",        cat: "Utility",    color: "green",  replaces: "Plus" },
  gear:      { label: "Settings",   cat: "Utility",    color: "green",  replaces: "Settings" },
  pencil:    { label: "Edit",       cat: "Utility",    color: "green",  replaces: "Pencil" },
  trash:     { label: "Delete",     cat: "Utility",    color: "green",  replaces: "Trash2" },
  check:     { label: "Done",       cat: "Utility",    color: "green",  replaces: "Check" },
  close:     { label: "Close",      cat: "Utility",    color: "green",  replaces: "X" },
};

export const COLORS = {
  green:  "#7CFF9E",
  blue:   "#4DA3FF",
  purple: "#B36BFF",
  red:    "#FF5C5C",
  yellow: "#FFD44D",
  muted:  "#8AA0B2",
};

/**
 * PixelIcon — renders a 16×16 matrix as crisp SVG rects.
 * @param {string}  name   matrix key (see ICON_MATRICES)
 * @param {number}  size   px (default 16)
 * @param {string}  color  any CSS color (default 'currentColor')
 * @param {boolean} glow   adds the green CRT drop-shadow
 */
export function PixelIcon({ name, size = 16, color = 'currentColor', glow = false, strokeWidth, style, ...rest }) {
  const matrix = ICON_MATRICES[name];
  if (!matrix) return null;
  const rects = [];
  for (let y = 0; y < 16; y++) {
    const row = matrix[y] || '';
    for (let x = 0; x < 16; x++) {
      if (row[x] && row[x] !== '.') {
        rects.push(<rect key={y * 16 + x} x={x} y={y} width={1} height={1} />);
      }
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={color}
      shapeRendering="crispEdges"
      role="img"
      aria-hidden={rest['aria-label'] ? undefined : true}
      style={{ display: 'block', filter: glow ? `drop-shadow(0 0 1px ${color})` : undefined, ...style }}
      {...rest}
    >
      {rects}
    </svg>
  );
}

const make = (name) => {
  const C = (props) => <PixelIcon name={name} {...props} />;
  return C;
};

/* ── Named icons ──────────────────────────────────────────────────────── */
export const Calendar = make('calendar');
export const Runner = make('runner');
export const Chart = make('chart');
export const Heart = make('heart');
export const Shoe = make('shoe');
export const Trophy = make('trophy');
export const Team = make('team');
export const Sync = make('sync');
export const Goal = make('goal');
export const Achieve = make('achieve');
export const Bolt = make('bolt');
export const Road = make('road');
export const Bike = make('bike');
export const Bed = make('bed');
export const Dashboard = make('dashboard');
export const Clock = make('clock');
export const Plus = make('plus');
export const Gear = make('gear');
export const Pencil = make('pencil');
export const Trash = make('trash');
export const Check = make('check');
export const Close = make('close');

/* ── Lucide-compatible aliases (swap import path, keep JSX) ────────────── */
export const Activity = Runner;
export const BarChart2 = Chart;
export const Footprints = Shoe;
export const Users = Team;
export const RefreshCw = Sync;
export const Flag = Goal;
export const Star = Achieve;
export const Zap = Bolt;
export const Route = Road;
export const BedDouble = Bed;
export const LayoutDashboard = Dashboard;
export const Settings = Gear;
export const Trash2 = Trash;
export const X = Close;

export default PixelIcon;
