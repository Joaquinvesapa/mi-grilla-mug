// Stage and festival-day colors (user decision, 2026-11-18; design/color-en-vivo, artboard 02):
// each stage and each day gets a Rosé Pine accent, in the app and on the wallpaper. Love is
// reserved for «En vivo» and is never a stage or day color. Pure: shared by the grid, the
// «En vivo» sheet, the /demo clock and the wallpaper canvas, which cannot read CSS tokens.

import type { CSSProperties } from "react";

import { BASE, FOAM, GOLD, IRIS, PINE, ROSE, SUBTLE, TEXT } from "@/lib/palette";

/** A fill color and the text color that reads on it. */
export type Tint = { color: string; onColor: string };

/** Pine is dark: text on it is TEXT (at weight ≥ 600); on the light accents it is BASE. */
const ON_LIGHT = BASE;
const ON_PINE = TEXT;

const STAGE_TINTS: Readonly<Record<string, Tint>> = {
  flow: { color: FOAM, onColor: ON_LIGHT },
  samsung: { color: GOLD, onColor: ON_LIGHT },
  alternative: { color: ROSE, onColor: ON_LIGHT },
  perrys: { color: PINE, onColor: ON_PINE },
  kidzapalooza: { color: IRIS, onColor: ON_LIGHT },
};

const DAY_TINTS: Readonly<Record<string, Tint>> = {
  fri: { color: GOLD, onColor: ON_LIGHT },
  sat: { color: ROSE, onColor: ON_LIGHT },
  sun: { color: PINE, onColor: ON_PINE },
};

/** A stage or day missing from the maps (new data) falls back to a neutral, never to love. */
const FALLBACK: Tint = { color: SUBTLE, onColor: BASE };

/** The color of a stage, by its stable id (`flow`, `samsung`, `alternative`, `perrys`, `kidzapalooza`). */
export function stageTint(stageId: string): Tint {
  return STAGE_TINTS[stageId] ?? FALLBACK;
}

/** The color of a festival day, by its id (`fri`, `sat`, `sun`). */
export function dayTint(dayId: string): Tint {
  return DAY_TINTS[dayId] ?? FALLBACK;
}

/** CSS custom properties for a React `style`: `var(--stage)` and `var(--on-stage)` in classes. */
export type TintStyle = CSSProperties & { "--stage": string; "--on-stage": string };

export function stageStyle(stageId: string): TintStyle {
  const { color, onColor } = stageTint(stageId);
  return { "--stage": color, "--on-stage": onColor };
}

/** Same for a day: `var(--day)` and `var(--on-day)`. */
export type DayStyle = CSSProperties & { "--day": string; "--on-day": string };

export function dayStyle(dayId: string): DayStyle {
  const { color, onColor } = dayTint(dayId);
  return { "--day": color, "--on-day": onColor };
}
