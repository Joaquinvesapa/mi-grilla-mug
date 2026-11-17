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
});
