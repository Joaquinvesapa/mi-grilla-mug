import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { formatClock, posterTimeToInstant } from "@/lib/festival-time";
import { liveNow, type LiveView } from "@/lib/live-now";
import type { Schedule } from "@/lib/schedule-types";

// The real grid: `data/schedule.json`, with its poster times (`HH:MM`) turned into instants the
// same way the seed does.
type ScheduleFile = {
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

const FILE = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/schedule.json"), "utf8"),
) as ScheduleFile;

function toSchedule(file: ScheduleFile): Schedule {
  const dates = new Map(file.days.map((day) => [day.id, day.date]));
  return {
    days: file.days.map((day) => ({ ...day })),
    stages: file.stages.map((stage) => ({ ...stage })),
    shows: file.shows.map((show) => {
      const date = dates.get(show.dayId) ?? "";
      return {
        id: show.id,
        dayId: show.dayId,
        stageId: show.stageId,
        artist: show.artist,
        subtitle: show.subtitle ?? null,
        startsAt: posterTimeToInstant(date, show.start).toISOString(),
        endsAt: posterTimeToInstant(date, show.end).toISOString(),
      };
    }),
  };
}

const SCHEDULE = toSchedule(FILE);
const NONE: ReadonlySet<string> = new Set();

/** A wall-clock time in Buenos Aires (calendar date and `HH:MM`) as an instant. */
function at(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}

type Row = [stage: string, current: string | null, next: string | null, minutes: number | null];

/** The live panel as rows: stage, artist now, artist next and minutes until it starts. */
function rows(view: LiveView): Row[] {
  if (view.kind !== "live") {
    throw new Error(`expected live, got ${view.kind}`);
  }
  return view.stages.map((row) => [
    row.stage.name,
    row.current?.artist ?? null,
    row.next?.show.artist ?? null,
    row.next?.minutesUntil ?? null,
  ]);
}

function stageOrder(view: LiveView): string[] {
  return rows(view).map(([stage]) => stage);
}

