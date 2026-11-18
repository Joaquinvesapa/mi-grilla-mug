import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoClockControl } from "@/components/demo-clock-control";
import { DEMO_CLOCK_MAX, DEMO_CLOCK_MIN, DEMO_CLOCK_START } from "@/lib/demo-clock";

const FRIDAY_22_30 = Date.parse("2026-03-13T22:30:00-03:00");
const FRIDAY_22_45 = Date.parse("2026-03-13T22:45:00-03:00");
const SUNDAY_22_30 = Date.parse("2026-03-15T22:30:00-03:00");
const SUNDAY_23_00 = Date.parse("2026-03-15T23:00:00-03:00");

afterEach(cleanup);

/** The control as `DemoStage` uses it: the value lives in the parent's state. */
function Harness({
  onChange,
  initial = DEMO_CLOCK_START,
}: {
  onChange: (at: Date) => void;
  initial?: Date;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DemoClockControl
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

function timeInput(): HTMLInputElement {
  return screen.getByLabelText("Hora") as HTMLInputElement;
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
    const input = timeInput();
    expect(input.type).toBe("time");
    expect(input.step).toBe("900");
    expect(input.value).toBe("22:30");
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
    expect(timeInput().value).toBe("22:45");
    expect(screen.getByRole("status")).toHaveTextContent("22:45");

    fireEvent.click(screen.getByRole("button", { name: "−15 min" }));
    expect(times(onChange)).toEqual([FRIDAY_22_45, FRIDAY_22_30]);
    expect(timeInput().value).toBe("22:30");
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

    fireEvent.change(timeInput(), { target: { value: "23:00" } });

    expect(times(onChange)).toEqual([SUNDAY_23_00]);
    expect(timeInput().value).toBe("23:00");
    expect(screen.getByRole("status")).toHaveTextContent("23:00");
    expect(screen.getByRole("status")).toHaveTextContent(/domingo 15 de marzo/i);
  });

  it("demo-clock-control: una hora vacía o inválida es rechazada y el reloj no cambia", () => {
    const onChange = vi.fn<(at: Date) => void>();
    render(<Harness onChange={onChange} />);
    const input = timeInput();

    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("22:30");

    // Out of range or another format: jsdom sanitizes `type="time"` and both arrive as "", so this
    // checks the rejection of the empty value again. TIME_PATTERN itself is covered by
    // tests/unit/lib/demo-clock.test.ts.
    fireEvent.change(input, { target: { value: "25:00" } });
    fireEvent.change(input, { target: { value: "7:5" } });
    expect(onChange).not.toHaveBeenCalled();

    // On blur the field shows the time in force again.
    fireEvent.blur(input);
    expect(input.value).toBe("22:30");
    expect(onChange).not.toHaveBeenCalled();
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
