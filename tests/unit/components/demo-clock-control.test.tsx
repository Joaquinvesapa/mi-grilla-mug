import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoClockControl } from "@/components/demo-clock-control";
import { DEMO_CLOCK_MAX, DEMO_CLOCK_MIN, DEMO_CLOCK_START, demoInstant } from "@/lib/demo-clock";
import type { Schedule } from "@/lib/schedule-types";

const FRIDAY_22_30 = Date.parse("2026-03-13T22:30:00-03:00");
const FRIDAY_22_45 = Date.parse("2026-03-13T22:45:00-03:00");
const SUNDAY_22_30 = Date.parse("2026-03-15T22:30:00-03:00");
const SUNDAY_23_00 = Date.parse("2026-03-15T23:00:00-03:00");

const SCHEDULE: Schedule = {
  days: [{ id: "fri", name: "Viernes", date: "2026-03-13", position: 1 }],
  stages: [
    { id: "flow", name: "Flow", position: 1 },
    { id: "samsung", name: "Samsung", position: 2 },
  ],
  shows: [
    {
      id: "fri-flow-2215",
      dayId: "fri",
      stageId: "flow",
      artist: "Tyler",
      subtitle: null,
      startsAt: "2026-03-13T22:15:00-03:00",
      endsAt: "2026-03-13T23:30:00-03:00",
    },
  ],
};

afterEach(cleanup);

