# TRNRBOI 8000 — Pixel Icons

22 pixel-perfect 16×16 glyphs that match **Section 10** of the design system.
Game Boy green base, with semantic color variants for run types. Built to
replace the `lucide-react` icons currently used in the app.

## Files
| File | What it is |
|------|------------|
| `Pixel Icons.html` | Review gallery — all icons, zoom, CRT-glow toggle, pixel-grid toggle, in-context demos. |
| `icon-data.js` | **Single source of truth.** The raw 16×16 matrices + metadata (`# = filled, . = empty`). |
| `PixelIcons.jsx` | Drop-in React components, generated from `icon-data.js`. |

> Edit matrices in `icon-data.js`, never in the `.jsx` — regenerate so the gallery and app stay in sync.

## Adding to the app

1. Copy `PixelIcons.jsx` into the app, e.g. `src/icons/PixelIcons.jsx`.
2. Swap the import path. Because lucide-compatible aliases are exported, the JSX
   doesn't change — only the source:

```diff
- import { Calendar, Activity, Clock, Users, BarChart2, LayoutDashboard } from 'lucide-react';
+ import { Calendar, Activity, Clock, Users, BarChart2, LayoutDashboard } from '../icons/PixelIcons';
```

`Nav.jsx` then renders pixel icons with no other edits — the existing
`<Icon size={13} />` keeps working, and color inheritance via `currentColor`
already matches the active/inactive tab colors.

## API (mirrors lucide)

```jsx
import { Runner, Heart, Bike } from './icons/PixelIcons';

<Runner size={16} />                 // inherits CSS color (currentColor)
<Heart  size={20} color="#FF5C5C" /> // explicit color
<Bike   size={24} glow />            // green CRT drop-shadow
```

`size` (px, default 16) · `color` (any CSS color, default `currentColor`) ·
`glow` (bool) · plus any standard SVG/DOM prop (`className`, `onClick`, `aria-label`…).

## The set

| Group | Icons → (lucide it replaces) |
|-------|------------------------------|
| **Core** (Section 10) | Calendar, Runner→Activity, Chart→BarChart2, Heart, Shoe→Footprints, Trophy, Team→Users, Sync→RefreshCw, Goal→Flag, Achieve→Star |
| **Run types** | Bolt→Zap (tempo · red), Road→Route (long · purple), Bike (cross · blue), Bed→BedDouble (rest · muted) |
| **Navigation** | Dashboard→LayoutDashboard, Clock (pace) |
| **Utility** | Plus, Gear→Settings, Pencil, Trash→Trash2, Check, Close→X |

Run-type semantic colors live in `ICON_META[key].color` and resolve against
`COLORS` (which mirrors the design-system tokens), so the same glyph can be
recolored per run type exactly like the chips in the app.
