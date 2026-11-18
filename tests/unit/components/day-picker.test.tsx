import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DayPicker } from "@/components/day-picker";

import { DAYS } from "./schedule-fixture";

afterEach(cleanup);

function Harness({ onChange }: { onChange: (dayId: string) => void }) {
  const [dayId, setDayId] = useState("fri");
  return (
    <DayPicker
      days={DAYS}
      value={dayId}
      onChange={(next) => {
        onChange(next);
        setDayId(next);
      }}
    >
      <p>Contenido del {dayId}</p>
    </DayPicker>
  );
}

describe("DayPicker", () => {
  it("test-day-picker-switch: elegir Sábado llama a onChange('sat') y lo marca activo", () => {
    const onChange = vi.fn<(dayId: string) => void>();
    render(<Harness onChange={onChange} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Viernes", "Sábado", "Domingo"]);
    expect(screen.getByRole("tab", { name: "Viernes" })).toHaveAttribute("aria-selected", "true");

    // Radix Tabs activates on mousedown (a tap fires it too, after touchend).
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Sábado" }), { button: 0 });

    expect(onChange).toHaveBeenCalledWith("sat");
    const saturday = screen.getByRole("tab", { name: "Sábado" });
    expect(saturday).toHaveAttribute("aria-selected", "true");
    expect(saturday).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tab", { name: "Viernes" })).toHaveAttribute("aria-selected", "false");
    // The active day's panel holds the content, labelled by its tab.
    expect(screen.getByRole("tabpanel", { name: "Sábado" })).toHaveTextContent("Contenido del sat");
  });

  it("los triggers alcanzan los 44 px de alto", () => {
    render(<Harness onChange={() => {}} />);

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("min-h-11");
    }
  });

  it("test-day-picker-action: con action la muestra en la fila de los días; sin action la fila no cambia", () => {
    const { container, rerender } = render(
      <DayPicker days={DAYS} value="fri" onChange={() => {}}>
        <p>Contenido</p>
      </DayPicker>,
    );

    const plainList = screen.getByRole("tablist");
    const plainRow = plainList.parentElement!;
    expect(plainRow.className).toBe("px-3 pb-2");
    expect(plainList).toHaveClass("w-full");
    expect(plainList).not.toHaveClass("flex-1");
    expect(plainRow.children).toHaveLength(1);
    expect(container.querySelector("[data-testid='day-action']")).toBeNull();

    rerender(
      <DayPicker
        days={DAYS}
        value="fri"
        onChange={() => {}}
        action={<button data-testid="day-action">Acción</button>}
      >
        <p>Contenido</p>
      </DayPicker>,
    );

    const list = screen.getByRole("tablist");
    const row = list.parentElement!;
    const action = screen.getByTestId("day-action");
    // Same row as the days, after them; the days take the rest of the width.
    expect(action.parentElement).toBe(row);
    expect(row.lastElementChild).toBe(action);
    expect(row).toHaveClass("flex", "gap-2");
    expect(list).toHaveClass("flex-1");
    // Outside the tab panel: it belongs to the row, not to the day's content.
    expect(screen.getByRole("tabpanel")).not.toContainElement(action);
  });

  it("test-day-picker-colors: la pestaña activa se rellena con su día, las otras muestran un punto, y una barra de 2 px del día bajo las pestañas", () => {
    const { container } = render(<Harness onChange={() => {}} />);

    const friday = screen.getByRole("tab", { name: "Viernes" });
    expect(friday.style.getPropertyValue("--day")).toBe("#f6c177");
    expect(friday.style.getPropertyValue("--on-day")).toBe("#191724");
    expect(friday.className).toContain("data-[state=active]:bg-(--day)");
    expect(friday.className).toContain("data-[state=active]:text-(--on-day)");
    const sunday = screen.getByRole("tab", { name: "Domingo" });
    expect(sunday.style.getPropertyValue("--on-day")).toBe("#e0def4");

    for (const tab of screen.getAllByRole("tab")) {
      const dot = tab.querySelector("[data-day-dot]");
      expect(dot).not.toBeNull();
      expect(dot).toHaveAttribute("aria-hidden", "true");
      expect(dot).toHaveClass("bg-(--day)", "in-data-[state=active]:hidden");
    }

    const bar = container.querySelector<HTMLElement>("[data-day-bar]")!;
    expect(bar).toHaveClass("h-0.5", "bg-(--day)");
    expect(bar.style.getPropertyValue("--day")).toBe("#f6c177");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Sábado" }), { button: 0 });
    expect(
      container.querySelector<HTMLElement>("[data-day-bar]")!.style.getPropertyValue("--day"),
    ).toBe("#ebbcba");
  });
});
