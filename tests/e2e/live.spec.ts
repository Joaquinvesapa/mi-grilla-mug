import { expect, test, type Locator, type Page } from "@playwright/test";

import { LIVE_LABEL } from "@/lib/live-messages";

import { signUp } from "./auth";
import {
  chooseDay,
  DAYS,
  gridRegion,
  pendingBar,
  saveSelection,
  showBlock,
  showById,
} from "./grid";
import {
  art,
  closeButton,
  expectClosed,
  installTime,
  intersects,
  liveButton,
  liveButtonHidden,
  livePanel,
  liveRows,
  openLive,
  scrollGrid,
  scrollOf,
  waitForPanel,
  type LiveRow,
  type Rect,
} from "./live";
import { expectChosen, goOffline, reopenOffline, signUpControlled } from "./offline";

// FEAT-005a end to end, against the production build (ADR-002): the "En vivo" button and its panel.
// Runs in the three mobile projects (iphone-webkit, mobile-chromium, mobile-360). The browser's
// time is fixed with `page.clock.install` before the first page loads and keeps running (G3); the
// server keeps the real time, so the day the grid opens on is not the festival's, and the tests
// that need a day pick it with its tab. Each test groups several AC over one account, for the 10
// minute budget of the CI's `e2e` job (G14).

/** Why the opening time is a gate in one project only (AGENTS.md: the reason, on the skipped line). */
const OPENING_SKIP =
  "AC-22 es gate solo en iphone-webkit; en un iPhone 12 real se mide a mano en VERIFY";
/** The sheet's configured opening animation (the `[data-live-panel]` rule in globals.css). */
const PANEL_ANIMATION_MS = 250;
/** Vaul ignores a drag that starts less than 500 ms after the sheet opened (G2). */
const VAUL_DRAG_GUARD_MS = 500;
/** The smallest touch target (NFR-04, AC-24). */
const MIN_TARGET = 44;

// By stable id, never by artist.
const TYLER = showById("fri-flow-2215");
const PEGGY = showById("fri-samsung-2330");
const TURF = showById("fri-alternative-2215");
const YOUSUKE = showById("fri-perrys-2215");
const UNRELATED = showById("fri-flow-1800");

const FRIDAY_2230 = art("2026-03-13T22:30");
const FRIDAY_2329 = art("2026-03-13T23:29");
const FESTIVAL_OVER_AT = art("2026-03-16T00:35");

const DONE = "Sigue: Terminó por hoy";
const NOTHING = "Nada ahora";

/** AC-04 at 22:30 on Friday, in the app's order (AC-08); `turf` marks Turf as chosen (AC-10). */
function rowsAt2230(turf: boolean): LiveRow[] {
  const flow = {
    stageId: "flow",
    now: `Ahora ${TYLER.artist} 22:15 – 23:30 · quedan 60 min`,
    next: DONE,
  };
  const samsung = {
    stageId: "samsung",
    now: NOTHING,
    next: `Sigue: ${PEGGY.artist} 23:30 (en 60 min)`,
  };
  const alternative = {
    stageId: "alternative",
    now: `Ahora${turf ? " Elegido" : ""} ${TURF.artist} 22:15 – 23:30 · quedan 60 min`,
    next: DONE,
  };
  const perrys = {
    stageId: "perrys",
    now: `Ahora ${YOUSUKE.artist} 22:15 – 23:30 · quedan 60 min`,
    next: DONE,
  };
  const kidzapalooza = { stageId: "kidzapalooza", now: NOTHING, next: DONE };
  return turf
    ? [alternative, flow, samsung, perrys, kidzapalooza]
    : [flow, samsung, alternative, perrys, kidzapalooza];
}

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, "el elemento no tiene caja").not.toBeNull();
  return box!;
}

/** The grid's state that closing the panel must leave as it was (AC-03). */
async function gridState(page: Page, region: Locator) {
  return {
    scroll: await scrollOf(region),
    pending: await pendingBar(page).isVisible(),
    chosen: await showBlock(page, UNRELATED.id).getAttribute("aria-pressed"),
  };
}

