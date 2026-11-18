/**
 * The Spanish texts of the "En vivo" button and panel (FEAT-005a). Pure: no I/O.
 */
import { formatClock } from "@/lib/festival-time";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";

/** The floating button's accessible name and the panel's title. */
export const LIVE_LABEL = "En vivo";

/** The button that closes the panel. */
export const CLOSE_LABEL = "Cerrar";

/** Hidden text next to the icon of a chosen show (FR-08). */
export const SELECTED_LABEL = "Elegido";

/** The label of a stage's line with the show playing now (FR-03). */
export const NOW_PREFIX = "Ahora:";

/** The label of a stage's line with the show that comes next (FR-04). */
export const NEXT_PREFIX = "Sigue:";

/** A stage where nothing plays right now (FR-03). */
export const NOTHING_NOW = "Nada ahora";

/** A stage with no more shows today (FR-04). */
export const DONE_FOR_TODAY = "Terminó por hoy";

/** Outside the hours of shows (FR-10). */
export const NO_LIVE_SHOWS = "No hay shows en vivo";

/** After the festival's last show (FR-11). */
export const FESTIVAL_OVER = "El festival terminó";

/** "en 60 min": how long until the next show of a stage starts (FR-04). */
export function minutesUntilLabel(minutes: number): string {
  return `en ${minutes} min`;
}

/**
 * The next show of the festival outside the hours of shows (FR-10): "Sigue hoy a las 13:45 — Tobika
 * en Samsung", or with the day's name ("Sigue el sábado a las 13:45 — …") if it is not today.
 */
export function nextShowLabel(next: {
  show: Show;
  stage: Stage;
  day: FestivalDay;
  sameDay: boolean;
}): string {
  const when = next.sameDay ? "hoy" : `el ${next.day.name.toLocaleLowerCase("es-AR")}`;
  const clock = formatClock(new Date(next.show.startsAt));
  return `Sigue ${when} a las ${clock} — ${next.show.artist} en ${next.stage.name}`;
}
