import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// NFR-05: `data/schedule.json` is the normalized grid; the source it was converted from is kept
// versioned next to it so this test can compare both, show by show.
const SCHEDULE_PATH = resolve(process.cwd(), "data/schedule.json");
const SOURCE_PATH = resolve(process.cwd(), "data/schedule-source-248dba3.json");

const SHOW_ID = /^[a-z0-9-]{1,64}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

type SourceShow = { nombre: string; subtitulo?: string; inicio: string; fin: string };
type Source = {
  dias: { dia: string; escenarios: { nombre: string; artistas: SourceShow[] }[] }[];
};

type ScheduleFile = {
  festival: { timeZone: string };
  days: { id: string; name: string; date: string; position: number }[];
  stages: { id: string; name: string; position: number }[];
  shows: {
    id: string;
    dayId: string;
    stageId: string;
    artist: string;
    subtitle?: string;
    start: string;
    end: string;
  }[];
};

const SOURCE_DAYS: Readonly<Record<string, string>> = {
  Viernes: "fri",
  Sábado: "sat",
  Domingo: "sun",
};

const SOURCE_STAGES: Readonly<Record<string, string>> = {
  "Flow Stage": "flow",
  "Samsung Stage": "samsung",
  "Alternative Stage": "alternative",
  "Perry's Stage": "perrys",
  KidzaPalooza: "kidzapalooza",
};

/** The fields a show is compared by, in a stable order (the id is a name, not one of them). */
type ShowKey = [
  day: string,
  stage: string,
  artist: string,
  subtitle: string | null,
  start: string,
  end: string,
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sortKeys(keys: ShowKey[]): ShowKey[] {
  return [...keys].sort((a, b) => a.join("|").localeCompare(b.join("|")));
}

function sourceKeys(source: Source): ShowKey[] {
  return source.dias.flatMap((day) =>
    day.escenarios.flatMap((stage) =>
      stage.artistas.map((show): ShowKey => {
        const dayId = SOURCE_DAYS[day.dia];
        const stageId = SOURCE_STAGES[stage.nombre];
        expect(dayId, `día desconocido en la fuente: ${day.dia}`).toBeDefined();
        expect(stageId, `escenario desconocido en la fuente: ${stage.nombre}`).toBeDefined();
        return [
          dayId ?? "",
          stageId ?? "",
          show.nombre,
          show.subtitulo ?? null,
          show.inicio,
          show.fin,
        ];
      }),
    ),
  );
}

function scheduleKeys(schedule: ScheduleFile): ShowKey[] {
  return schedule.shows.map((show): ShowKey => [
    show.dayId,
    show.stageId,
    show.artist,
    show.subtitle ?? null,
    show.start,
    show.end,
  ]);
}

describe("data/schedule.json", () => {
  const schedule = readJson<ScheduleFile>(SCHEDULE_PATH);
  const source = readJson<Source>(SOURCE_PATH);

  it("test-schedule-data-matches-source: the 91 shows match the source one to one, with 3 days, 5 stages in order and unique well-formed ids", () => {
    expect(schedule.festival).toStrictEqual({ timeZone: "America/Argentina/Buenos_Aires" });
    expect(schedule.days).toStrictEqual([
      { id: "fri", name: "Viernes", date: "2026-03-13", position: 1 },
      { id: "sat", name: "Sábado", date: "2026-03-14", position: 2 },
      { id: "sun", name: "Domingo", date: "2026-03-15", position: 3 },
    ]);
    expect(schedule.stages).toStrictEqual([
      { id: "flow", name: "Flow", position: 1 },
      { id: "samsung", name: "Samsung", position: 2 },
      { id: "alternative", name: "Alternative", position: 3 },
      { id: "perrys", name: "Perry's", position: 4 },
      { id: "kidzapalooza", name: "Kidzapalooza", position: 5 },
    ]);

    const expected = sortKeys(sourceKeys(source));
    expect(expected).toHaveLength(91);
    expect(schedule.shows).toHaveLength(91);
    // Same multiset of shows: nothing missing, nothing extra, every field equal.
    expect(sortKeys(scheduleKeys(schedule))).toStrictEqual(expected);

    const ids = schedule.shows.map((show) => show.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const show of schedule.shows) {
      expect(show.id, show.id).toMatch(SHOW_ID);
      // Assigned once at conversion as `{day}-{stage}-{HHMM}`; never recomputed afterwards.
      expect(show.id, show.id).toMatch(new RegExp(`^${show.dayId}-${show.stageId}-\\d{4}$`));
      expect(show.start, show.id).toMatch(HH_MM);
      expect(show.end, show.id).toMatch(HH_MM);
      expect(show.artist.trim(), show.id).not.toBe("");
      // `subtitle` only exists when the source has one: never an empty or null placeholder.
      if ("subtitle" in show) {
        expect(typeof show.subtitle, show.id).toBe("string");
        expect(show.subtitle?.trim(), show.id).not.toBe("");
      }
    }
  });

  it("test-schedule-data-after-midnight: Peggy Gou, Skrillex and Kygo keep their after-midnight ends", () => {
    const byArtist = (artist: string) => schedule.shows.filter((show) => show.artist === artist);

    expect(byArtist("Peggy Gou")).toStrictEqual([
      {
        id: "fri-samsung-2330",
        dayId: "fri",
        stageId: "samsung",
        artist: "Peggy Gou",
        start: "23:30",
        end: "01:00",
      },
    ]);
    expect(byArtist("Skrillex")).toMatchObject([{ dayId: "sat", start: "23:45", end: "01:00" }]);
    expect(byArtist("Kygo")).toMatchObject([{ dayId: "sun", start: "23:20", end: "00:35" }]);
  });

  it("keeps Arjaus Crew as three different shows, one per day, each with its own subtitle", () => {
    const arjaus = schedule.shows.filter((show) => show.artist === "Arjaus Crew");

    expect(arjaus.map((show) => [show.dayId, show.subtitle])).toStrictEqual([
      ["fri", "Franco y Mateo Trocca - B2B"],
      ["sat", "Mateo Trocca"],
      ["sun", "Franco Trocca"],
    ]);
    expect(new Set(arjaus.map((show) => show.id)).size).toBe(3);
  });
});
