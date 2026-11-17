import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScheduleGrid } from "@/components/schedule-grid";

import { blockOf, DAYS, showsOf, STAGES } from "./schedule-fixture";

afterEach(cleanup);

const FRIDAY = DAYS[0]!;
const CLASH_TEXT = "Choca con otro show elegido";

function renderFriday({
  selected = [] as string[],
  pending = [] as string[],
  clashes = [] as string[],
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
      // name (NFR-04 holds with a clash too). Gold fill, dark outline: legible on the foam fill.
      const icon = within(block)
        .getByText(/^\d\d:\d\d – \d\d:\d\d$/)
        .closest("[data-time-line]")
        ?.querySelector("svg.lucide-triangle-alert");
      expect(icon).not.toBeNull();
      expect(icon).toHaveClass("fill-warning");
      expect(block.firstElementChild?.querySelector("svg")).toBeNull();
    }
    const edge = blockOf(container, "fri-samsung-1700");
    expect(edge).toHaveAttribute("aria-pressed", "true");
    expect(within(edge).queryByText(CLASH_TEXT)).not.toBeInTheDocument();
    expect(edge.querySelector("svg.lucide-triangle-alert")).toBeNull();
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

  it("da respuesta táctil al bloque con data-pressed", () => {
    const { container } = renderFriday();
    const block = blockOf(container, "fri-flow-1800");

    fireEvent.pointerDown(block);
    expect(block).toHaveAttribute("data-pressed", "true");
    fireEvent.pointerCancel(block);
    expect(block).not.toHaveAttribute("data-pressed");
  });
});
