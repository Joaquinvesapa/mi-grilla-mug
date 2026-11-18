# Mi Grilla — design system

Synced 2026-11-18 from the project's sources (read only). Dark theme only, Rosé Pine palette,
mobile first (360–430 px). The canvas reads this folder through the `design → docs/design` symlink.

## Colors — Rosé Pine (`@theme`)

Source: `src/app/globals.css` (l.16–31). Mirrored for canvas drawing in `src/lib/palette.ts`.

| Token | Value | Usage |
| --- | --- | --- |
| `--color-rp-base` | `#191724` | App background; text on light accent fills |
| `--color-rp-surface` | `#1f1d2e` | Cards, show blocks, drawer background |
| `--color-rp-overlay` | `#26233a` | Popovers, secondary/muted surfaces, friend chips |
| `--color-rp-muted` | `#6e6a86` | Not mapped (3.42:1 on base — decorative only) |
| `--color-rp-subtle` | `#908caa` | Secondary text; wallpaper stage and hour labels |
| `--color-rp-text` | `#e0def4` | Main text |
| `--color-rp-love` | `#eb6f92` | `--destructive`. Decision 2026-11-18: reserved for "En vivo" |
| `--color-rp-gold` | `#f6c177` | `--warning` (clash icon). Decision 2026-11-18: Samsung |
| `--color-rp-rose` | `#ebbcba` | Not mapped. Decision 2026-11-18: Alternative |
| `--color-rp-pine` | `#31748f` | Not mapped. Decision 2026-11-18: Perry's |
| `--color-rp-foam` | `#9ccfd8` | `--primary`, `--ring`; UI accent. Decision 2026-11-18: Flow |
| `--color-rp-iris` | `#c4a7e7` | Not mapped. Decision 2026-11-18: Kidzapalooza |
| `--color-rp-highlight-low` | `#21202e` | Not mapped |
| `--color-rp-highlight-med` | `#403d52` | `--accent`, `--border`, `--input`; wallpaper hour lines |
| `--color-rp-highlight-high` | `#524f67` | iPhone frame ring on `/demo` |

## Semantic tokens (shadcn, `:root`)

Source: `src/app/globals.css` (l.37–59).

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `var(--color-rp-base)` | Page background |
| `--foreground` | `var(--color-rp-text)` | Body text |
| `--card` | `var(--color-rp-surface)` | Cards, show blocks |
| `--popover` | `var(--color-rp-overlay)` | Popovers |
| `--primary` | `var(--color-rp-foam)` | Primary actions, chosen show fill (today) |
| `--primary-foreground` | `var(--color-rp-base)` | Text on primary |
| `--secondary` | `var(--color-rp-overlay)` | Secondary buttons |
| `--muted` | `var(--color-rp-overlay)` | Muted surfaces |
| `--muted-foreground` | `var(--color-rp-subtle)` | Secondary text |
| `--accent` | `var(--color-rp-highlight-med)` | Hover / accent surfaces |
| `--destructive` | `var(--color-rp-love)` | Destructive actions |
| `--warning` | `var(--color-rp-gold)` | Clash warning |
| `--border` | `var(--color-rp-highlight-med)` | Borders |
| `--input` | `var(--color-rp-highlight-med)` | Input borders |
| `--ring` | `var(--color-rp-foam)` | Focus ring |
| `--radius` | `0.625rem` | Base radius |

## Stage and day colors (decision 2026-11-18, not yet in code)

Source: user decision recorded in `AGENTS.md` (Code conventions). Stage order is the column order.

| Stage | Token | Value | Text on fill | Contrast of fill on base |
| --- | --- | --- | --- | --- |
| Flow | `--color-rp-foam` | `#9ccfd8` | base (10.37:1) | 10.37:1 |
| Samsung | `--color-rp-gold` | `#f6c177` | base (10.77:1) | 10.77:1 |
| Alternative | `--color-rp-rose` | `#ebbcba` | base (10.45:1) | 10.45:1 |
| Perry's | `--color-rp-pine` | `#31748f` | text (3.96:1 — use ≥ 600 weight, verify) | 3.38:1 (fills/large only, never small text on base) |
| Kidzapalooza | `--color-rp-iris` | `#c4a7e7` | base (8.43:1) | 8.43:1 |
| En vivo (not a stage) | `--color-rp-love` | `#eb6f92` | base (6.07:1) | 6.07:1 |

Days (Viernes, Sábado, Domingo) also get a palette color; the artboards in this folder propose
the mapping. Love is never a day or stage color.

## Typography

Source: `src/app/layout.tsx` (l.5–9), `src/app/globals.css` (l.63).

| Token | Value | Usage |
| --- | --- | --- |
| `--font-sans` | `var(--font-public-sans), ui-sans-serif, system-ui, sans-serif` | All text (Public Sans, `next/font/google`) |

Sizes are arbitrary px in components, not tokens: stage headers `13px`, show block text `12–13px`,
live-panel stage names `text-base` semibold. Times use tabular numbers. Artboards use the system
stack (`ui-sans-serif, system-ui, sans-serif`) because they cannot load Public Sans.

## Radius

Source: `src/app/globals.css` (l.37, l.64–69).

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-sm` | `calc(var(--radius) - 4px)` | Small controls |
| `--radius-md` | `calc(var(--radius) - 2px)` | Show blocks (`rounded-md`) |
| `--radius-lg` | `var(--radius)` | Default |
| `--radius-xl` | `calc(var(--radius) + 4px)` | `.app-card`, drawer top corners |
| `--radius-2xl` | `calc(var(--radius) + 8px)` | Large surfaces |

Wallpaper blocks use a 12 px radius on the 1290 × 2796 canvas (`src/components/wallpaper-canvas.ts`).

## Shadows

No shadow tokens. In use: `shadow-lg shadow-rp-base/60` (live button), `shadow-2xl` (iPhone frame),
`shadow-xs` (outline button).

## Component rules

- **Schedule grid** (`src/components/schedule-grid.tsx`, `src/lib/schedule-layout.ts`): stages as
  columns, sticky stage header (40 px), sticky hour column (3rem), 2 px per minute, show blocks
  ≥ 44 px tall. Chosen = filled, not chosen = surface + border, unsaved = dashed border, clash =
  gold warning triangle. No current-time line today.
- **En vivo** (`src/components/live-button.tsx`, `live-panel.tsx`): round 56 px floating button,
  bottom right, opens a bottom sheet (Vaul) with one row per stage: "Ahora:" + artist + time,
  "Sigue:" + artist + "en N min"; "Nada ahora", "Terminó por hoy", "No hay shows en vivo".
- **Demo clock** (`src/components/demo-clock-control.tsx`, `src/lib/demo-clock.ts`): day tabs,
  `input type="time"` with 15-min step, "−15 min" / "+15 min"; range Fri 06:00 to Mon 06:00
  (festival day runs 06:00–06:00).
- **Wallpaper** (`src/components/wallpaper-canvas.ts`): 1290 × 2796 PNG drawn on canvas; chosen
  shows lit, the rest at 30 % opacity; today every block is foam.
- Hover styles only under `(hover: hover) and (pointer: fine)`; touch targets ≥ 44 px; respect
  `prefers-reduced-motion`.