describe("liveNow on the real grid", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("live-now: a las 22:30 del viernes, ahora y sigue de los 5 escenarios", () => {
    expect(rows(liveNow(SCHEDULE, at("2026-03-13", "22:30"), NONE))).toEqual([
      ["Flow", "Tyler, The Creator", null, null],
      ["Samsung", null, "Peggy Gou", 60],
      ["Alternative", "Turf", null, null],
      ["Perry's", "¥ousuk€ ¥uk1mat$u", null, null],
      ["Kidzapalooza", null, null, null],
    ]);
  });

  it("live-now: a las 23:30 Tyler ya no suena y Peggy Gou sí", () => {
    const view = rows(liveNow(SCHEDULE, at("2026-03-13", "23:30"), NONE));
    expect(view.find(([stage]) => stage === "Flow")?.[1]).toBeNull();
    expect(view.find(([stage]) => stage === "Samsung")?.[1]).toBe("Peggy Gou");
    // One minute earlier Tyler still plays: the end minute is the first one it does not.
    const before = rows(liveNow(SCHEDULE, at("2026-03-13", "23:29"), NONE));
    expect(before.find(([stage]) => stage === "Flow")?.[1]).toBe("Tyler, The Creator");
    expect(before.find(([stage]) => stage === "Samsung")?.[1]).toBeNull();
  });

  it("live-now: el sábado 00:30 suena Peggy Gou, del viernes", () => {
    const view = liveNow(SCHEDULE, at("2026-03-14", "00:30"), NONE);
    expect(view.kind).toBe("live");
    if (view.kind !== "live") return;
    const samsung = view.stages.find((row) => row.stage.id === "samsung");
    expect(samsung?.current?.id).toBe("fri-samsung-2330");
    expect(samsung?.next).toBeNull();
  });

  it("live-now: con Turf elegido, Alternative primero y el resto en orden", () => {
    const view = liveNow(SCHEDULE, at("2026-03-13", "22:30"), new Set(["fri-alternative-2215"]));
    expect(stageOrder(view)).toEqual(["Alternative", "Flow", "Samsung", "Perry's", "Kidzapalooza"]);
  });

  it("live-now: sin elegidos sonando, orden de la app", () => {
    const order = ["Flow", "Samsung", "Alternative", "Perry's", "Kidzapalooza"];
    expect(stageOrder(liveNow(SCHEDULE, at("2026-03-13", "22:30"), NONE))).toEqual(order);
    // Peggy Gou is chosen but does not play yet: it does not move Samsung up.
    expect(
      stageOrder(liveNow(SCHEDULE, at("2026-03-13", "22:30"), new Set(["fri-samsung-2330"]))),
    ).toEqual(order);
    // The stages array order does not matter: position does.
    const shuffled = { ...SCHEDULE, stages: [...SCHEDULE.stages].reverse() };
    expect(stageOrder(liveNow(shuffled, at("2026-03-13", "22:30"), NONE))).toEqual(order);
  });

  it("live-now: marca de elegido en el actual y en el siguiente", () => {
    const view = liveNow(
      SCHEDULE,
      at("2026-03-13", "22:30"),
      new Set(["fri-flow-2215", "fri-samsung-2330"]),
    );
    if (view.kind !== "live") throw new Error("expected live");
    const marks = view.stages.map((row) => [row.stage.id, row.currentSelected, row.nextSelected]);
    expect(marks).toEqual([
      ["flow", true, false],
      ["samsung", false, true],
      ["alternative", false, false],
      ["perrys", false, false],
      ["kidzapalooza", false, false],
    ]);
  });

  it("live-now: sábado 10:00 es idle con Tobika hoy a las 13:45", () => {
    const view = liveNow(SCHEDULE, at("2026-03-14", "10:00"), NONE);
    if (view.kind !== "idle") throw new Error(`expected idle, got ${view.kind}`);
    // Tobika (Samsung) and Paula Os (Perry's) both start at 13:45: the stage position decides.
    expect(view.next.show.id).toBe("sat-samsung-1345");
    expect(view.next.stage.name).toBe("Samsung");
    expect(view.next.day.id).toBe("sat");
    expect(view.next.sameDay).toBe(true);
    expect(formatClock(new Date(view.next.show.startsAt))).toBe("13:45");
  });

  it("live-now: sábado 02:00 es idle con el próximo show el sábado, no hoy", () => {
    // 02:00 of Saturday still belongs to Friday's festival day, whose last show ended at 01:00.
    const view = liveNow(SCHEDULE, at("2026-03-14", "02:00"), NONE);
    if (view.kind !== "idle") throw new Error(`expected idle, got ${view.kind}`);
    expect(view.next.show.id).toBe("sat-samsung-1345");
    expect(view.next.day.id).toBe("sat");
    expect(view.next.sameDay).toBe(false);
  });

  it("live-now: antes del festival es idle con el primer show del viernes", () => {
    for (const now of [at("2026-03-12", "20:00"), at("2026-03-13", "05:59")]) {
      const view = liveNow(SCHEDULE, now, NONE);
      if (view.kind !== "idle") throw new Error(`expected idle, got ${view.kind}`);
      expect(view.next.show.id).toBe("fri-samsung-1345");
      expect(view.next.day.id).toBe("fri");
      expect(view.next.sameDay).toBe(false);
    }
    // From 06:00 on Friday it is already the festival day: the first show is "hoy".
    const morning = liveNow(SCHEDULE, at("2026-03-13", "10:00"), NONE);
    if (morning.kind !== "idle") throw new Error(`expected idle, got ${morning.kind}`);
    expect(morning.next.show.id).toBe("fri-samsung-1345");
    expect(morning.next.sameDay).toBe(true);
  });

  it("live-now: desde las 00:35 del lunes es over", () => {
    const lastMinute = liveNow(SCHEDULE, at("2026-03-16", "00:34"), NONE);
    expect(rows(lastMinute).find(([stage]) => stage === "Samsung")?.[1]).toBe("Kygo");
    expect(liveNow(SCHEDULE, at("2026-03-16", "00:35"), NONE)).toEqual({ kind: "over" });
    expect(liveNow(SCHEDULE, at("2026-03-16", "10:00"), NONE)).toEqual({ kind: "over" });
    expect(liveNow(SCHEDULE, at("2026-11-18", "12:00"), NONE)).toEqual({ kind: "over" });
  });

  it("live-now: con TZ=Europe/Madrid da lo mismo que en Argentina", () => {
    const selected = new Set(["fri-alternative-2215"]);
    const moments = [
      at("2026-03-13", "22:30"),
      at("2026-03-14", "00:30"),
      at("2026-03-14", "10:00"),
      at("2026-03-16", "00:35"),
    ];
    vi.stubEnv("TZ", "America/Argentina/Buenos_Aires");
    const inArgentina = moments.map((now) => liveNow(SCHEDULE, now, selected));
    vi.stubEnv("TZ", "Europe/Madrid");
    // The stub reached the process: 22:30 in Buenos Aires is 02:30 in Madrid.
    expect(at("2026-03-13", "22:30").getHours()).toBe(2);
    const inMadrid = moments.map((now) => liveNow(SCHEDULE, now, selected));
    expect(inMadrid).toEqual(inArgentina);
    const first = inMadrid[0];
    if (first?.kind !== "live") throw new Error("expected live");
    const current = first.stages[0]?.current;
    expect(current?.artist).toBe("Turf");
    expect(formatClock(new Date(current?.startsAt ?? ""))).toBe("22:15");
  });

  it("live-now: un id inválido en la selección se ignora", () => {
    const now = at("2026-03-13", "22:30");
    const junk = new Set(["no-existe", "", "<script>alert(1)</script>", "Turf"]);
    const view = liveNow(SCHEDULE, now, junk);
    expect(view).toEqual(liveNow(SCHEDULE, now, NONE));
    // Nothing is marked and nothing moves: the app order, as with no selection at all.
    if (view.kind !== "live") throw new Error(`expected live, got ${view.kind}`);
    expect(view.stages.some((row) => row.currentSelected || row.nextSelected)).toBe(false);
    expect(stageOrder(view)).toEqual(["Flow", "Samsung", "Alternative", "Perry's", "Kidzapalooza"]);
  });

  it("live-now: un show con instante inválido se ignora", () => {
    const broken: Schedule = {
      ...SCHEDULE,
      shows: SCHEDULE.shows.map((show) =>
        show.id === "fri-flow-2215" ? { ...show, startsAt: "no es una fecha" } : show,
      ),
    };
    const view = rows(liveNow(broken, at("2026-03-13", "22:30"), NONE));
    expect(view[0]).toEqual(["Flow", null, null, null]);
    expect(view[1]).toEqual(["Samsung", null, "Peggy Gou", 60]);
    // A grid without a single readable show is over.
    const unreadable: Schedule = {
      ...SCHEDULE,
      shows: SCHEDULE.shows.map((show) => ({ ...show, endsAt: "" })),
    };
    expect(liveNow(unreadable, at("2026-03-13", "22:30"), NONE)).toEqual({ kind: "over" });
    expect(liveNow({ ...SCHEDULE, shows: [] }, at("2026-03-13", "22:30"), NONE)).toEqual({
      kind: "over",
    });
  });

  it("live-now: now inválido lanza RangeError", () => {
    expect(() => liveNow(SCHEDULE, new Date(Number.NaN), NONE)).toThrow(RangeError);
    expect(() => liveNow(SCHEDULE, new Date("no es una hora"), NONE)).toThrow("Hora inválida");
  });
});