test.describe("En vivo (FEAT-005a)", () => {
  // Each test groups the spec's required tests as steps, with their exact names (Block 4).
  test("live: el botón y el panel sobre la grilla (AC-01, AC-02, AC-03)", async ({
    page,
  }, testInfo) => {
    // Sign-up, three ways of closing and a swipe that waits for Vaul's guard: more than the default.
    test.setTimeout(60_000);
    // No `page.clock` here on purpose: the swipe waits for Vaul's 500 ms guard with
    // `waitForTimeout`, which runs on the runner's time, and the page's `Date` has to move with it.
    await signUp(page, testInfo);
    // The server opens the grid on the day of its real date: Friday is chosen, not assumed.
    await chooseDay(page, "fri");
    const region = gridRegion(page, "fri");
    await expect(region).toBeVisible();
    // An unsaved mark: the pending bar has to survive every way of closing (AC-03).
    await showBlock(page, UNRELATED.id).click();
    await expectChosen(page, UNRELATED.id, true);
    await expect(pendingBar(page)).toBeVisible();

    // AC-01: down at the right of the grid, and in the same place after scrolling in y and in x.
    await test.step("live: el botón sigue visible con scroll en x e y", async () => {
      await scrollGrid(region, { top: 0, left: 0 });
      const area = await boxOf(region);
      const resting = await boxOf(liveButton(page));
      expect(resting.x + resting.width).toBeLessThanOrEqual(area.x + area.width);
      expect(resting.y + resting.height).toBeLessThanOrEqual(area.y + area.height);
      expect(resting.x, "el botón no está en la mitad derecha").toBeGreaterThan(
        area.x + area.width / 2,
      );
      expect(resting.y, "el botón no está en la mitad de abajo").toBeGreaterThan(
        area.y + area.height / 2,
      );
      for (const to of [{ top: 600 }, { left: 10_000 }, { top: 10_000, left: 10_000 }]) {
        await scrollGrid(region, to);
        if (to.top) await expect.poll(async () => (await scrollOf(region)).top).toBeGreaterThan(0);
        if (to.left)
          await expect.poll(async () => (await scrollOf(region)).left).toBeGreaterThan(0);
        await expect(liveButton(page)).toBeInViewport();
        const moved = await boxOf(liveButton(page));
        expect(
          Math.abs(moved.x - resting.x),
          `el botón se movió en x con ${JSON.stringify(to)}`,
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(moved.y - resting.y),
          `el botón se movió en y con ${JSON.stringify(to)}`,
        ).toBeLessThanOrEqual(0.5);
      }
    });

    // AC-02 and AC-03.
    await test.step("live: abrir y cerrar de las 3 formas sin perder scroll ni pendientes", async () => {
      await scrollGrid(region, { top: 400, left: 150 });
      await expect.poll(async () => (await scrollOf(region)).top).toBeGreaterThan(0);
      const before = await gridState(page, region);
      expect(before.pending).toBe(true);
      const viewport = page.viewportSize()!;

      // AC-02 and AC-03, closing with "Cerrar".
      const panel = await openLive(page);
      const sheet = await boxOf(panel);
      expect(sheet.y + sheet.height, "el panel no sale desde abajo").toBeGreaterThanOrEqual(
        viewport.height - 1,
      );
      expect(sheet.y, "el panel no deja ver la grilla arriba").toBeGreaterThan(0);
      await closeButton(page).click();
      await expectClosed(page);
      expect(await gridState(page, region), "cerrar con Cerrar cambió la grilla").toEqual(before);

      // Tapping outside: on the overlay, above the sheet.
      await openLive(page);
      await page.mouse.click(viewport.width / 2, 20);
      await expectClosed(page);
      expect(await gridState(page, region), "tocar afuera cambió la grilla").toEqual(before);

      // Swiping down: the sheet follows the finger 1:1 (gestures), with the 250 ms rule of
      // `[data-live-panel]` on (Vaul writes `transition: none` while dragging), and closes on release.
      const swiped = await openLive(page);
      // Vaul's guard compares `Date`s: real time has to pass, nothing on the page signals it.
      await page.waitForTimeout(VAUL_DRAG_GUARD_MS + 100);
      const start = await boxOf(swiped);
      const x = start.x + start.width / 2;
      const y = start.y + 20; // on the handle, away from "Cerrar" (data-vaul-no-drag)
      await page.mouse.move(x, y);
      await page.mouse.down();
      const followed: { finger: number; sheet: number }[] = [];
      for (const finger of [30, 60, 90, 120]) {
        await page.mouse.move(x, y + finger, { steps: 3 });
        followed.push({ finger, sheet: (await boxOf(swiped)).y - start.y });
      }
      testInfo.annotations.push({ type: "swipe", description: JSON.stringify(followed) });
      for (const step of followed) {
        expect(
          Math.abs(step.sheet - step.finger),
          `el panel no sigue al dedo: ${JSON.stringify(followed)}`,
        ).toBeLessThanOrEqual(2);
      }
      // Well past Vaul's close threshold (a quarter of the sheet's height), in small steps, so
      // the release closes it whatever the sheet's height and the drag's speed.
      // Kept inside the viewport: a pointer outside it gets no events.
      const release = Math.min(Math.max(240, start.height * 0.75), viewport.height - 2 - y);
      expect(release, "no hay lugar para arrastrar el panel más allá del umbral").toBeGreaterThan(
        start.height * 0.25 + 20,
      );
      await page.mouse.move(x, y + release, { steps: 12 });
      await page.mouse.up();
      await expectClosed(page);
      expect(await gridState(page, region), "cerrar deslizando cambió la grilla").toEqual(before);
    });
  });

  test("live: el panel a las 22:30 y a las 23:30 del viernes, a 360 px (AC-04, AC-10, AC-13, AC-24)", async ({
    page,
  }, testInfo) => {
    // AC-24 is measured at 360 px in every project; 640 high, so that the five stages overflow the
    // sheet's 80dvh and its body has to scroll on its own (G10).
    await page.setViewportSize({ width: 360, height: 640 });
    await installTime(page, FRIDAY_2230);
    await signUp(page, testInfo);
    await chooseDay(page, "fri");

    // AC-04 and AC-10.
    const panel = await test.step("live: 22:30 del viernes con Turf sin guardar", async () => {
      // AC-10: Turf marked and not saved.
      await showBlock(page, TURF.id).click();
      await expectChosen(page, TURF.id, true);
      await expect(pendingBar(page)).toBeVisible();

      // Signing up took a while: back to 22:30:00 sharp, so it is "en 60 min" (the time keeps running).
      await page.clock.setSystemTime(FRIDAY_2230);
      const opened = await openLive(page);
      // AC-04 and AC-10: Alternative first, with the mark next to Turf, then the app's order.
      expect(await liveRows(page)).toEqual(rowsAt2230(true));
      return opened;
    });

    // AC-24, with the panel of 22:30 open (five stages, the longest names).
    await test.step("live: a 360 px, tamaños y sin scroll horizontal", async () => {
      // The button, at least 44 × 44, measured under the overlay (its box does not change), with
      // the open sheet leaving it `aria-hidden` (see `liveButtonHidden`).
      const button = await boxOf(liveButtonHidden(page));
      expect(button.width).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(button.height).toBeGreaterThanOrEqual(MIN_TARGET);

      // "Cerrar" at least 44 × 44, and no sideways scroll in the sheet nor in the page.
      const close = await boxOf(closeButton(page));
      expect(close.width).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(close.height).toBeGreaterThanOrEqual(MIN_TARGET);
      const overflow = await panel.evaluate((sheet) => {
        const all = [sheet, ...Array.from(sheet.querySelectorAll("*"))];
        // A sideways scroll: a box that can scroll in x and is wider inside than outside. (The
        // visually hidden "Elegido" is 1 px wide and clips its text: it cannot scroll.)
        const wider = all
          .filter((el) => ["auto", "scroll"].includes(getComputedStyle(el).overflowX))
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => `${el.tagName}.${el.className}`);
        // And nothing sticks out of the sheet where it would be cut off.
        const box = sheet.getBoundingClientRect();
        const outside = all
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.right > box.right + 0.5 || rect.left < box.left - 0.5;
          })
          .map((el) => `${el.tagName} ${el.textContent ?? ""}`);
        return {
          wider,
          outside,
          page: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(overflow).toEqual({ wider: [], outside: [], page: 0 });
      await closeButton(page).click();
      await expectClosed(page);
    });

    // AC-13: the panel open from 23:29, and the minute changes with nobody touching it.
    await test.step("live: de 23:29 a 23:30 cambia solo", async () => {
      await page.clock.setSystemTime(FRIDAY_2329);
      const open = await openLive(page);
      const samsungAt = (rows: LiveRow[]) => rows.find((row) => row.stageId === "samsung");
      expect(samsungAt(await liveRows(page))).toEqual({
        stageId: "samsung",
        now: NOTHING,
        next: `Sigue: ${PEGGY.artist} 23:30 (en 1 min)`,
      });
      // A mark on the sheet's node: if the panel closed and opened again, it would be a new node.
      await open.evaluate((el) => el.setAttribute("data-e2e-same-panel", ""));
      // Stopped at 23:29:55, still before the minute changes: opening took only a few seconds.
      const pauseTime = art("2026-03-13T23:29:55");
      expect(
        await page.evaluate(() => Date.now()),
        "abrir el panel tardó tanto que ya pasaron las 23:29:55: no hay margen para pauseAt",
      ).toBeLessThan(pauseTime.getTime());
      await page.clock.pauseAt(pauseTime);
      expect(samsungAt(await liveRows(page))?.now, "cambió antes de las 23:30").toBe(NOTHING);
      // To 23:30:55: well past the minute change and the hook's timer (23:30:00.050).
      await page.clock.runFor(60_000);
      await expect
        .poll(async () => samsungAt(await liveRows(page)), {
          message: "no cambió solo a las 23:30",
        })
        .toEqual({
          stageId: "samsung",
          now: `Ahora ${PEGGY.artist} 23:30 – 01:00 · quedan 90 min`,
          next: DONE,
        });
      expect((await liveRows(page)).find((row) => row.stageId === "flow")?.now).toBe(NOTHING);
      await expect(livePanel(page)).toHaveAttribute("data-e2e-same-panel", "");
    });
  });

  test("live: la hora real y el espacio libre al final de la grilla (AC-15, AC-21)", async ({
    page,
  }, testInfo) => {
    // Sign-up, the panel twice and the three days at both ends of the grid.
    test.setTimeout(60_000);
    // The real time, untouched: after the festival.
    await signUp(page, testInfo);
    expect(
      await page.evaluate(() => Date.now()),
      "la hora real del navegador no es posterior al festival (00:35 del 16/03/2026): revisá el reloj del runner",
    ).toBeGreaterThan(FESTIVAL_OVER_AT.getTime());

    // AC-15: nothing on `/` sets the time, and the panel only follows the real one.
    await test.step("live: en / no hay control de hora", async () => {
      const timeControls = page.locator(
        'input[type="time"], input[type="datetime-local"], input[type="date"], input[type="range"]',
      );
      await expect(timeControls).toHaveCount(0);
      await expect(page.getByRole("slider")).toHaveCount(0);
      await expect(page.getByRole("spinbutton")).toHaveCount(0);
      const panel = await openLive(page);
      await expect(panel).toContainText("El festival terminó");
      await expect(panel.getByRole("button")).toHaveCount(1); // "Cerrar", nothing else
      await expect(panel.locator("input, select, textarea, [role=slider]")).toHaveCount(0);
      await closeButton(page).click();
      await expectClosed(page);
      // Neither the URL nor the device's storage can bring another time in (FR-14). The keys and
      // parameters are invented on purpose: the app reads none, and that is the point. They stand
      // for whatever a time override would plausibly be called, so the panel must ignore them.
      await page.evaluate((time) => {
        for (const key of ["mi-grilla:now", "mi-grilla:clock", "now", "clock"]) {
          localStorage.setItem(key, time);
        }
      }, FRIDAY_2230.toISOString());
      const at = encodeURIComponent(FRIDAY_2230.toISOString());
      await page.goto(`/?now=${at}&time=${at}&clock=${at}&hora=22:30`);
      await expect(await openLive(page)).toContainText("El festival terminó");
      await closeButton(page).click();
      await expectClosed(page);
    });

    // AC-21: the three days, at the end of the grid, at its left and at its right.
    await test.step("live: al final del scroll ningún show queda debajo del botón", async () => {
      for (const day of DAYS) {
        await chooseDay(page, day.id);
        const region = gridRegion(page, day.id);
        for (const left of [0, 100_000]) {
          await scrollGrid(region, { top: 100_000, left });
          await expect
            .poll(() => region.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
            .toBeLessThanOrEqual(1);
          const layout = await region.evaluate((el) => {
            const toRect = (r: DOMRect): Rect => ({
              left: r.left,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
            });
            return {
              area: toRect(el.getBoundingClientRect()),
              blocks: Array.from(el.querySelectorAll("[data-show-id]")).map((block) => ({
                id: block.getAttribute("data-show-id") ?? "",
                rect: toRect(block.getBoundingClientRect()),
              })),
            };
          });
          await expect(liveButton(page), `no hay botón En vivo el ${day.name}`).toBeVisible();
          const box = await boxOf(liveButton(page));
          const buttonRect: Rect = {
            left: box.x,
            top: box.y,
            right: box.x + box.width,
            bottom: box.y + box.height,
          };
          // Only the part of each block the grid shows can be covered.
          const covered = layout.blocks
            .filter(({ rect }) => intersects(rect, layout.area))
            .filter(({ rect }) =>
              intersects(
                {
                  left: Math.max(rect.left, layout.area.left),
                  top: Math.max(rect.top, layout.area.top),
                  right: Math.min(rect.right, layout.area.right),
                  bottom: Math.min(rect.bottom, layout.area.bottom),
                },
                buttonRect,
              ),
            )
            .map(({ id }) => id);
          expect(covered, `el botón tapa shows el ${day.name} (scrollLeft ${left})`).toEqual([]);
          // And whatever column ends up under the button at another width: the day's last block (the
          // one that touches the end of the axis, G4) ends above the button's top, inside the grid.
          const lowest = Math.max(...layout.blocks.map(({ rect }) => rect.bottom));
          expect(lowest, `el último show del ${day.name} baja hasta el botón`).toBeLessThanOrEqual(
            buttonRect.top,
          );
          expect(lowest).toBeLessThanOrEqual(layout.area.bottom);
        }
      }
    });
  });

  // AC-20.
  test("live: sin conexión muestra lo mismo", async ({ page, context }, testInfo) => {
    // Sign-up waiting for the service worker, a save, and the page opened again offline.
    test.setTimeout(60_000);
    await installTime(page, FRIDAY_2230);
    await signUpControlled(page, testInfo);
    await chooseDay(page, "fri");
    // Saved, so that the offline screen (which only has the device copy) has the same selection.
    await showBlock(page, TURF.id).click();
    await saveSelection(page);

    await page.clock.setSystemTime(FRIDAY_2230);
    await openLive(page);
    const online = await liveRows(page);
    expect(online).toEqual(rowsAt2230(true));
    await closeButton(page).click();
    await expectClosed(page);

    await goOffline(page, context);
    await reopenOffline(page);
    await chooseDay(page, "fri");
    await page.clock.setSystemTime(FRIDAY_2230);
    await openLive(page);
    expect(await liveRows(page)).toEqual(online);
  });

  // AC-22. Only what is deterministic is asserted: every animation of the sheet is configured at
  // ≤ 250 ms, and the sheet has an opening animation that finishes (it ends up open). No wall-clock
  // time is asserted: in the Playwright container (headless WebKit, 4 workers) the stretch from
  // the sheet mounted to the end of its animations measured 225–301 ms with a 250 ms animation
  // (frame noise of headless WebKit), and the total from the tap 264–356 ms. Those times are
  // recorded (annotation `AC-22` and the log), and the criterion of ≤ 300 ms on an iPhone 12 is
  // checked by hand in VERIFY (finding 12).
  test("live: el panel abre en ≤ 300 ms", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iphone-webkit", OPENING_SKIP); // AC-22 se mide solo en WebKit (iPhone)
    // Timed by the page itself: the pointerdown on the button, the mounting of the sheet and the
    // end of every animation of the sheet (not of the overlay, whose 500 ms fade stays: it covers
    // nothing).
    await page.addInitScript((label) => {
      const timing = {
        tap: null as number | null,
        mounted: null as number | null,
        end: null as number | null,
        durations: [] as number[],
        error: null as string | null,
      };
      Object.assign(window, { __liveTiming: timing });
      document.addEventListener(
        "pointerdown",
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (timing.tap === null && target?.closest(`[aria-label="${label}"]`)) {
            timing.tap = performance.now();
          }
        },
        true,
      );
      /** Frames to wait for the opening animation to show up once the sheet is mounted. */
      const MAX_FRAMES = 30;
      // The sheet can be mounted a frame before its animation starts: look for it frame by frame
      // instead of trusting the first mutation, then wait for every animation of the sheet to end.
      function measure(sheet: Element, frame: number) {
        const animations = sheet.getAnimations();
        if (animations.length === 0) {
          if (frame >= MAX_FRAMES) {
            timing.error = `el panel no tuvo animación en ${MAX_FRAMES} frames`;
            return;
          }
          requestAnimationFrame(() => measure(sheet, frame + 1));
          return;
        }
        // The configured duration, as the CSS sets it (the `[data-live-panel]` rule).
        timing.durations = animations.map((animation) =>
          Number(animation.effect?.getTiming().duration ?? 0),
        );
        void Promise.all(animations.map((animation) => animation.finished)).then(() => {
          timing.end = performance.now();
        });
      }
      const observer = new MutationObserver(() => {
        const sheet = document.querySelector("[data-live-panel]");
        if (!sheet || timing.tap === null) return;
        observer.disconnect();
        timing.mounted = performance.now();
        measure(sheet, 0);
      });
      observer.observe(document, { childList: true, subtree: true });
    }, LIVE_LABEL);
    await signUp(page, testInfo);
    await liveButton(page).click();
    await waitForPanel(page);
    type Timing = {
      tap: number | null;
      mounted: number | null;
      end: number | null;
      durations: number[];
      error: string | null;
    };
    const readTiming = () =>
      page.evaluate(() => (window as unknown as { __liveTiming: Timing }).__liveTiming);
    // Done when the animations ended or the page gave up looking for them.
    await expect
      .poll(
        async () => {
          const current = await readTiming();
          return current.end !== null || current.error !== null;
        },
        { message: "la medición de la apertura no terminó" },
      )
      .toBe(true);
    const measured = await readTiming();
    expect(measured.error, "el panel no tiene animación de apertura").toBeNull();
    expect(measured.tap, "no se registró el toque").not.toBeNull();
    expect(measured.mounted, "no se registró el montaje del panel").not.toBeNull();
    // (b) The sheet has an opening animation, and its `finished` resolved: it ended up open.
    expect(measured.durations.length, "el panel no tiene animación de apertura").toBeGreaterThan(0);
    expect(measured.end, "la animación de apertura del panel no terminó").not.toBeNull();
    const total = measured.end! - measured.tap!;
    const mounting = measured.mounted! - measured.tap!;
    const opening = measured.end! - measured.mounted!;
    const description = `total ${Math.round(total)} ms (montaje ${Math.round(mounting)} ms, animación ${Math.round(opening)} ms)`;
    testInfo.annotations.push({ type: "AC-22", description });
    console.log(`AC-22: ${description}, configuradas ${measured.durations.join(", ")} ms`);
    // (a) Every animation of the sheet is configured at 250 ms or less.
    for (const duration of measured.durations) {
      expect(duration, "una animación del panel dura más de 250 ms (AC-22)").toBeLessThanOrEqual(
        PANEL_ANIMATION_MS,
      );
    }
  });
});

test.describe("En vivo con la zona horaria de Madrid (FEAT-005a)", () => {
  test.use({ timezoneId: "Europe/Madrid" });

  // AC-14.
  test("live: con zona de Madrid muestra hora de Argentina", async ({ page }, testInfo) => {
    await installTime(page, FRIDAY_2230);
    await signUp(page, testInfo);
    await chooseDay(page, "fri");
    // The device really is in Madrid: 22:30 in Buenos Aires is 02:30 there.
    expect(
      await page.evaluate(() => ({
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hours: new Date().getHours(),
      })),
    ).toEqual({ zone: "Europe/Madrid", hours: 2 });

    await page.clock.setSystemTime(FRIDAY_2230);
    await openLive(page);
    expect(await liveRows(page)).toEqual(rowsAt2230(false));
  });
});
