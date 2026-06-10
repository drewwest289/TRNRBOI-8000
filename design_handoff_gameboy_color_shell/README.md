# Handoff: Game Boy Color Device Shell (TRNRBOI 8000)

## Overview
This is a **retro Game Boy Color hardware shell** that wraps the TRNRBOI 8000 running-trainer
app. The whole experience is presented as if it were running on a translucent grape-purple
handheld console: a glossy plastic body in iPhone portrait proportions, a dark screen bezel,
a large full-color backlit display, and physical controls (D-pad, A/B keys, START/SELECT).

The goal is to give the existing React app a playful, on-brand physical-device frame —
NOT to replace the app's screens. The app content lives inside the "screen"; the shell is
chrome around it.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that
shows the intended look and behavior. They are **not** production code to copy verbatim. The
task is to **recreate this shell in the existing codebase** (React + Vite + Tailwind, styling
via CSS variables in `src/index.css`) using its established patterns, tokens, and components.

The prototype reuses the app's real design tokens (`--green`, `--blue`, `--purple`, `--red`,
`--orange`, `--yellow`, `--bg-primary`, `--magenta`, Space Mono + Press Start 2P, the scanline
overlay, sharp corners). When implementing, pull these from `src/index.css` / `src/lib/colors.js`
rather than re-declaring hex values — the one new concept here is the **shell plastic** and the
**selectable screen palettes**, documented below.

## Fidelity
**High-fidelity.** Colors, proportions, typography, and interactions are final. Recreate the
shell pixel-faithfully, then mount the existing app views inside the screen area.

## Files
- `Device Concept iPhone.html` — the full working prototype (open in a browser). Contains the
  shell, screen, controls, and a small self-contained demo of dashboard/week/stats views so you
  can see the interactions. **In the real app, the demo screen content is replaced by the live
  app routes** (`Nav` tabs: Dashboard / Plan / Stats / Team / History).
- `buttons.css` — the control component styles (`.dpad`, `.ab-key`, `.pill-key`, `.btn-chunky`).
  These already exist in the app's button system; reuse them.
- `icon-data.js` / `icon-data-extra.js` — the 16×16 pixel-icon bitmaps used for the D-pad
  chevrons and the wordmark runner glyph. The app already has equivalents in
  `src/icons/PixelIcons.jsx`; prefer those.

---

## The Shell — Structure & Layout

The device is a single fixed-size element (`392 × 844 px`, ≈ iPhone 9:19.5 portrait) that is
scaled to fit the viewport with a `transform: scale()` wrapper. It is a vertical flex column:

```
.device  (392×844, flex column, radius 54px, translucent grape gradient)
├── .topstrip   — power LED + "POWER" + center tagline
├── .bezel      — dark screen surround (radius 18px)
│   ├── .micro  — "TRNRBOI · COLOR · STEREO SOUND" micro-label row
│   └── .screen — THE DISPLAY (height 452px) ← app content mounts here
├── .wordmark   — runner glyph + "TRNRBOI" + "8000"
└── .deck       — controls: [D-pad] [START/SELECT] [A/B], 3-col grid
    + .speaker  — absolutely-positioned diagonal speaker grille (bottom-right)
```

### Device body (`.device`)
- **Size:** `width: 392px; height: 844px; padding: 18px 20px 22px;`
- **Radius:** `border-radius: 54px;`
- **Translucent grape plastic** (the headline change — this is what makes it "Game Boy Color"):
  ```css
  background: linear-gradient(158deg,
    rgba(196,170,226,0.50),
    rgba(128,94,176,0.46) 44%,
    rgba(94,63,138,0.56));
  box-shadow:
    inset 0 2px 0 rgba(255,255,255,0.62),     /* top highlight */
    inset 0 -8px 20px rgba(38,18,68,0.45),    /* bottom shade */
    inset 0 0 0 2px rgba(168,140,205,0.55),   /* edge */
    inset 0 0 70px rgba(70,40,112,0.32),      /* internal depth */
    0 30px 70px rgba(22,10,42,0.65);          /* drop shadow */
  ```
  The semi-transparent purples sit over the page's dark grid background, so the plastic reads
  as *smoked/see-through* — that translucency is the whole point. Keep the page background dark.
- **Gloss sheen** via `::before` (a diagonal white-to-transparent gradient, same radius), and a
  thin inner edge via `::after` (`inset: 7px; border: 1px solid rgba(255,255,255,0.22)`).
  Children are `position: relative; z-index: 1` so they sit above the sheen.

