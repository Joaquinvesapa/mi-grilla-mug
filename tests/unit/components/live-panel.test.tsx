import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LivePanel } from "@/components/live-panel";
import { posterTimeToInstant } from "@/lib/festival-time";
import {
  DONE_FOR_TODAY,
  FESTIVAL_OVER,
  NO_LIVE_SHOWS,
  CLASH_LABEL,
  NOTHING_NOW,
  PROGRESS_LABEL,
  SELECTED_LABEL,
} from "@/lib/live-messages";
import { liveNow } from "@/lib/live-now";
import type { Schedule } from "@/lib/schedule-types";

afterEach(cleanup);

// The real grid, `data/schedule.json`, with its poster times turned into instants as the seed does.
type ScheduleFile = {
  days: Schedule["days"];
  stages: Schedule["stages"];
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

const DATES = new Map(FILE.days.map((day) => [day.id, day.date]));

const SCHEDULE: Schedule = {
  days: FILE.days.map((day) => ({ ...day })),
  stages: FILE.stages.map((stage) => ({ ...stage })),
  shows: FILE.shows.map((show) => {
    const date = DATES.get(show.dayId) ?? "";
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

const NONE: ReadonlySet<string> = new Set();

/** A wall-clock time in Buenos Aires as an instant. */
function at(date: string, time: string): Date {
  return new Date(`${date}T${time}:00-03:00`);
}

function renderAt(
  date: string,
  time: string,
  selected: ReadonlySet<string> = NONE,
  schedule = SCHEDULE,
) {
  return render(<LivePanel view={liveNow(schedule, at(date, time), selected)} />);
}

function stageRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-live-stage]")];
}

function row(container: HTMLElement, stageId: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-live-stage="${stageId}"]`);
  if (!found) throw new Error(`no row for ${stageId}`);
  return found;
}

function nowLine(container: HTMLElement, stageId: string): HTMLElement {
  const line = row(container, stageId).querySelector<HTMLElement>("[data-live-now]");
  if (!line) throw new Error(`no "Ahora" line for ${stageId}`);
  return line;
}

function nextLine(container: HTMLElement, stageId: string): HTMLElement {
  const line = row(container, stageId).querySelector<HTMLElement>("[data-live-next]");
  if (!line) throw new Error(`no "Sigue" line for ${stageId}`);
  return line;
}

describe("LivePanel", () => {
  it("live-panel: muestra ahora y sigue de los 5 escenarios a las 22:30", () => {
    const { container } = renderAt("2026-03-13", "22:30");

    expect(stageRows(container).map((item) => item.dataset.liveStage)).toEqual([
      "flow",
      "samsung",
      "alternative",
      "perrys",
      "kidzapalooza",
    ]);
    expect(row(container, "flow")).toHaveTextContent("Flow");

    expect(row(container, "flow")).toHaveTextContent("Ahora");
    expect(nowLine(container, "flow")).toHaveTextContent(
      "Tyler, The Creator 22:15 – 23:30 · quedan 60 min",
    );
    expect(nextLine(container, "flow")).toHaveTextContent(`Sigue: ${DONE_FOR_TODAY}`);

    expect(nowLine(container, "samsung")).toHaveTextContent(NOTHING_NOW);
    expect(nextLine(container, "samsung")).toHaveTextContent("Sigue: Peggy Gou 23:30 (en 60 min)");

    expect(nowLine(container, "alternative")).toHaveTextContent("Turf 22:15 – 23:30");
    expect(nowLine(container, "perrys")).toHaveTextContent("¥ousuk€ ¥uk1mat$u 22:15 – 23:30");

    expect(nowLine(container, "kidzapalooza")).toHaveTextContent(NOTHING_NOW);
    expect(nextLine(container, "kidzapalooza")).toHaveTextContent(`Sigue: ${DONE_FOR_TODAY}`);

    // Texts wrap instead of scrolling sideways (NFR-04): no row has a horizontal scroll of its own.
    for (const item of stageRows(container)) {
      expect(item).toHaveClass("min-w-0");
      expect(nowLine(container, item.dataset.liveStage ?? "")).toHaveClass(
        "[overflow-wrap:anywhere]",
      );
    }
    // No minute-by-minute announcements (decisions, finding 13).
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("live-panel: Alternative primero con Turf elegido", () => {
    const withTurf = renderAt("2026-03-13", "22:30", new Set(["fri-alternative-2215"]));
    expect(stageRows(withTurf.container).map((item) => item.dataset.liveStage)).toEqual([
      "alternative",
      "flow",
      "samsung",
      "perrys",
      "kidzapalooza",
    ]);
    cleanup();

    // Without a chosen show playing: the app's order (AC-08).
    const none = renderAt("2026-03-13", "22:30");
    expect(stageRows(none.container).map((item) => item.dataset.liveStage)).toEqual([
      "flow",
      "samsung",
      "alternative",
      "perrys",
      "kidzapalooza",
    ]);
  });

  it("live-panel: elegido con ícono y texto visible en ahora, ícono en sigue", () => {
    const { container } = renderAt(
      "2026-03-13",
      "22:30",
      new Set(["fri-flow-2215", "fri-samsung-2330"]),
    );

    // Playing and chosen: check + visible «Elegido» in the row's status, no clash.
    const tyler = row(container, "flow");
    const status = tyler.querySelector<HTMLElement>("[data-live-status]");
    expect(status).not.toBeNull();
    expect(within(status as HTMLElement).getByText(SELECTED_LABEL)).not.toHaveClass("sr-only");
    const tylerIcon = status?.querySelector("svg.lucide-check");
    expect(tylerIcon).not.toBeNull();
    expect(tylerIcon).toHaveAttribute("aria-hidden", "true");
    expect(tylerIcon).toHaveClass("text-primary");
    expect(within(tyler).queryByText(CLASH_LABEL)).toBeNull();

    // The next show keeps the check and the hidden name.
    const peggy = nextLine(container, "samsung");
    expect(within(peggy).getByText(SELECTED_LABEL)).toHaveClass("sr-only");
    expect(peggy.querySelector("svg.lucide-check")).not.toBeNull();

    // Only the chosen ones: Turf is not.
    expect(within(row(container, "alternative")).queryByText(SELECTED_LABEL)).toBeNull();
    expect(row(container, "alternative").querySelector("svg.lucide-check")).toBeNull();
    expect(screen.getAllByText(SELECTED_LABEL)).toHaveLength(2);
  });

  it("live-panel: choque con ícono de triángulo en color de texto y texto «Choque»", () => {
    const { container } = renderAt(
      "2026-03-13",
      "22:30",
      new Set(["fri-flow-2215", "fri-alternative-2215"]),
    );

    for (const stageId of ["flow", "alternative"]) {
      const status = row(container, stageId).querySelector<HTMLElement>("[data-live-status]");
      expect(within(status as HTMLElement).getByText(CLASH_LABEL)).toBeInTheDocument();
      const triangle = status?.querySelector("svg.lucide-triangle-alert");
      expect(triangle).toHaveAttribute("aria-hidden", "true");
      expect(triangle).toHaveClass("text-foreground");
      expect(within(status as HTMLElement).getByText(SELECTED_LABEL)).toBeInTheDocument();
    }
    expect(screen.getAllByText(CLASH_LABEL)).toHaveLength(2);
  });

  it("live-panel: escenario sonando con punto, Ahora, chip y barra del color y avance love", () => {
    const { container } = renderAt("2026-03-13", "22:30");

    const flow = row(container, "flow");
    expect(flow).toHaveAttribute("data-playing", "true");
    // The stage's colors as custom properties: foam on base text.
    expect(flow.style.getPropertyValue("--stage")).toBe("#9ccfd8");
    expect(flow.style.getPropertyValue("--on-stage")).toBe("#191724");
    const chip = flow.querySelector("[data-live-chip]");
    expect(chip).toHaveTextContent("Flow");
    expect(chip).toHaveClass("bg-(--stage)", "text-(--on-stage)");
    expect(flow.querySelector("[data-live-bar]")).toHaveClass("w-1", "bg-(--stage)");
    // Playing: live dot + «Ahora» in text, at full opacity.
    const status = flow.querySelector("[data-live-status]");
    expect(status).toHaveTextContent("Ahora");
    expect(status?.querySelector("[data-live-dot]")).not.toBeNull();
    expect(flow.querySelector(".opacity-60")).toBeNull();
    // Progress: 15 of 75 minutes, love.
    const bar = within(flow).getByRole("progressbar", { name: PROGRESS_LABEL });
    expect(bar).toHaveAttribute("aria-valuenow", "20");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar.firstElementChild).toHaveClass("bg-rp-love");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("20%");
    // Perry's is pine, which reads with light text.
    expect(row(container, "perrys").style.getPropertyValue("--on-stage")).toBe("#e0def4");
  });

  it("live-panel: escenario sin show queda atenuado, sin punto ni avance, y sigue mostrando Sigue", () => {
    const { container } = renderAt("2026-03-13", "22:30");

    const samsung = row(container, "samsung");
    expect(samsung).toHaveAttribute("data-playing", "false");
    expect(samsung.querySelector("[data-live-dot]")).toBeNull();
    expect(samsung.querySelector("[data-live-status]")).toBeNull();
    expect(within(samsung).queryByRole("progressbar")).toBeNull();
    expect(samsung).not.toHaveTextContent("Ahora");
    // Texts at ~60 %, the chip and the bar softer than the stage's color.
    expect(samsung.querySelector(".opacity-60")).toHaveTextContent("Nada ahora");
    expect(samsung.querySelector(".opacity-60")).toHaveTextContent("Sigue: Peggy Gou");
    expect(samsung.querySelector("[data-live-chip]")).not.toHaveClass("bg-(--stage)");
    expect(samsung.querySelector("[data-live-bar]")).not.toHaveClass("bg-(--stage)");
    expect(samsung.querySelector("[data-live-chip]")).toHaveClass("text-(--on-stage)");
    // No «live» marker anywhere on a stage that plays nothing; the done stage too.
    expect(row(container, "kidzapalooza").querySelector("[data-live-dot]")).toBeNull();
    expect(row(container, "kidzapalooza")).toHaveTextContent(`${NOTHING_NOW}`);
    expect(row(container, "kidzapalooza")).toHaveTextContent(DONE_FOR_TODAY);
  });

  it("live-panel: idle y over", () => {
    const idle = renderAt("2026-03-14", "10:00");
    expect(idle.container).toHaveTextContent(NO_LIVE_SHOWS);
    expect(idle.container).toHaveTextContent("Sigue hoy a las 13:45 — Tobika en Samsung");
    expect(stageRows(idle.container)).toHaveLength(0);
    cleanup();

    const over = renderAt("2026-03-16", "00:35");
    expect(over.container).toHaveTextContent(FESTIVAL_OVER);
    expect(over.container).not.toHaveTextContent(NO_LIVE_SHOWS);
    expect(stageRows(over.container)).toHaveLength(0);
  });

  it("live-panel: un show con instante inválido en la grilla se ignora sin romper el panel", () => {
    const altered: Schedule = {
      ...SCHEDULE,
      shows: SCHEDULE.shows.map((show) =>
        show.id === "fri-flow-2215" ? { ...show, startsAt: "<img src=x onerror=alert(1)>" } : show,
      ),
    };

    const { container } = renderAt("2026-03-13", "22:30", NONE, altered);

    // Tyler is gone, Flow says nothing plays, and the rest of the panel is there.
    expect(nowLine(container, "flow")).toHaveTextContent(NOTHING_NOW);
    expect(container).not.toHaveTextContent("Tyler");
    expect(nowLine(container, "alternative")).toHaveTextContent("Turf 22:15 – 23:30");
    expect(stageRows(container)).toHaveLength(5);
    expect(container.querySelector("img")).toBeNull();
  });
});
