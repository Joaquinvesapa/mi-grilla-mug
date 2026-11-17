// A small festival grid for the screen's component tests: real ids and times from
// data/schedule.json, with the stages deliberately out of order so the tests prove the grid sorts
// them by position.
import { posterTimeToInstant } from "@/lib/festival-time";
import type { FestivalDay, Schedule, Show, Stage } from "@/lib/schedule-types";

export const DAYS: FestivalDay[] = [
  { id: "fri", name: "Viernes", date: "2026-03-13", position: 1 },
  { id: "sat", name: "Sábado", date: "2026-03-14", position: 2 },
  { id: "sun", name: "Domingo", date: "2026-03-15", position: 3 },
];

export const STAGES: Stage[] = [
  { id: "perrys", name: "Perry's", position: 4 },
  { id: "flow", name: "Flow", position: 1 },
  { id: "kidzapalooza", name: "Kidzapalooza", position: 5 },
  { id: "samsung", name: "Samsung", position: 2 },
  { id: "alternative", name: "Alternative", position: 3 },
];

const DATES: Record<string, string> = {
  fri: "2026-03-13",
  sat: "2026-03-14",
  sun: "2026-03-15",
};

function show(
  id: string,
  artist: string,
  start: string,
  end: string,
  subtitle: string | null = null,
): Show {
  const [dayId = "", stageId = ""] = id.split("-");
  const date = DATES[dayId] ?? "";
  return {
    id,
    dayId,
    stageId,
    artist,
    subtitle,
    startsAt: posterTimeToInstant(date, start).toISOString(),
    endsAt: posterTimeToInstant(date, end).toISOString(),
  };
}

export const SHOWS: Show[] = [
  show("fri-kidzapalooza-1500", "Arjaus Crew", "15:00", "15:45", "Franco y Mateo Trocca - B2B"),
  show("fri-samsung-1700", "Royel Otis", "17:00", "18:00"),
  show("fri-flow-1800", "DJO", "18:00", "19:00"),
  show("fri-perrys-1815", "Easykid", "18:15", "19:15"),
  show("fri-samsung-2330", "Peggy Gou", "23:30", "01:00"),
  show("sat-flow-1800", "Marina", "18:00", "19:00"),
  show("sun-kidzapalooza-1500", "Arjaus Crew", "15:00", "15:45", "Franco Trocca"),
];

export const SCHEDULE: Schedule = { days: DAYS, stages: STAGES, shows: SHOWS };

export function showsOf(dayId: string): Show[] {
  return SHOWS.filter((item) => item.dayId === dayId);
}

/** The block of a show, found by its stable id (never by the artist). */
export function blockOf(container: ParentNode, showId: string): HTMLElement {
  const block = container.querySelector<HTMLElement>(`[data-show-id="${showId}"]`);
  if (!block) {
    throw new Error(`no block for ${showId}`);
  }
  return block;
}
