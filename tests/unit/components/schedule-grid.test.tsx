import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_BUTTON_CLEARANCE_PX, ScheduleGrid } from "@/components/schedule-grid";
import { posterTimeToInstant } from "@/lib/festival-time";
import type { FriendPicks } from "@/lib/group-picks";
import type { Show } from "@/lib/schedule-types";

import { blockOf, DAYS, showsOf, STAGES } from "./schedule-fixture";

// Only `Date`, at 12:00 of Friday: before the first show of the fixture, so nothing is playing and
// the now-line is off the axis, unless a test sets another time.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow("12:00");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setNow(time: string) {
  vi.setSystemTime(posterTimeToInstant("2026-03-13", time));
}

const FRIDAY = DAYS[0]!;
const CLASH_TEXT = "Choca con otro show elegido";
const SUNDAY = DAYS[2]!;

function friend(name: string, initials: string): FriendPicks {
  return { name, initials, showIds: [] };
}

/** Sunday's two 20-minute Kidzapalooza shows, as in data/schedule.json: 10 minutes apart. */
function sundayShort(id: string, start: string, end: string): Show {
  return {
    id,
    dayId: "sun",
    stageId: "kidzapalooza",
    artist: "Show corto",
    subtitle: null,
    startsAt: posterTimeToInstant(SUNDAY.date, start).toISOString(),
    endsAt: posterTimeToInstant(SUNDAY.date, end).toISOString(),
  };
}

/** The chips of a block's initials row, as drawn. */
function chipsOf(block: HTMLElement): string[] {
  const row = block.querySelector("[data-friend-picks]");
  return [...(row?.children ?? [])].map((chip) => chip.textContent ?? "");
}

function renderFriday({
  selected = [] as string[],
  pending = [] as string[],
  clashes = [] as string[],
  friendPicks = new Map<string, FriendPicks[]>(),
  onToggle = vi.fn<(showId: string) => void>(),
} = {}) {
  const view = render(
    <ScheduleGrid
      day={FRIDAY}
      stages={STAGES}
      shows={showsOf("fri")}
      selectedIds={new Set(selected)}
      pendingIds={new Set(pending)}
      clashIds={new Set(clashes)}
      friendPicks={friendPicks}
      onToggle={onToggle}
    />,
  );
  return { ...view, onToggle };
}

