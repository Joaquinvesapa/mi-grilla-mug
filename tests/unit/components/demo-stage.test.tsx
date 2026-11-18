import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DemoStage } from "@/components/demo-stage";
import { DEMO_CLOCK_MESSAGE } from "@/lib/demo-clock";

const FRIDAY_22_30 = Date.parse("2026-03-13T22:30:00-03:00");
const FRIDAY_22_45 = Date.parse("2026-03-13T22:45:00-03:00");

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DemoStage", () => {
  it("demo-stage: el cambio del control llega al iframe por postMessage", () => {
    render(<DemoStage />);

    expect(screen.getByRole("heading", { name: "Reloj de la demo" })).toBeInTheDocument();
    const iframe = screen.getByTitle("Mi Grilla") as HTMLIFrameElement;
    const target = iframe.contentWindow;
    if (!target) throw new Error("jsdom: el iframe no tiene contentWindow");
    const postMessage = vi.spyOn(target, "postMessage").mockImplementation(() => {});

    // The iframe's onLoad sends the time in force: Friday 22:30 (FR-02).
    fireEvent.load(iframe);
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: DEMO_CLOCK_MESSAGE, at: FRIDAY_22_30 },
      window.location.origin,
    );

    fireEvent.click(screen.getByRole("button", { name: "+15 min" }));

    expect(postMessage).toHaveBeenLastCalledWith(
      { type: DEMO_CLOCK_MESSAGE, at: FRIDAY_22_45 },
      window.location.origin,
    );
    for (const call of postMessage.mock.calls) {
      expect(call[1]).not.toBe("*");
    }
  });
});
