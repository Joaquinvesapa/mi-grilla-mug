import { expect, test, type Browser, type Page, type Route } from "@playwright/test";

import { submitLogin, type TestAccount } from "./auth";
import { pendingBar, saveSelection, showBlock, showById, tapLogout } from "./grid";
import {
  expectChosen,
  goOffline,
  notice,
  readDeviceCopy,
  readPendingIds,
  reopenOffline,
  saveOffline,
  signUpControlled,
} from "./offline";

// FEAT-003b, AC-20 to AC-27 and NFR-02, end to end with the production build's service worker
// (ADR-002, ADR-004). Runs in the three mobile projects (iphone-webkit, mobile-chromium,
// mobile-360): playwright.config.ts does not exclude this file from any of them. Every test signs
// up accounts of its own, so no test sees another's selection, and nothing that already exists in
// the database is touched.

/** NFR-01 of FEAT-003a, which the sync reuses: one save answers in a second at most. */
const SAVE_BUDGET_MS = 1000;
const PHONE_WIDTHS = [
  { width: 360, height: 780 },
  { width: 430, height: 932 },
];

// Shows of Friday, the day the grid opens on outside the festival (with and without signal: both
// use the real clock). Two of them, by stable id, never by artist.
const SHOW_X = showById("fri-flow-1800").id;
const SHOW_Y = showById("fri-samsung-2100").id;

function offlineCardHeading(page: Page) {
  return page.getByRole("heading", { level: 1, name: "Sin conexión" });
}

/** The shows marked as chosen on screen (the day on screen only). */
function chosenBlocks(page: Page) {
  return page.locator('[data-show-id][aria-pressed="true"]');
}

/** The Server Action calls: POSTs carrying Next's `Next-Action` header. */
function isServerAction(route: Route): boolean {
  const request = route.request();
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

type ActionFailure = { aborted: () => Promise<number>; lift: () => Promise<void> };

/**
 * Makes every Server Action of `page` get no answer (the sync fails at the network, AC-24).
 * Returns how many were stopped, and the function that lifts the failure.
 *
 * In Chromium, with `page.route`: the request is aborted at the network. Playwright's WebKit does
 * not route the requests of a page controlled by a service worker (it reports them as `request`
 * events, but no route handler ever sees them), so there the page's own `fetch` rejects them as
 * Safari does without a connection. The failure lives in this document: nothing may navigate
 * before `lift()`.
 */
async function failServerActions(page: Page, browserName: string): Promise<ActionFailure> {
  if (browserName !== "webkit") {
    let aborted = 0;
    const handler = async (route: Route) => {
      if (isServerAction(route)) {
        aborted += 1;
        await route.abort("internetdisconnected");
        return;
      }
      await route.fallback();
    };
    await page.route("**/*", handler);
    return { aborted: async () => aborted, lift: () => page.unroute("**/*", handler) };
  }

  await page.evaluate(() => {
    const original = window.fetch;
    const state = { failing: true, aborted: 0 };
    Object.assign(window, { __actionFailure: state });
    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : null;
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      const headers = new Headers(init?.headers ?? request?.headers);
      if (state.failing && method === "POST" && headers.has("next-action")) {
        state.aborted += 1;
        return Promise.reject(new TypeError("Load failed"));
      }
      return original(input, init);
    };
  });
  const read = () =>
    page.evaluate(
      () =>
        (window as unknown as { __actionFailure: { failing: boolean; aborted: number } })
          .__actionFailure,
    );
  return {
    aborted: async () => (await read()).aborted,
    lift: async () => {
      await page.evaluate(() => {
        (window as unknown as { __actionFailure: { failing: boolean } }).__actionFailure.failing =
          false;
      });
    },
  };
}

/**
 * Runs `fn` on another device: `account` signed in on a fresh context (no device copy, no pending
 * selection), closed afterwards whatever happens.
 */
async function withOtherDevice(
  browser: Browser,
  account: TestAccount,
  fn: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await submitLogin(page, account.email, account.password);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("tab", { name: "Viernes", exact: true })).toBeVisible();
    await fn(page);
  } finally {
    await context.close();
  }
}

/**
 * Asserts `assertion` now and again every 100 ms for `ms`: a state that has to hold, not only be
 * reached (the sync that just failed must not drop the pending selection a moment later).
 */
async function expectHeldFor(ms: number, assertion: () => Promise<void>): Promise<void> {
  const until = Date.now() + ms;
  await assertion();
  while (Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await assertion();
  }
}