/** The control as `DemoStage` uses it: the value lives in the parent's state. */
function Harness({
  onChange,
  initial = DEMO_CLOCK_START,
  schedule,
}: {
  onChange: (at: Date) => void;
  initial?: Date;
  schedule?: Schedule;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DemoClockControl
      value={value}
      schedule={schedule}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

function slider(): HTMLInputElement {
  return screen.getByRole("slider", { name: "Hora simulada" }) as HTMLInputElement;
}

function manualInput(): HTMLInputElement {
  return screen.getByLabelText("Poné la hora a mano") as HTMLInputElement;
}

function times(onChange: ReturnType<typeof vi.fn>): number[] {
  return onChange.mock.calls.map(([at]) => (at as Date).getTime());
}

describe("DemoClockControl", () => {
  it("demo-clock-control: muestra viernes 22:30 al arrancar", () => {
    render(<Harness onChange={() => {}} />);

    expect(screen.getByRole("heading", { name: "Reloj de la demo" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Viernes", "Sábado", "Domingo"]);
    expect(screen.getByRole("tab", { name: "Viernes" })).toHaveAttribute("aria-selected", "true");
    const input = slider();
    expect(input.type).toBe("range");
    expect(input.step).toBe("5");
    expect(input.min).toBe("0");
    expect(input.max).toBe("1435");
    // Minutes since 06:00: 22:30 is 16 h 30 min in.
    expect(input.value).toBe("990");
    expect(input).toHaveAttribute("aria-valuetext", "Viernes 22:30");
    expect(input.style.touchAction || input.className).toMatch(/pan-y/);
    for (const label of ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "00:00", "03:00"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("06:00")).toHaveLength(2);
    expect(screen.getByText("Día del festival, 06:00 a 06:00")).toBeInTheDocument();
    // The festival day's color on the active tab.
    expect(screen.getByRole("tab", { name: "Viernes" }).style.getPropertyValue("--day")).toBe(
      "#f6c177",
    );
    // The time on screen, as text, with its calendar date.
    const shown = screen.getByRole("status");
    expect(shown).toHaveTextContent("22:30");
    expect(shown).toHaveTextContent(/viernes 13 de marzo/i);
    expect(DEMO_CLOCK_START.getTime()).toBe(FRIDAY_22_30);
  });

  it("demo-clock-control: +15 min avisa 22:45", () => {
    const onChange = vi.fn<(at: Date) => void>();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "+15 min" }));

    expect(times(onChange)).toEqual([FRIDAY_22_45]);
    expect(slider().value).toBe("1005");
    expect(slider()).toHaveAttribute("aria-valuetext", "Viernes 22:45");
    expect(screen.getByRole("status")).toHaveTextContent("22:45");

    fireEvent.click(screen.getByRole("button", { name: "−15 min" }));
    expect(times(onChange)).toEqual([FRIDAY_22_45, FRIDAY_22_30]);
    expect(slider().value).toBe("990");
  });

  it("demo-clock-control: elegir domingo y 23:00 avisa ese instante", () => {
    const onChange = vi.fn<(at: Date) => void>();
    render(<Harness onChange={onChange} />);

    // Radix Tabs activates on mousedown, and again on the focus it moves before re-rendering: both
    // notifications carry the same instant. Changing the day keeps the time.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Domingo" }), { button: 0 });
    expect(onChange).toHaveBeenCalled();
    expect(new Set(times(onChange))).toEqual(new Set([SUNDAY_22_30]));
    expect(screen.getByRole("tab", { name: "Domingo" })).toHaveAttribute("aria-selected", "true");

    // Regression: a tap on the day already on screen does not move the clock. The controlled Radix
    // Tabs drops a value equal to the current one; the control adds no check of its own.
    onChange.mockClear();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Domingo" }), { button: 0 });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(slider(), { target: { value: "1020" } });

    expect(times(onChange)).toEqual([SUNDAY_23_00]);
    expect(slider().value).toBe("1020");
    expect(slider()).toHaveAttribute("aria-valuetext", "Domingo 23:00");
    expect(screen.getByRole("status")).toHaveTextContent("23:00");
    expect(screen.getByRole("status")).toHaveTextContent(/domingo 15 de marzo/i);
  });

  it("demo-clock-control: la hora a mano acepta HH:MM y HHMM con Enter o «Ir»", () => {
    const onChange = vi.fn<(at: Date) => void>();
    render(<Harness onChange={onChange} />);
    const input = manualInput();
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("maxlength", "5");
    expect(input).toHaveAttribute("placeholder", "22:40");
    expect(input).toHaveAttribute("aria-invalid", "false");

    fireEvent.change(input, { target: { value: "2300" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(times(onChange)).toEqual([Date.parse("2026-03-13T23:00:00-03:00")]);
    expect(slider().value).toBe("1020");

    fireEvent.change(input, { target: { value: "01:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Ir" }));
    // Madrugada: still Friday's festival day, so the next calendar day.
    expect(times(onChange).at(-1)).toBe(Date.parse("2026-03-14T01:15:00-03:00"));
    expect(screen.getByRole("tab", { name: "Viernes" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("demo-clock-control: una hora inválida marca el error y el reloj no cambia", () => {
    const onChange = vi.fn<(at: Date) => void>();
    render(<Harness onChange={onChange} />);
    const input = manualInput();

    for (const typed of ["", "25:00", "12:60", "abc"]) {
      fireEvent.change(input, { target: { value: typed } });
      fireEvent.click(screen.getByRole("button", { name: "Ir" }));
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Escribí una hora con formato HH:MM, entre 06:00 y 05:59 del día siguiente. Por ejemplo, 22:40.",
      );
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("22:30");

    // Typing again clears the error.
    fireEvent.change(input, { target: { value: "22:4" } });
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("demo-clock-control: de 00:00 a 05:59 avisa que sigue siendo la noche del día", () => {
    const night = demoInstant("sat", "01:00");
    if (!night) throw new Error("fixture");
    render(<Harness onChange={() => {}} initial={night} />);

    expect(screen.getByRole("tab", { name: "Sábado" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Madrugada: sigue siendo la noche del sábado")).toBeInTheDocument();
    expect(slider()).toHaveAttribute("aria-valuetext", "Sábado 01:00");
    expect(slider().value).toBe("1140");
  });

  it("demo-clock-control: la mini línea de tiempo sale solo con la grilla", () => {
    const { container, unmount } = render(<Harness onChange={() => {}} />);
    expect(container.querySelector("[data-timeline-stage]")).toBeNull();
    unmount();

    const view = render(<Harness onChange={() => {}} schedule={SCHEDULE} />);
    const rows = view.container.querySelectorAll("[data-timeline-stage]");
    expect(Array.from(rows).map((row) => row.getAttribute("data-timeline-stage"))).toEqual([
      "flow",
      "samsung",
    ]);
    expect(
      view.container.querySelectorAll("[data-timeline-stage='flow'] [data-span]"),
    ).toHaveLength(1);
    expect(view.container.querySelector("[data-timeline-cursor]")).not.toBeNull();
  });

  it("los botones se deshabilitan en los límites del festival", () => {
    const last = new Date(DEMO_CLOCK_MAX.getTime() - 15 * 60_000);
    const { unmount } = render(<Harness onChange={() => {}} initial={last} />);
    expect(screen.getByRole("button", { name: "+15 min" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "−15 min" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: "Domingo" })).toHaveAttribute("aria-selected", "true");
    unmount();

    render(<Harness onChange={() => {}} initial={DEMO_CLOCK_MIN} />);
    expect(screen.getByRole("button", { name: "−15 min" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "+15 min" })).toBeEnabled();
  });
});
