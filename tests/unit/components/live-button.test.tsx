import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDemoClockForTests } from "@/components/demo-clock";
import { LiveButton } from "@/components/live-button";
import { ScheduleScreen } from "@/components/schedule-screen";
import { DEMO_CLOCK_MESSAGE } from "@/lib/demo-clock";
import { CLOSE_LABEL, LIVE_LABEL, NOTHING_NOW, SELECTED_LABEL } from "@/lib/live-messages";

import { SCHEDULE } from "./schedule-fixture";
import { endVaulCloseAnimation, stubMatchMedia } from "./vaul-env";

// Viernes 13 de marzo de 2026 en Argentina (UTC-3).
const FRIDAY_18_30 = Date.parse("2026-03-13T18:30:00-03:00");
const FRIDAY_23_29_30 = Date.parse("2026-03-13T23:29:30-03:00");
// La hora que manda /demo: viernes 23:45, Peggy Gou en Samsung.
const FRIDAY_23_45 = Date.parse("2026-03-13T23:45:00-03:00");

const ORIGINAL_PARENT = Object.getOwnPropertyDescriptor(window, "parent");

/** The app framed by `/demo` of its own origin (`parent` is read-only in jsdom). */
function setDemoParent() {
  const parent = { location: { pathname: "/demo" }, postMessage: vi.fn() };
  Object.defineProperty(window, "parent", { configurable: true, get: () => parent });
  return parent;
}

function restoreParent() {
  if (ORIGINAL_PARENT) {
    Object.defineProperty(window, "parent", ORIGINAL_PARENT);
  } else {
    // `parent` lives on the prototype: dropping the own property restores jsdom's.
    delete (window as { parent?: unknown }).parent;
  }
}

beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => {
  // Only `Date`: Vaul and React keep their real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FRIDAY_18_30);
});
afterEach(() => {
  cleanup();
  resetDemoClockForTests();
  restoreParent();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderButton({
  selected = [] as string[],
  clearHomeIndicator = true,
}: { selected?: string[]; clearHomeIndicator?: boolean } = {}) {
  return render(
    <LiveButton
      schedule={SCHEDULE}
      selectedIds={new Set(selected)}
      clearHomeIndicator={clearHomeIndicator}
    />,
  );
}

function liveTrigger() {
  return screen.getByRole("button", { name: LIVE_LABEL });
}

async function openPanel(): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(liveTrigger());
  });
  return screen.getByRole("dialog", { name: LIVE_LABEL });
}

function nowLine(panel: HTMLElement, stageId: string): HTMLElement {
  const line = panel.querySelector<HTMLElement>(`[data-live-stage="${stageId}"] [data-live-now]`);
  if (!line) throw new Error(`no "Ahora" line for ${stageId}`);
  return line;
}

function stageRow(panel: HTMLElement, stageId: string): HTMLElement {
  const row = panel.querySelector<HTMLElement>(`[data-live-stage="${stageId}"]`);
  if (!row) throw new Error(`no row for ${stageId}`);
  return row;
}