describe("ScheduleGrid", () => {
  it("test-grid-render: columnas en el orden de position y una marca por hora del eje", () => {
    const { container } = renderFriday();

    const region = screen.getByRole("region", { name: "Grilla del Viernes" });
    const headers = [...region.querySelectorAll("[data-stage-header]")].map(
      (header) => header.textContent,
    );
    expect(headers).toEqual(["Flow", "Samsung", "Alternative", "Perry's", "Kidzapalooza"]);

    // Friday in the fixture runs from Arjaus Crew (15:00) to Peggy Gou (01:00): 11 whole hours.
    const marks = [...container.querySelectorAll("[data-hour-mark]")].map(
      (mark) => mark.textContent,
    );
    expect(marks).toEqual([
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
      "00:00",
      "01:00",
    ]);
  });

  it("test-grid-block-content: Arjaus Crew muestra su subtítulo y su horario, como un botón sin elegir", () => {
    const { container, onToggle } = renderFriday();

    const block = blockOf(container, "fri-kidzapalooza-1500");
    expect(block.tagName).toBe("BUTTON");
    expect(block).toHaveAttribute("aria-pressed", "false");
    expect(within(block).getByText("Arjaus Crew")).toBeInTheDocument();
    expect(within(block).getByText("Franco y Mateo Trocca - B2B")).toBeInTheDocument();
    expect(within(block).getByText("15:00 – 15:45")).toBeInTheDocument();
    // First show of the axis, 45 minutes at 2 px per minute.
    expect(block.style.top).toBe("0px");
    expect(block.style.height).toBe("90px");
    // It sits in its own stage column.
    expect(block.closest("[data-stage-column]")).toHaveAttribute(
      "data-stage-column",
      "kidzapalooza",
    );

    fireEvent.click(block);
    expect(onToggle).toHaveBeenCalledWith("fri-kidzapalooza-1500");
  });

  it("test-grid-clash-mark: los ids del set de choques llevan el ícono y el texto accesible", () => {
    const { container } = renderFriday({
      selected: ["fri-flow-1800", "fri-perrys-1815", "fri-samsung-1700"],
      clashes: ["fri-flow-1800", "fri-perrys-1815"],
    });

    for (const id of ["fri-flow-1800", "fri-perrys-1815"]) {
      const block = blockOf(container, id);
      expect(block).toHaveAttribute("aria-pressed", "true");
      expect(within(block).getByText(CLASH_TEXT)).toBeInTheDocument();
      // On the time line, not in the name's row: the mark never takes width from the artist's
      // name (NFR-04 holds with a clash too). Not gold (Samsung's color): the icon takes the text
      // color, and the label «Choque» says it in words, next to a hatched left edge.
      const tag = block.querySelector("[data-clash-tag]");
      expect(tag).toHaveTextContent("Choque");
      const icon = tag?.querySelector("svg.lucide-triangle-alert");
      expect(icon).not.toBeNull();
      expect(icon).not.toHaveClass("fill-warning");
      expect(block.querySelector("[data-clash-edge]")).not.toBeNull();
      expect(block).toHaveAccessibleName(/^[^:]*\d\d:\d\d – \d\d:\d\d$/);
      expect(block.firstElementChild?.querySelector("svg")).toBeNull();
    }
    const edge = blockOf(container, "fri-samsung-1700");
    expect(edge).toHaveAttribute("aria-pressed", "true");
    expect(within(edge).queryByText(CLASH_TEXT)).not.toBeInTheDocument();
    expect(edge.querySelector("svg.lucide-triangle-alert")).toBeNull();
    expect(edge.querySelector("[data-clash-edge], [data-clash-tag]")).toBeNull();
  });

  it("marca como sin guardar solo los shows que difieren de lo guardado", () => {
    const { container } = renderFriday({
      selected: ["fri-flow-1800"],
      pending: ["fri-flow-1800", "fri-samsung-1700"],
    });

    expect(blockOf(container, "fri-flow-1800")).toHaveAttribute("data-pending", "true");
    expect(blockOf(container, "fri-samsung-1700")).toHaveAccessibleDescription(/Sin guardar/);
    expect(blockOf(container, "fri-perrys-1815")).not.toHaveAttribute("data-pending");
    // Drawn as a dashed outline, which takes no room from the name or the time line.
    expect(blockOf(container, "fri-flow-1800")).toHaveClass("border-dashed");
    expect(blockOf(container, "fri-samsung-1700")).toHaveClass("border-dashed");
    expect(blockOf(container, "fri-perrys-1815")).not.toHaveClass("border-dashed");
  });

  it("test-grid-block-accessible-name: choque y sin guardar van en la descripción, no en el nombre", () => {
    const { container } = renderFriday({
      selected: ["fri-flow-1800", "fri-perrys-1815"],
      pending: ["fri-flow-1800"],
      clashes: ["fri-flow-1800", "fri-perrys-1815"],
    });

    const block = blockOf(container, "fri-flow-1800");
    expect(block).toHaveAccessibleName("DJO 18:00 – 19:00");
    expect(block).not.toHaveAccessibleName(/guardar/i);
    expect(block).toHaveAccessibleDescription(/Choca con otro show elegido/);
    expect(block).toHaveAccessibleDescription(/Sin guardar/);
    expect(screen.queryAllByRole("button", { name: /guardar/i })).toHaveLength(0);

    const quiet = blockOf(container, "fri-samsung-1700");
    expect(quiet).toHaveAccessibleName("Royel Otis 17:00 – 18:00");
    expect(quiet).toHaveAccessibleDescription("");
  });

  it("un día sin shows muestra un aviso y ninguna grilla", () => {
    render(
      <ScheduleGrid
        day={FRIDAY}
        stages={STAGES}
        shows={[]}
        selectedIds={new Set()}
        pendingIds={new Set()}
        clashIds={new Set()}
        friendPicks={new Map()}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByRole("region", { name: "Grilla del Viernes" })).toHaveTextContent(
      "No hay shows este día.",
    );
    expect(document.querySelector("[data-show-id]")).toBeNull();
    expect(document.querySelector("[data-hour-mark]")).toBeNull();
  });

  it("las marcas de hora van a 12 px, como el resto de la grilla", () => {
    const { container } = renderFriday();

    for (const mark of container.querySelectorAll("[data-hour-mark]")) {
      expect(mark).toHaveClass("text-[12px]");
    }
  });

  it("test-grid-name-fit: el nombre del artista entra en 2 líneas a 360 px: 13 px semibold, guiones en español y menos aire lateral (NFR-04)", () => {
    const { container } = renderFriday();

    const block = blockOf(container, "fri-kidzapalooza-1500");
    const name = block.querySelector(":scope > span > span");
    expect(name).toHaveTextContent("Arjaus Crew");
    // Spec-fixed: 13 px semibold. jsdom has no layout; the two-line check itself is the E2E
    // test-e2e-grid-names-two-lines, these are the knobs it depends on.
    expect(name).toHaveClass("text-[13px]", "font-semibold", "hyphens-auto", "tracking-[-0.01em]");
    expect(block).toHaveClass("inset-x-px", "px-1");
  });

  it("schedule-grid: las columnas suman el espacio libre del botón", () => {
    const { container } = renderFriday();

    // The "En vivo" button (56 px) + 16 px of margin + 8 px.
    expect(LIVE_BUTTON_CLEARANCE_PX).toBe(80);
    // Friday in the fixture: 15:00 to 01:00, 600 minutes at 2 px = 1200 px, plus the 16 px tail
    // under the last hour mark, plus the button's room (FR-16).
    const hours = container.querySelector<HTMLElement>("[data-hour-mark]")?.parentElement;
    expect(hours?.style.height).toBe("1296px");
    const columns = [...container.querySelectorAll<HTMLElement>("[data-stage-column]")];
    expect(columns).toHaveLength(5);
    for (const column of columns) {
      expect(column.style.height).toBe("1296px");
    }
    // The blocks keep their geometry: Arjaus Crew still starts at the top, 45 minutes tall.
    const first = blockOf(container, "fri-kidzapalooza-1500");
    expect(first.style.top).toBe("0px");
    expect(first.style.height).toBe("90px");
    expect(blockOf(container, "fri-samsung-2330").style.top).toBe("1020px");
  });

  it("da respuesta táctil al bloque con data-pressed", () => {
    const { container } = renderFriday();
    const block = blockOf(container, "fri-flow-1800");

    fireEvent.pointerDown(block);
    expect(block).toHaveAttribute("data-pressed", "true");
    fireEvent.pointerCancel(block);
    expect(block).not.toHaveAttribute("data-pressed");
  });

  it("test-grid-friend-initials: con un grupo elegido, el bloque muestra las iniciales de quienes lo eligieron y su descripción las nombra", () => {
    const { container } = renderFriday({
      selected: ["fri-perrys-1815"],
      friendPicks: new Map([
        ["fri-flow-1800", [friend("Ana Pérez", "AP"), friend("Bruno", "B")]],
        ["fri-perrys-1815", [friend("Carla Díaz", "CD")]],
      ]),
    });

    const block = blockOf(container, "fri-flow-1800");
    const row = block.querySelector("[data-friend-picks]");
    expect(row).not.toBeNull();
    // Decorative: the description names them, so a screen reader does not read "AP B" too.
    expect(row).toHaveAttribute("aria-hidden", "true");
    expect(chipsOf(block)).toEqual(["AP", "B"]);
    for (const chip of row?.children ?? []) {
      expect(chip).toHaveClass("text-[12px]", "bg-rp-overlay", "text-foreground");
    }
    // Below the time line, which stays visible (FR-03 of FEAT-003a).
    const timeLine = block.querySelector("[data-time-line]");
    expect(timeLine).toHaveTextContent("18:00 – 19:00");
    expect(timeLine?.compareDocumentPosition(row!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(block).toHaveAccessibleDescription("Lo eligieron: Ana Pérez, Bruno");
    // The name does not change: the show first, the friends in the description.
    expect(block).toHaveAccessibleName("DJO 18:00 – 19:00");

    // On a chosen (foam) block the chips darken the foam instead.
    const chosen = blockOf(container, "fri-perrys-1815");
    const chosenChip = chosen.querySelector("[data-friend-picks]")?.firstElementChild;
    expect(chosenChip).toHaveClass("bg-rp-base/25");
    expect(chosenChip).not.toHaveClass("bg-rp-overlay");
    expect(chosen).toHaveAccessibleDescription("Lo eligieron: Carla Díaz");
  });

  it("test-grid-friend-initials: con choque y amigos, el ícono sigue en el horario y la descripción suma las dos cosas", () => {
    const { container } = renderFriday({
      selected: ["fri-flow-1800", "fri-perrys-1815"],
      clashes: ["fri-flow-1800", "fri-perrys-1815"],
      friendPicks: new Map([["fri-flow-1800", [friend("Ana Pérez", "AP")]]]),
    });

    const block = blockOf(container, "fri-flow-1800");
    expect(block.querySelector("[data-clash-tag] svg.lucide-triangle-alert")).not.toBeNull();
    expect(block.querySelector("[data-friend-picks] svg")).toBeNull();
    expect(block).toHaveAccessibleDescription(/Choca con otro show elegido/);
    expect(block).toHaveAccessibleDescription(/Lo eligieron: Ana Pérez/);
    expect(block).toHaveAccessibleName("DJO 18:00 – 19:00");
  });

  it('test-grid-friend-extra: con 5 amigos el bloque muestra 3 iniciales y "+2"', () => {
    const five = [
      friend("Ana", "A"),
      friend("Bruno", "B"),
      friend("Carla", "C"),
      friend("Dani", "D"),
      friend("Eva", "E"),
    ];
    const { container } = renderFriday({ friendPicks: new Map([["fri-flow-1800", five]]) });

    const block = blockOf(container, "fri-flow-1800");
    expect(chipsOf(block)).toEqual(["A", "B", "C", "+2"]);
    // The description still names all five.
    expect(block).toHaveAccessibleDescription("Lo eligieron: Ana, Bruno, Carla, Dani, Eva");
  });

  it("test-grid-friend-height: un bloque corto con amigos mide 60 px sin pasar del show siguiente y conserva el horario", () => {
    const first = sundayShort("sun-kidzapalooza-1800", "18:00", "18:20");
    const second = sundayShort("sun-kidzapalooza-1830", "18:30", "18:50");
    const { container } = render(
      <ScheduleGrid
        day={SUNDAY}
        stages={STAGES}
        shows={[first, second]}
        selectedIds={new Set()}
        pendingIds={new Set()}
        clashIds={new Set()}
        friendPicks={new Map([[first.id, [friend("Ana Pérez", "AP")]]])}
        onToggle={() => {}}
      />,
    );

    const short = blockOf(container, first.id);
    const next = blockOf(container, second.id);
    // 20 minutes measure 44 px (the tap target); with the row of initials, 60 px, which is exactly
    // where the next show of the stage starts (18:30, 60 px below).
    expect(short.style.top).toBe("0px");
    expect(short.style.height).toBe("60px");
    expect(next.style.top).toBe("60px");
    expect(within(short).getByText("18:00 – 18:20")).toBeVisible();
    expect(chipsOf(short)).toEqual(["AP"]);
    // Without friends the next one keeps its 44 px.
    expect(next.style.height).toBe("44px");
  });

  it("test-grid-friend-height: con amigos y subtítulo, el subtítulo se recorta a 1 línea", () => {
    const { container } = renderFriday({
      friendPicks: new Map([["fri-kidzapalooza-1500", [friend("Ana Pérez", "AP")]]]),
    });

    const block = blockOf(container, "fri-kidzapalooza-1500");
    expect(within(block).getByText("Franco y Mateo Trocca - B2B")).toHaveClass("line-clamp-1");
    // Already taller than 60 px: it keeps its duration at scale.
    expect(block.style.height).toBe("90px");
    // The name keeps its own row.
    expect(block.querySelector(":scope > span > span")).toHaveTextContent("Arjaus Crew");
  });

  it("test-grid-no-friends: sin amigos el bloque no tiene fila de iniciales y su nombre accesible no cambia", () => {
    const { container } = renderFriday({
      friendPicks: new Map([["fri-flow-1800", [friend("Ana Pérez", "AP")]]]),
    });

    expect(container.querySelectorAll("[data-friend-picks]")).toHaveLength(1);
    const quiet = blockOf(container, "fri-samsung-1700");
    expect(quiet.querySelector("[data-friend-picks]")).toBeNull();
    expect(quiet).toHaveAccessibleName("Royel Otis 17:00 – 18:00");
    expect(quiet).toHaveAccessibleDescription("");
    expect(quiet.style.height).toBe("120px");

    const plain = blockOf(container, "fri-kidzapalooza-1500");
    expect(within(plain).getByText("Franco y Mateo Trocca - B2B")).not.toHaveClass("line-clamp-1");

    // An empty map (no group, or "Sin grupo"): the grid as it was.
    cleanup();
    const empty = renderFriday();
    expect(empty.container.querySelector("[data-friend-picks]")).toBeNull();
    expect(blockOf(empty.container, "fri-flow-1800")).toHaveAccessibleName("DJO 18:00 – 19:00");
  });

  it("test-grid-short-name-clamp: un bloque corto con amigos recorta el nombre a 1 línea y conserva el nombre accesible completo", () => {
    const first = {
      ...sundayShort("sun-kidzapalooza-1800", "18:00", "18:20"),
      artist: "¡Qué Lío, Hugo!",
    };
    const second = sundayShort("sun-kidzapalooza-1830", "18:30", "18:50");
    const { container } = render(
      <ScheduleGrid
        day={SUNDAY}
        stages={STAGES}
        shows={[first, second]}
        selectedIds={new Set()}
        pendingIds={new Set()}
        clashIds={new Set()}
        friendPicks={new Map([[first.id, [friend("Ana Pérez", "AP")]]])}
        onToggle={() => {}}
      />,
    );

    const short = blockOf(container, first.id);
    // 60 px: under the 76 px the name needs in 2 lines with the time line and the initials.
    expect(short.style.height).toBe("60px");
    const name = short.querySelector(":scope > span > span");
    expect(name).toHaveTextContent("¡Qué Lío, Hugo!");
    expect(name).toHaveClass("line-clamp-1");
    // The clamp is only visual: the accessible name is still the whole name and the time.
    expect(short).toHaveAccessibleName("¡Qué Lío, Hugo! 18:00 – 18:20");
    expect(within(short).getByText("18:00 – 18:20")).toBeVisible();
    // The next one has no friends: its name is not clamped.
    const next = blockOf(container, second.id);
    expect(next.querySelector(":scope > span > span")).not.toHaveClass("line-clamp-1");
  });

  it("test-grid-short-name-clamp: con amigos, un bloque de 75 px recorta el nombre y uno de 76 px no", () => {
    const at = (minutes: number): Show => {
      const start = posterTimeToInstant(SUNDAY.date, "18:00");
      return {
        ...sundayShort(`sun-kidzapalooza-${minutes}`, "18:00", "18:20"),
        // 2 px per minute: 37.5 minutes measure 75 px, 38 minutes 76 px.
        endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
      };
    };
    const nameOf = (minutes: number) => {
      const show = at(minutes);
      const { container } = render(
        <ScheduleGrid
          day={SUNDAY}
          stages={STAGES}
          shows={[show]}
          selectedIds={new Set()}
          pendingIds={new Set()}
          clashIds={new Set()}
          friendPicks={new Map([[show.id, [friend("Ana Pérez", "AP")]]])}
          onToggle={() => {}}
        />,
      );
      const block = blockOf(container, show.id);
      return { height: block.style.height, name: block.querySelector(":scope > span > span") };
    };

    const short = nameOf(37.5);
    expect(short.height).toBe("75px");
    expect(short.name).toHaveClass("line-clamp-1");
    cleanup();
    const tall = nameOf(38);
    expect(tall.height).toBe("76px");
    expect(tall.name).not.toHaveClass("line-clamp-1");
  });

  it("test-grid-tall-name-unclamped: un bloque con amigos y altura suficiente, o sin amigos, no recorta el nombre", () => {
    const { container } = renderFriday({
      friendPicks: new Map([
        // 45 minutes: 90 px, enough for the name in 2 lines.
        ["fri-kidzapalooza-1500", [friend("Ana Pérez", "AP")]],
        ["fri-flow-1800", [friend("Bruno", "B")]],
      ]),
    });

    for (const id of ["fri-kidzapalooza-1500", "fri-flow-1800", "fri-samsung-1700"]) {
      const name = blockOf(container, id).querySelector(":scope > span > span");
      expect(name).not.toHaveClass("line-clamp-1");
    }
    expect(blockOf(container, "fri-flow-1800")).toHaveAccessibleName("DJO 18:00 – 19:00");
  });

  it("test-grid-time-line-height: la línea del horario tiene leading-tight y no hereda el alto de línea del body", () => {
    const { container } = renderFriday({
      friendPicks: new Map([["fri-flow-1800", [friend("Ana Pérez", "AP")]]]),
    });

    const lines = container.querySelectorAll("[data-time-line]");
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      // 12 px × 1.25 = 15 px: the line itself carries the 12 px, or its strut keeps the inherited
      // 16 px and measures 20 px even with leading-tight.
      expect(line).toHaveClass("text-[12px]", "leading-tight");
    }
  });
});

describe("ScheduleGrid: color por escenario, ahora y shows pasados", () => {
  it("test-grid-lanes: cada columna se tiñe con su escenario (7 %) y el encabezado con 9 % y un filete de 3 px", () => {
    const { container } = renderFriday();

    const flowColumn = container.querySelector<HTMLElement>('[data-stage-column="flow"]')!;
    expect(flowColumn.style.getPropertyValue("--stage")).toBe("#9ccfd8");
    expect(flowColumn.className).toContain("color-mix(in_srgb,var(--stage)_7%,transparent)");
    const samsung = container.querySelector<HTMLElement>('[data-stage-column="samsung"]')!;
    expect(samsung.style.getPropertyValue("--stage")).toBe("#f6c177");

    const headers = [...container.querySelectorAll<HTMLElement>("[data-stage-header]")];
    expect(headers[0]!.style.getPropertyValue("--stage")).toBe("#9ccfd8");
    expect(headers[0]!.className).toContain("_9%,");
    expect(headers[0]!.className).toContain("border-t-[3px]");
    expect(headers[0]!.className).toContain("border-t-(--stage)");
    // The text stays foreground.
    expect(headers[0]!.className).not.toContain("text-(--stage)");
  });

  it("test-grid-block-colors: elegido relleno del escenario con --on-stage en semibold; no elegido con borde al 45 %", () => {
    const { container } = renderFriday({ selected: ["fri-flow-1800"] });

    const chosen = blockOf(container, "fri-flow-1800");
    expect(chosen.style.getPropertyValue("--stage")).toBe("#9ccfd8");
    expect(chosen.style.getPropertyValue("--on-stage")).toBe("#191724");
    expect(chosen).toHaveClass("bg-(--stage)", "text-(--on-stage)");
    // Semibold, like the unchosen name (≥ 600 per S1): bold glyphs are wider and pushed "Partysani
    // Klezmer Band" to 3 lines at 360 px (NFR-04).
    expect(chosen.querySelector("span > span")).toHaveClass("font-semibold");
    expect(chosen.querySelector("span > span")).not.toHaveClass("font-bold");

    const plain = blockOf(container, "fri-samsung-1700");
    expect(plain.style.getPropertyValue("--stage")).toBe("#f6c177");
    expect(plain).toHaveClass("border-(--stage)/45", "bg-card", "text-foreground");
    expect(plain).not.toHaveClass("bg-(--stage)");
  });

  it("test-grid-past: los terminados se atenúan: no elegido con borde débil y nombre apagado; elegido con relleno 72 %", () => {
    setNow("20:00");
    const { container } = renderFriday({ selected: ["fri-flow-1800"] });

    const pastPlain = blockOf(container, "fri-samsung-1700");
    expect(pastPlain).toHaveClass("border-(--stage)/27");
    expect(pastPlain).not.toHaveClass("border-(--stage)/45");
    expect(pastPlain.querySelector("span > span")).toHaveClass("text-muted-foreground");

    const pastChosen = blockOf(container, "fri-flow-1800");
    expect(pastChosen.className).toContain(
      "color-mix(in_srgb,var(--stage)_72%,var(--color-rp-base))",
    );
    expect(pastChosen).not.toHaveClass("bg-(--stage)");

    // A show still to come keeps the full look.
    const upcoming = blockOf(container, "fri-samsung-2330");
    expect(upcoming).toHaveClass("border-(--stage)/45");
  });

  it("test-grid-clash-edge: el choque lleva borde rayado en --on-stage, ícono en currentColor y «Choque» visible", () => {
    const { container } = renderFriday({
      selected: ["fri-flow-1800", "fri-perrys-1815"],
      clashes: ["fri-flow-1800", "fri-perrys-1815"],
    });

    const block = blockOf(container, "fri-flow-1800");
    const edge = block.querySelector<HTMLElement>("[data-clash-edge]")!;
    expect(edge).toHaveAttribute("aria-hidden", "true");
    expect(edge.className).toContain("repeating-linear-gradient");
    expect(edge.className).toContain("var(--on-stage)");
    // NFR-04: the edge is an overlay inside the block's 4 px padding (3 px wide) and the clash
    // adds no left padding, so the name keeps the same 92 px as without a clash.
    expect(edge).toHaveClass("w-[3px]");
    expect(block).not.toHaveClass("pl-2.5");
    expect(block).toHaveClass("px-1");
    const tag = block.querySelector<HTMLElement>("[data-clash-tag]")!;
    expect(tag).toHaveAttribute("aria-hidden", "true");
    expect(tag.querySelector("svg")).not.toHaveClass("text-rp-base");
    // The description for assistive tech stays, and the name does not carry the visible tag.
    expect(block).toHaveAccessibleDescription(/Choca con otro show elegido/);
    expect(block).toHaveAccessibleName("DJO 18:00 – 19:00");
  });

  it("test-grid-now-line: la línea love cruza las columnas a la hora actual y el chip lleva la hora", () => {
    setNow("18:30");
    const { container } = renderFriday();

    const line = container.querySelector<HTMLElement>("[data-now-line]")!;
    expect(line).toHaveAttribute("aria-hidden", "true");
    expect(line).toHaveClass(
      "bg-rp-love",
      "h-0.5",
      "motion-safe:animate-now-glow",
      "pointer-events-none",
    );
    // 15:00 → 18:30 = 210 min × 2 px = 420 px, under the 40 px stage header row, centered (−1 px) on its 2 px.
    expect(line.style.top).toBe("459px");
    // Under the sticky header (z-20) and hour column (z-10).
    expect(line.className).toContain("z-[5]");

    const chip = container.querySelector<HTMLElement>("[data-now-chip]")!;
    expect(chip).toHaveTextContent("18:30");
    expect(chip).toHaveClass("bg-rp-love");
    expect(chip.style.top).toBe("420px");
    // The chip lives in the sticky hour column.
    expect(chip.closest("[data-hour-column]")).not.toBeNull();
  });

  it("test-grid-now-line: se mueve con la hora y no se dibuja fuera del eje del día", () => {
    const { container, rerender } = renderFriday();
    expect(container.querySelector("[data-now-line]")).toBeNull();
    expect(container.querySelector("[data-now-chip]")).toBeNull();

    // After the last show's end (01:00 of the next day): off the axis again.
    vi.setSystemTime(posterTimeToInstant("2026-03-13", "01:30").getTime() + 24 * 3_600_000);
    rerender(
      <ScheduleGrid
        day={FRIDAY}
        stages={STAGES}
        shows={showsOf("fri")}
        selectedIds={new Set()}
        pendingIds={new Set()}
        clashIds={new Set()}
        friendPicks={new Map()}
        onToggle={() => {}}
      />,
    );
    expect(container.querySelector("[data-now-line]")).toBeNull();
  });

  it("test-grid-playing: el show sonando lleva el punto love y «Ahora»; los demás no", () => {
    setNow("18:30");
    const { container } = renderFriday();

    const playing = blockOf(container, "fri-flow-1800");
    expect(playing.querySelector("[data-live-dot]")).not.toBeNull();
    expect(playing).toHaveAccessibleDescription(/Ahora/);
    expect(within(playing).getByText("Ahora")).toBeInTheDocument();
    expect(playing).toHaveAccessibleName("DJO 18:00 – 19:00");

    for (const id of ["fri-samsung-1700", "fri-samsung-2330"]) {
      const other = blockOf(container, id);
      expect(other.querySelector("[data-live-dot]")).toBeNull();
      expect(within(other).queryByText("Ahora")).toBeNull();
    }
  });
});