### Top strip (`.topstrip`)
- Flex row, `gap: 10px`. Left: 11px round **power LED** (`--red` when on, dark `#5a1414` when
  off, red glow when lit). Then an 8px "POWER" label. Then a centered tagline
  `━ TRAIN. RUN. LEVEL UP. ━` (the `━` accents use `--magenta`).
- All plastic-surface labels use ink color `--label-ink: #2e1c47` (deep plum) for contrast on
  the purple shell.

### Screen bezel (`.bezel`)
- Dark charcoal surround: `background: #2a2230; padding: 18px 18px 20px; border-radius: 18px;`
  with `inset` shadow + a 2px inner edge (`#191320`) — the molded black screen frame.
- `.micro` label row above the glass: 7px uppercase, `#7a7a85`, space-between, with a small dot
  separator. Text: `TRNRBOI` · `COLOR · STEREO SOUND`.

---

## THE SCREEN — Full-Color Backlit Display

This is the core change from the previous concept: **the old monochrome green dot-matrix LCD is
gone.** The screen is now a vibrant, full-color backlit display.

- **Container:** `.screen { height: 452px; padding: 16px 17px; overflow: hidden; position: relative; }`
- **Background:** driven by CSS variables so the palette can be swapped at runtime (see SELECT):
  ```css
  background: var(--scr-bg); color: var(--scr-text);
  background-image:
    radial-gradient(120% 80% at 50% -10%, var(--scr-glow), transparent 60%),  /* top backlight */
    linear-gradient(var(--grid-line) 1px, transparent 1px),                   /* retro grid */
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: auto, 16px 16px, 16px 16px;
  ```
- **Glass reflection** via `::before` (diagonal white gradient, `z-index: 3`) and **scanlines**
  via `::after` (`repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 2px, transparent 2px 4px)`,
  `z-index: 3`). Both are `pointer-events: none`.
- App content lives in `.sc` (a full-height flex column, `z-index: 2`).

### Selectable screen palettes (SELECT button — a Game Boy Color nod)
The original Game Boy Color let you swap the color palette at boot. We mirror that: **SELECT
cycles three screen palettes.** Each palette only changes the screen's *background tint, text
color, and backlight glow* — the run-type accent colors stay constant so every workout keeps its
identity (Easy = green, Tempo = red, Long = purple, etc).

| Palette | `--scr-bg` | `--scr-text` | `--scr-glow` |
|---------|-----------|-------------|-------------|
| GRAPE (default) | `#120A24` | `#ECE4FB` | `rgba(179,107,255,0.26)` |
| BERRY | `#200A1C` | `#FCE4EE` | `rgba(255,92,168,0.28)` |
| OCEAN | `#06141F` | `#DFF1FF` | `rgba(77,163,255,0.28)` |

Implementation: store `palette` in state, set the three CSS variables on the `.screen` element
(`el.style.setProperty('--scr-bg', …)`), persist the choice to `localStorage`. The transition
uses `steps(1)` for an instant retro snap, matching the app's `transition-timing-function:
steps(1)` convention.

---

## Controls (`.deck`)

A 3-column grid: `grid-template-columns: auto 1fr auto; align-items: center;`. All control styles
already exist in `buttons.css` — **reuse them**. Sizes below are the device-scoped overrides used
in the shell (slightly larger than the defaults in `buttons.css`):

### D-pad (left)
- Markup: `.dpad > .dpad-btn.dpad-up/left/right/down + .dpad-hub` (a 3×3 grid).
- Shell size override: `.dpad { width: 108px; height: 108px; grid-template-columns: repeat(3,36px); grid-template-rows: repeat(3,36px); }`
- Dark plastic keys (`--key-face: #3A4658`, edge `--key-deep: #1A2230`), 3px bottom bevel,
  travels `translateY(3px)` on press. Each direction holds a 13px pixel chevron icon.
- **Behavior:** ←/→ select the previous/next day (and jump to the Week view); ↑/↓ cycle views.

### START / SELECT (center)
- `.pill-key` angled console pills, `gap: 18px`. Labels "SELECT" and "START".
- **START** = power toggle (sleep/wake — shows the boot splash). **SELECT** = cycle screen palette.

### A / B keys (right)
- Round magenta hardware buttons (`.ab-key`, `56px`, `border-radius: 50%`, `--magenta` face with
  `--magenta-deep` bevel). Shell override: `52px`. **A sits higher than B** (`.lifted` →
  `translateY(-12px)`), echoing the physical device. Press travels `translateY(5px)`.
- Labels under each (`.ab-label`): **A = "LOG"**, **B = "BACK"**.
- **Behavior:** A logs the selected day's run (fires a toast); B returns to the Dashboard view.