describe("LiveButton", () => {
  it("live-button: el botón está abajo a la derecha, fuera del scroll de la grilla", () => {
    render(
      <ScheduleScreen
        schedule={SCHEDULE}
        savedShowIds={[]}
        initialDayId="fri"
        userName="Ana"
        userId="user-ana"
        mode="offline"
        groups={[]}
        saveAction={vi.fn(async () => ({ ok: true as const }))}
        logoutAction={vi.fn(async () => {})}
      />,
    );

    const trigger = liveTrigger();
    const grid = screen.getByRole("region", { name: "Grilla del Viernes" });
    // Not inside the grid's scroll: it would scroll away with it (AC-01).
    expect(trigger.closest(".schedule-scroll")).toBeNull();
    expect(grid.contains(trigger)).toBe(false);
    // A sibling of the grid in a relative wrapper, positioned over it, not `fixed`.
    const wrapper = trigger.parentElement;
    expect(wrapper).toHaveClass("relative", "flex", "min-h-0", "flex-1", "flex-col");
    expect(wrapper?.contains(grid)).toBe(true);
    expect(trigger).toHaveClass("absolute", "z-20", "rounded-full");
    expect(trigger).not.toHaveClass("fixed");
    // Bottom right, clear of the right inset and, without the pending bar, of the home indicator.
    expect(trigger).toHaveClass("right-[max(1rem,env(safe-area-inset-right,0px))]");
    expect(trigger).toHaveClass("bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]");
    // Touch: no double-tap delay and no text selection (mobile-native, fixes 5 and 8).
    expect(trigger).toHaveClass("touch-manipulation", "select-none");
    cleanup();

    // With the pending bar below, the wrapper already ends above the home indicator.
    renderButton({ clearHomeIndicator: false });
    expect(liveTrigger()).toHaveClass("bottom-4");
    expect(liveTrigger()).not.toHaveClass("bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]");
  });

  it("live-button: el botón es una píldora love con punto, texto «En vivo» y anillo animado", () => {
    renderButton();
    const trigger = liveTrigger();

    // Visible text and a live dot, not an icon alone; the accessible name stays «En vivo».
    expect(trigger).toHaveTextContent(LIVE_LABEL);
    expect(trigger.querySelector("[data-live-dot]")).not.toBeNull();
    expect(trigger).toHaveClass("border-[1.5px]", "border-rp-love", "text-foreground");
    expect(trigger.className).toContain("bg-[color-mix(in_srgb,var(--color-rp-love)_16%");
    // The ring only runs when motion is allowed (S6).
    expect(trigger).toHaveClass("motion-safe:animate-live-ring");
    expect(trigger.className).not.toMatch(/(^|\s)animate-live-ring/);
  });

  it("live-button: el encabezado tiene punto en vivo y la hora de la app a la derecha", async () => {
    renderButton();
    const panel = await openPanel();

    // 18:30 on Friday: shows are playing, so the title carries the dot (hidden from the name).
    const title = within(panel).getByRole("heading", { name: LIVE_LABEL });
    expect(title.querySelector("[data-live-dot]")).not.toBeNull();
    expect(panel.querySelector("[data-live-time]")).toHaveTextContent("18:30");
  });

  it("live-button: sin shows sonando el título no lleva punto", async () => {
    vi.setSystemTime(Date.parse("2026-03-14T10:00:00-03:00"));
    renderButton();
    const panel = await openPanel();

    expect(
      within(panel).getByRole("heading", { name: LIVE_LABEL }).querySelector("[data-live-dot]"),
    ).toBeNull();
    expect(panel.querySelector("[data-live-time]")).toHaveTextContent("10:00");
  });

  it('live-button: tocar En vivo abre el diálogo "En vivo"', async () => {
    renderButton();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const panel = await openPanel();

    expect(within(panel).getByRole("heading", { name: LIVE_LABEL })).toBeInTheDocument();
    // The attribute the 250 ms rule in globals.css hangs on (NFR-01).
    expect(panel).toHaveAttribute("data-live-panel");
    // 18:30 of Friday in the fixture: DJO plays on Flow, Easykid on Perry's.
    expect(nowLine(panel, "flow")).toHaveTextContent("DJO");
    expect(nowLine(panel, "perrys")).toHaveTextContent("Easykid");
    expect(nowLine(panel, "samsung")).toHaveTextContent(NOTHING_NOW);
    // Its body scrolls inside the sheet and does not chain the scroll (mobile-native, fix 6).
    expect(panel.querySelector(".overflow-y-auto.overscroll-contain")).not.toBeNull();
  });

  it("live-button: Cerrar cierra el panel y la selección queda igual", async () => {
    renderButton({ selected: ["fri-flow-1800"] });

    const panel = await openPanel();
    expect(within(stageRow(panel, "flow")).getByText(SELECTED_LABEL)).toBeInTheDocument();
    const close = within(panel).getByRole("button", { name: CLOSE_LABEL });
    // Tapping it never starts a drag of the sheet (gestures).
    expect(close.closest("[data-vaul-no-drag]")).not.toBeNull();

    await act(async () => {
      fireEvent.click(close);
    });
    await act(async () => {
      endVaulCloseAnimation(panel);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Opening it again shows the same chosen show, and only that one, with its mark.
    const again = await openPanel();
    const djo = stageRow(again, "flow");
    expect(nowLine(again, "flow")).toHaveTextContent("DJO");
    expect(within(djo).getByText(SELECTED_LABEL)).toBeInTheDocument();
    expect(within(again).getAllByText(SELECTED_LABEL)).toHaveLength(1);
  });

  it("live-button: mientras se cierra, el panel sigue mostrando su contenido", async () => {
    renderButton();

    const panel = await openPanel();
    expect(nowLine(panel, "flow")).toHaveTextContent("DJO");

    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: CLOSE_LABEL }));
    });

    // Vaul keeps the sheet mounted while it slides down: it must not slide down empty.
    expect(panel).toBeInTheDocument();
    expect(nowLine(panel, "flow")).toHaveTextContent("DJO");
    expect(panel.querySelectorAll("[data-live-stage]")).toHaveLength(5);

    await act(async () => {
      endVaulCloseAnimation(panel);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("live-button: con el panel abierto se actualiza al cambiar el minuto", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(FRIDAY_23_29_30);
    renderButton();

    const panel = await openPanel();
    expect(nowLine(panel, "samsung")).toHaveTextContent(NOTHING_NOW);

    await act(async () => {
      vi.advanceTimersByTime(30_050);
    });

    // 23:30: Peggy Gou plays, without closing or reopening the panel (AC-13).
    const same = screen.getByRole("dialog", { name: LIVE_LABEL });
    expect(same).toBe(panel);
    expect(nowLine(same, "samsung")).toHaveTextContent("Peggy Gou");
  });

  it("live-button: el botón y Cerrar miden al menos 44 × 44", async () => {
    renderButton();

    // jsdom has no layout: the sizes are read from their classes (h-12 = 48 px, min-h-11 and
    // size-11 = 44 px); the real measurement is the E2E of Block 4. The pill stays within the
    // 56 px footprint the grid's clearance is sized from.
    expect(liveTrigger()).toHaveClass("h-12", "min-h-11");
    expect(liveTrigger()).not.toHaveClass("size-14");
    const panel = await openPanel();
    expect(within(panel).getByRole("button", { name: CLOSE_LABEL })).toHaveClass("size-11");
  });

  it("live-button: dentro de /demo el panel usa la hora del reloj", async () => {
    const parent = setDemoParent();
    renderButton();

    // /demo sends Friday 23:45; the real time is still Friday 18:30.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: DEMO_CLOCK_MESSAGE, at: FRIDAY_23_45 },
          origin: window.location.origin,
          source: parent as unknown as MessageEventSource,
        }),
      );
    });
    const panel = await openPanel();

    // The clock's 23:45, not the real 18:30: Peggy Gou plays and DJO is over (AC-16).
    expect(nowLine(panel, "samsung")).toHaveTextContent("Peggy Gou");
    expect(nowLine(panel, "flow")).not.toHaveTextContent("DJO");
    expect(nowLine(panel, "flow")).toHaveTextContent(NOTHING_NOW);
  });
});