test.describe("la grilla sin conexión (FEAT-003b)", () => {
  test("test-e2e-offline-grid: con conexión guarda un show, sin conexión recarga / y lo ve elegido (AC-20)", async ({
    page,
    context,
  }, testInfo) => {
    await signUpControlled(page, testInfo);
    await showBlock(page, SHOW_X).click();
    await saveSelection(page);
    await expect
      .poll(async () => (await readDeviceCopy(page))?.savedShowIds ?? null)
      .toEqual([SHOW_X]);

    await goOffline(page, context);
    await reopenOffline(page);

    await expect(offlineCardHeading(page)).toHaveCount(0);
    await expectChosen(page, SHOW_X, true);
    await expectChosen(page, SHOW_Y, false);
    await expect(chosenBlocks(page)).toHaveCount(1);
    // What the server confirmed: nothing is waiting to be synced.
    await expect(notice(page)).toHaveCount(0);
  });

  test('test-e2e-offline-after-logout: después de "Cerrar sesión", sin conexión / muestra "Sin conexión" (AC-21)', async ({
    page,
    context,
  }, testInfo) => {
    await signUpControlled(page, testInfo);
    await showBlock(page, SHOW_X).click();
    await saveSelection(page);

    await tapLogout(page);
    await expect(page).toHaveURL("/login");

    await goOffline(page, context);
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(offlineCardHeading(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    // Neither the grid nor the last user's selection.
    await expect(page.locator("[data-show-id]")).toHaveCount(0);
  });

  test("test-e2e-offline-save-reopen: sin conexión guarda un show, ve el aviso, cierra y vuelve a abrir sin conexión y lo sigue viendo (AC-22, AC-25)", async ({
    page,
    context,
  }, testInfo) => {
    await signUpControlled(page, testInfo);

    await saveOffline(page, context, SHOW_X);
    // The notice: what happened and what to do meanwhile (FR-04).
    await expect(notice(page)).toContainText(
      "Tus cambios se suben solos cuando vuelva la conexión.",
    );
    await expect(notice(page)).toContainText("fondo de pantalla");
    // Saved on the device, so nothing is left pending on screen and no error is shown.
    await expect(pendingBar(page)).toHaveCount(0);

    // Close the app and open it again, still without a connection.
    await page.close();
    const reopened = await context.newPage();
    await reopenOffline(reopened);

    await expectChosen(reopened, SHOW_X, true);
    await expect(notice(reopened)).toBeVisible();
    await expect(pendingBar(reopened)).toHaveCount(0);
  });

  test("test-e2e-offline-sync: al volver la señal el aviso desaparece y otro dispositivo con la misma cuenta ve el show elegido (AC-23)", async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const { account, userId } = await signUpControlled(page, testInfo);
    await saveOffline(page, context, SHOW_X);
    await reopenOffline(page);
    await expect(notice(page)).toBeVisible();

    const syncCall = page.waitForRequest(
      (request) => request.method() === "POST" && request.headers()["next-action"] !== undefined,
    );
    await context.setOffline(false);
    const request = await syncCall;
    const response = await request.response();
    expect(response, "la sincronización no recibió respuesta").not.toBeNull();
    expect(response!.status()).toBe(200);
    await response!.finished();

    // NFR-01: the sync is one call to the save action, timed by the browser from the request sent
    // to the last byte of the answer (`requestStart` to `responseEnd`), so neither the time the
    // page takes to notice the signal nor Playwright's own round trips count. A browser that does
    // not report these timings (-1, as can happen for a page controlled by a service worker) only
    // gets it noted: the p95 is asserted by test-selection-save-p95 (integration, 20 saves).
    const timing = request.timing();
    if (timing.requestStart >= 0 && timing.responseEnd >= 0) {
      const elapsed = timing.responseEnd - timing.requestStart;
      testInfo.annotations.push({
        type: "NFR-01",
        description: `sincronización: ${Math.round(elapsed)} ms`,
      });
      expect(elapsed, "la sincronización tardó más de un segundo (NFR-01)").toBeLessThanOrEqual(
        SAVE_BUDGET_MS,
      );
    } else {
      testInfo.annotations.push({
        type: "NFR-01",
        description: `sin timing del navegador (requestStart ${timing.requestStart}, responseEnd ${timing.responseEnd}); no se afirma`,
      });
    }

    await expect(notice(page)).toHaveCount(0);
    await expectChosen(page, SHOW_X, true);
    await expect.poll(() => readPendingIds(page, userId)).toBeNull();

    await withOtherDevice(browser, account, async (other) => {
      await expectChosen(other, SHOW_X, true);
      await expect(chosenBlocks(other)).toHaveCount(1);
    });
  });

  test("test-e2e-offline-sync-error-retry: si la sincronización falla el aviso sigue, y el siguiente online sincroniza (AC-24)", async ({
    page,
    context,
    browserName,
  }, testInfo) => {
    const { userId } = await signUpControlled(page, testInfo);
    await saveOffline(page, context, SHOW_X);
    await reopenOffline(page);

    const failure = await failServerActions(page, browserName);
    await context.setOffline(false);
    await expect
      .poll(failure.aborted, { message: "la sincronización no llegó a intentarse" })
      .toBeGreaterThan(0);

    // No answer: the pending selection and the notice stay for the next try, and keep staying
    // once the failed call has settled.
    await expectHeldFor(1000, async () => {
      await expect(notice(page)).toBeVisible();
      await expectChosen(page, SHOW_X, true);
      expect(await readPendingIds(page, userId)).toEqual([SHOW_X]);
    });

    await failure.lift();
    // The next time the signal comes back.
    await goOffline(page, context);
    await context.setOffline(false);

    await expect(notice(page)).toHaveCount(0);
    await expect.poll(() => readPendingIds(page, userId)).toBeNull();
    // On the server: `/` with a connection, and nothing left on the device to adopt.
    await page.goto("/");
    await expectChosen(page, SHOW_X, true);
    await expect(notice(page)).toHaveCount(0);
  });

  test("test-e2e-offline-last-write-wins: A guarda [x] sin conexión, B guarda [y] con conexión, A sincroniza y B ve [x] (AC-26)", async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const { account } = await signUpControlled(page, testInfo);
    await saveOffline(page, context, SHOW_X);

    await withOtherDevice(browser, account, async (deviceB) => {
      await showBlock(deviceB, SHOW_Y).click();
      await saveSelection(deviceB);

      // A gets the signal back: its pending selection is the last save, and replaces B's.
      await context.setOffline(false);
      await expect(notice(page)).toHaveCount(0);

      await deviceB.reload();
      await expectChosen(deviceB, SHOW_X, true);
      await expectChosen(deviceB, SHOW_Y, false);
      await expect(chosenBlocks(deviceB)).toHaveCount(1);
    });
  });

  test("test-e2e-offline-other-account-rejected: con la pendiente de A sin sincronizar, entra B y no la ve ni cambia su cuenta; al volver A se sincroniza (AC-27)", async ({
    page,
    context,
    browser,
    browserName,
  }, testInfo) => {
    const a = await signUpControlled(page, testInfo);
    await saveOffline(page, context, SHOW_X);

    // The signal comes back but the sync never reaches the server.
    const failure = await failServerActions(page, browserName);
    await context.setOffline(false);
    await expect.poll(failure.aborted).toBeGreaterThan(0);
    await expect(notice(page)).toBeVisible();

    // From here on every Server Action reaches the server again (logout is one too), so a sync
    // into B's account would land. Nothing retries the sync until the next mount or `online`.
    await failure.lift();
    // A signs out with the selection still pending on this phone.
    await tapLogout(page);
    await expect(page).toHaveURL("/login");
    expect(await readPendingIds(page, a.userId)).toEqual([SHOW_X]);

    const b = await signUpControlled(page, testInfo, [a.userId]);
    expect(b.userId).not.toBe(a.userId);

    await expect(notice(page)).toHaveCount(0);
    await expectChosen(page, SHOW_X, false);
    await expect(chosenBlocks(page)).toHaveCount(0);
    await expect(pendingBar(page)).toHaveCount(0);
    // A's pending selection is still A's, untouched.
    expect(await readPendingIds(page, a.userId)).toEqual([SHOW_X]);
    // B's account, as the server has it, did not change.
    await withOtherDevice(browser, b.account, async (other) => {
      await expect(chosenBlocks(other)).toHaveCount(0);
    });

    // A comes back on this phone: the pending selection is synced into A's account.
    await tapLogout(page);
    await expect(page).toHaveURL("/login");
    await submitLogin(page, a.account.email, a.account.password);
    await expect(page).toHaveURL("/");
    await expect.poll(() => readPendingIds(page, a.userId)).toBeNull();
    await expect(notice(page)).toHaveCount(0);
    await expectChosen(page, SHOW_X, true);

    await withOtherDevice(browser, a.account, async (other) => {
      await expectChosen(other, SHOW_X, true);
    });
  });

  for (const viewport of PHONE_WIDTHS) {
    test(`test-e2e-offline-notice-width: a ${viewport.width} px, con el aviso visible, no hay scroll horizontal (NFR-02)`, async ({
      page,
      context,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await signUpControlled(page, testInfo);

      // Both checks: the screen clips what overflows it, so a notice wider than the phone does not
      // always make the document scroll sideways; its own box has to fit the viewport too.
      const expectFits = async () => {
        const root = await page.evaluate(() => {
          const element = document.scrollingElement ?? document.documentElement;
          return { scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
        });
        expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
        const box = await notice(page).boundingBox();
        expect(box, "el aviso no tiene caja").not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      };

      // On the screen `/` rendered with a connection, right after saving offline.
      await saveOffline(page, context, SHOW_X);
      await expectFits();

      // And on the offline screen built from the device copy.
      await reopenOffline(page);
      await expect(notice(page)).toBeVisible();
      await expectFits();
    });
  }
});