### Wordmark (`.wordmark`, between screen and controls)
- Centered row, `gap: 11px`: 26px runner pixel-glyph (color `#2e1c47`) + "TRNRBOI" in
  Press Start 2P 19px (`--label-ink`) + "8000" in Press Start 2P 12px (`--magenta`).

### Speaker grille (`.speaker`)
- Absolutely positioned bottom-right, `rotate(-22deg)`, five vertical bars of increasing then
  decreasing height (`22→27→30→27→22px`), color `--shell-deep` at `opacity: 0.6`. Decorative only.

---

## Interactions & Behavior

| Input | Key | Action |
|-------|-----|--------|
| D-pad ← / → | Arrow L/R | Previous / next day (enters Week view from Dashboard) |
| D-pad ↑ / ↓ | Arrow U/D | Cycle through views (Dash → Week → Stats) |
| A | `a` | Log the selected day's run → toast "✓ <TYPE> LOGGED · +<xp> XP" |
| B | `b` | Back to Dashboard view |
| START | Enter | Power toggle (sleep/wake; shows boot splash when off) |
| SELECT | Shift | Cycle screen color palette (GRAPE → BERRY → OCEAN) |

- **Press feedback:** every key travels down (`translateY`) for ~90ms on click/keypress.
- **Boot splash** (power off): full-screen `#0B0F1A`, "TRNRBOI 8000" logo in `--magenta` with
  glow, blinking "▶ PRESS START" in `--green` (1s `steps(1)` blink).
- **Toast:** top-center pill, `--green` background, dark text, 1.3s auto-dismiss.
- In the real app, map these controls onto the existing routes/actions: D-pad ↑/↓ → `Nav` tab
  switching, ←/→ → day navigation within Plan, A → open/confirm the run-log drawer
  (`DayDrawer` / `ActivityDetailModal`), B → close/back, START → a sleep/lock overlay (optional),
  SELECT → palette toggle persisted in `localStorage`.

## State Management
Minimal local state for the shell itself:
- `power: boolean` — wake/sleep (boot splash visibility, LED state).
- `palette: 0 | 1 | 2` — current screen palette index (persist to `localStorage`).
- The remaining state (selected day, active view) is **already owned by the app** — the shell
  just forwards control events into the existing handlers/router.

## Design Tokens

**Reuse from the codebase** (`src/index.css` / `src/lib/colors.js`):
`--green #7CFF9E`, `--blue #4DA3FF`, `--purple #B36BFF`, `--red #FF5C5C`, `--orange #FF8C42`,
`--yellow #FFD44D`, `--bg-primary #0B0F1A`, `--text-primary #E6F5E6`, `--text-muted #8AA0B2`,
`--grid-line #1D2433`, `--magenta #FF4D8D` (buttons.css). Fonts: Space Mono (body),
Press Start 2P (display). Sharp corners (`border-radius: 0` everywhere except the A/B keys and
the shell/bezel radii below).

**New tokens introduced by this shell:**
| Token | Value | Use |
|-------|-------|-----|
| Shell gradient | `rgba(196,170,226,.50) → rgba(128,94,176,.46) → rgba(94,63,138,.56)` | translucent grape plastic |
| `--label-ink` | `#2e1c47` | text on the purple shell |
| `--bezel` | `#2a2230` | screen surround |
| `--bezel-edge` | `#191320` | bezel inner edge |
| `--shell-deep` | `#5C3F8A` | speaker bars |
| Shell radius | `54px` | device body |
| Bezel radius | `18px` | screen frame |
| Screen height | `452px` | display area |
| `--scr-bg` / `--scr-text` / `--scr-glow` | see palette table | runtime-swapped screen palette |

## Assets
- Pixel icons (D-pad chevrons, runner glyph, stat icons) come from the bundled `icon-data*.js`
  bitmaps; the app already ships these as React components in `src/icons/PixelIcons.jsx` — use
  those. No raster images are required for the shell.

## Recommended implementation path
1. Build a `DeviceShell` component that renders the body / bezel / wordmark / controls and takes
   the app screen as `children` (mounted into `.screen`). Scale-to-fit via a `transform: scale()`
   wrapper computed from `window.innerWidth/Height`.
2. Move the three new shell tokens into `:root` in `src/index.css`; keep the grape gradient and
   palette variables there too.
3. Wire the controls to existing app actions (see Interactions table). Persist `palette` to
   `localStorage`.
4. Reuse `buttons.css` control classes for the D-pad / A-B / START-SELECT.