// ---------------------------------------------------------------------------------------------
// AC-23 / NFR-03 oracle. Independent of `live-now.ts`: it never imports it and it works on the raw
// poster times of `data/schedule.json` as minutes of a festival day counted from 06:00, not on
// instants.

const MINUTE_MS = 60_000;
const DAY_MINUTES = 1440;
const BUENOS_AIRES_OFFSET_MS = 3 * 3_600_000;

/** `HH:MM` → minutes since the festival day's 06:00 (00:00–05:59 land at the end). */
function posterMinute(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return (hours * 60 + minutes - 360 + DAY_MINUTES) % DAY_MINUTES;
}

const FIRST_DATE_MS = Math.min(...FILE.days.map((day) => Date.parse(`${day.date}T00:00:00Z`)));
const DAY_INDEX = new Map(
  FILE.days.map((day) => [
    day.id,
    (Date.parse(`${day.date}T00:00:00Z`) - FIRST_DATE_MS) / (DAY_MINUTES * MINUTE_MS),
  ]),
);
const STAGE_POSITION = new Map(FILE.stages.map((stage) => [stage.id, stage.position]));

/** Every show as absolute festival minutes since the first day's 06:00. */
const ORACLE_SHOWS = FILE.shows.map((show) => {
  const base = (DAY_INDEX.get(show.dayId) ?? 0) * DAY_MINUTES;
  const start = posterMinute(show.start);
  return {
    id: show.id,
    dayId: show.dayId,
    stageId: show.stageId,
    start: base + start,
    end: base + posterMinute(show.end),
  };
});

