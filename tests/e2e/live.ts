import { expect, type Locator, type Page } from "@playwright/test";

import { CLOSE_LABEL, LIVE_LABEL } from "@/lib/live-messages";

// The steps the "En vivo" E2E tests share (FEAT-005a): fixing the browser's time, opening and
// closing the panel, and reading its rows. Only the browser's time is fixed: the server keeps the
// real one (no simulated clock outside /demo), so the day the grid opens on is not the festival's.
// The labels come from the app's own texts (`src/lib/live-messages.ts`, pure, no I/O).

/** A festival instant in Buenos Aires time ("2026-03-13T22:30" or "…T23:29:40"), as a `Date`. */
export function art(localDateTime: string): Date {
  const withSeconds = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime;
  return new Date(`${withSeconds}-03:00`);
}

/**
 * Fixes the browser's time at `time` before the first page loads, without pausing it (G3): with
 * `setFixedTime` or `pauseAt` `Date` stands still, and Vaul's 500 ms drag guard, which compares two
 * `Date`s, would block the swipe forever. The time runs on from there, as a real clock.
 */
export async function installTime(page: Page, time: Date): Promise<void> {
  await page.clock.install({ time });
}

/** The floating "En vivo" button of the day on screen. */
export function liveButton(page: Page): Locator {
  return page.getByRole("button", { name: LIVE_LABEL, exact: true });
}

/**
 * The same button, found by its attribute instead of its role. It exists because, while the panel
 * is open, the sheet (a modal dialog) leaves the rest of the page `aria-hidden`: `getByRole` no
 * longer finds the button, though it is still on screen under the overlay and can be measured.
 */
export function liveButtonHidden(page: Page): Locator {
  return page.locator(`button[aria-label="${LIVE_LABEL}"]`);
}

/** The "En vivo" panel (a Vaul sheet: it renders nothing while closed). */
export function livePanel(page: Page): Locator {
  return page.getByRole("dialog", { name: LIVE_LABEL });
}

/** "Cerrar", inside the panel. */
export function closeButton(page: Page): Locator {
  return livePanel(page).getByRole("button", { name: CLOSE_LABEL, exact: true });
}

/**
 * Waits until the panel is open and in place: the sheet slides in, and a click or a measurement
 * taken mid-slide lands where it used to be. Not a ratio of 1: at the end of Vaul's curve the last
 * fraction of a pixel takes a while (as `openMenu` in grid.ts).
 */
export async function waitForPanel(page: Page): Promise<Locator> {
  const panel = livePanel(page);
  await expect(panel).toBeVisible();
  await expect(closeButton(page)).toBeInViewport({ ratio: 0.99 });
  await expect
    .poll(
      () =>
        panel.evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").length),
      {
        message: "la animación de apertura del panel no terminó",
      },
    )
    .toBe(0);
  return panel;
}

/** Taps "En vivo" and waits for the panel to be in place. */
export async function openLive(page: Page): Promise<Locator> {
  await liveButton(page).click();
  return waitForPanel(page);
}

/** Waits until the sheet left the page (Vaul unmounts it after its closing slide). */
export async function expectClosed(page: Page): Promise<void> {
  await expect(livePanel(page)).toHaveCount(0);
}

/** A row of the panel: the stage's id and its «Ahora» block and its "Sigue:" line, as read on screen. */
export type LiveRow = { stageId: string; now: string; next: string };

/** The rows of the panel, in the order they are shown (whitespace collapsed). */
export async function liveRows(page: Page): Promise<LiveRow[]> {
  return livePanel(page)
    .locator("[data-live-stage]")
    .evaluateAll((rows) => {
      const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      return rows.map((row) => ({
        stageId: row.getAttribute("data-live-stage") ?? "",
        // The status («Ahora», «Elegido», «Choque»), when a show plays, and then the show.
        now: [row.querySelector("[data-live-status]"), row.querySelector("[data-live-now]")]
          .map(text)
          .filter(Boolean)
          .join(" "),
        next: text(row.querySelector("[data-live-next]")),
      }));
    });
}

/** A rectangle in viewport pixels. */
export type Rect = { left: number; top: number; right: number; bottom: number };

/** Whether two rectangles share some area (touching edges do not count). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Scrolls the grid's region, instantly, to the given offsets (huge numbers go to the end). */
export async function scrollGrid(region: Locator, to: { left?: number; top?: number }) {
  await region.evaluate((el, target) => {
    el.scrollTo({ ...target, behavior: "instant" as ScrollBehavior });
  }, to);
}

/** The grid's scroll offsets. */
export async function scrollOf(region: Locator): Promise<{ top: number; left: number }> {
  return region.evaluate((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
}
