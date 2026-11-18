import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveButton } from "@/components/live-button";
import { ScheduleScreen } from "@/components/schedule-screen";
import { CLOSE_LABEL, LIVE_LABEL, NOTHING_NOW, SELECTED_LABEL } from "@/lib/live-messages";

import { SCHEDULE } from "./schedule-fixture";
import { endVaulCloseAnimation, stubMatchMedia } from "./vaul-env";

// Viernes 13 de marzo de 2026 en Argentina (UTC-3).
const FRIDAY_18_30 = Date.parse("2026-03-13T18:30:00-03:00");
const FRIDAY_23_29_30 = Date.parse("2026-03-13T23:29:30-03:00");

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
    expect(within(nowLine(panel, "flow")).getByText(SELECTED_LABEL)).toBeInTheDocument();
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
    const djo = nowLine(again, "flow");
    expect(djo).toHaveTextContent("DJO");
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

    // jsdom has no layout: the sizes are read from their classes (size-14 = 56 px, size-11 =
    // 44 px); the real measurement is the E2E of Block 4.
    expect(liveTrigger()).toHaveClass("size-14");
    const panel = await openPanel();
    expect(within(panel).getByRole("button", { name: CLOSE_LABEL })).toHaveClass("size-11");
  });
});