type OracleRow = {
  stageId: string;
  current: string | null;
  currentSelected: boolean;
  next: string | null;
  minutesUntil: number | null;
  nextSelected: boolean;
};
type Oracle =
  | { kind: "live"; stages: OracleRow[] }
  | { kind: "idle"; next: string; stageId: string; dayId: string; sameDay: boolean }
  | { kind: "over" };

function oracle(nowMs: number, selected: ReadonlySet<string>): Oracle {
  const sinceFirstMorning = nowMs - BUENOS_AIRES_OFFSET_MS - FIRST_DATE_MS - 6 * 60 * MINUTE_MS;
  const nowMinute = Math.floor(sinceFirstMorning / MINUTE_MS);
  const dayIndex = Math.floor(nowMinute / DAY_MINUTES);
  const dayId = FILE.days.find((day) => DAY_INDEX.get(day.id) === dayIndex)?.id ?? null;

  if (nowMinute >= Math.max(...ORACLE_SHOWS.map((show) => show.end))) {
    return { kind: "over" };
  }
  const today = ORACLE_SHOWS.filter((show) => show.dayId === dayId);
  if (
    dayId !== null &&
    today.length > 0 &&
    nowMinute >= Math.min(...today.map((show) => show.start)) &&
    nowMinute < Math.max(...today.map((show) => show.end))
  ) {
    const stages = [...FILE.stages]
      .sort((a, b) => a.position - b.position)
      .map((stage): OracleRow => {
        const own = today.filter((show) => show.stageId === stage.id);
        const current = own.find((show) => show.start <= nowMinute && nowMinute < show.end);
        const next = own
          .filter((show) => show.start > nowMinute)
          .sort((a, b) => a.start - b.start)[0];
        return {
          stageId: stage.id,
          current: current?.id ?? null,
          currentSelected: current ? selected.has(current.id) : false,
          next: next?.id ?? null,
          minutesUntil: next ? next.start - nowMinute : null,
          nextSelected: next ? selected.has(next.id) : false,
        };
      });
    return {
      kind: "live",
      stages: [
        ...stages.filter((row) => row.currentSelected),
        ...stages.filter((row) => !row.currentSelected),
      ],
    };
  }
  const next = ORACLE_SHOWS.filter((show) => show.start > nowMinute).sort(
    (a, b) =>
      a.start - b.start ||
      (STAGE_POSITION.get(a.stageId) ?? 0) - (STAGE_POSITION.get(b.stageId) ?? 0),
  )[0];
  if (!next) {
    return { kind: "over" };
  }
  return {
    kind: "idle",
    next: next.id,
    stageId: next.stageId,
    dayId: next.dayId,
    sameDay: dayId !== null && next.dayId === dayId,
  };
}

function asOracle(view: LiveView): Oracle {
  if (view.kind === "over") return view;
  if (view.kind === "idle") {
    return {
      kind: "idle",
      next: view.next.show.id,
      stageId: view.next.stage.id,
      dayId: view.next.day.id,
      sameDay: view.next.sameDay,
    };
  }
  return {
    kind: "live",
    stages: view.stages.map((row) => ({
      stageId: row.stage.id,
      current: row.current?.id ?? null,
      currentSelected: row.currentSelected,
      next: row.next?.show.id ?? null,
      minutesUntil: row.next?.minutesUntil ?? null,
      nextSelected: row.nextSelected,
    })),
  };
}

describe("liveNow against an independent oracle", () => {
  it("live-now: cada minuto de viernes 13:00 a lunes 06:00 coincide con el oráculo", () => {
    // Every third show of the grid is chosen, so the order and the marks are walked too.
    const selected = new Set(FILE.shows.filter((_, index) => index % 3 === 0).map((s) => s.id));
    const from = at("2026-03-13", "13:00").getTime();
    const to = at("2026-03-16", "06:00").getTime();
    const kinds = new Set<string>();
    let minutes = 0;
    for (let now = from; now <= to; now += MINUTE_MS) {
      const expected = oracle(now, selected);
      const actual = asOracle(liveNow(SCHEDULE, new Date(now), selected));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        // Only the first mismatch is reported, with its minute, instead of thousands of them.
        expect({ at: new Date(now).toISOString(), view: actual }).toEqual({
          at: new Date(now).toISOString(),
          view: expected,
        });
      }
      kinds.add(expected.kind);
      minutes += 1;
    }
    // 65 hours, both ends included; and the walk went through every state of the panel.
    expect(minutes).toBe(65 * 60 + 1);
    expect([...kinds].sort()).toEqual(["idle", "live", "over"]);
  });
});
