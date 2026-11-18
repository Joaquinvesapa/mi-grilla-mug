import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import {
  expect,
  test,
  type Frame,
  type FrameLocator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { CLOSE_LABEL, LIVE_LABEL } from "@/lib/live-messages";

import { signUp } from "./auth";
import { gridRegion, openMenu, showBlock, showById } from "./grid";

// Runs only in the `desktop` project (1280×800): /demo is the desktop showcase (playwright.config).

function appFrame(page: Page) {
  return page.frameLocator('iframe[title="Mi Grilla"]');
}

// The simulated clock of /demo (FEAT-005b). Only the page's control sets it: the browser's and the
// server's time stay real, so the server opens the grid on the first day (the festival is over)
// and anything else the app shows comes from the clock. By stable id, never by artist.
const TYLER = showById("fri-flow-2215");
const PEGGY = showById("fri-samsung-2330");
const SABRINA = showById("sun-flow-2200");
const MARINA = showById("sat-flow-1800");
/** NFR-01: from the change in the control to the app showing it. */
const CLOCK_BUDGET_MS = 2000;

/** The clock control, beside the phone (a `section` named by its title). */
function clockControl(page: Page) {
  return page.getByRole("region", { name: "Reloj de la demo" });
}

/** Opens /demo and signs up a new account inside its iPhone; returns the app's frame. */
async function signUpInDemo(page: Page, testInfo: TestInfo): Promise<Frame> {
  await page.goto("/demo");
  const iframe = page.locator('iframe[title="Mi Grilla"]');
  const appWindow = await (await iframe.elementHandle()).contentFrame();
  expect(appWindow, "no se encontró el frame de la app").not.toBeNull();
  await signUp(appWindow!, testInfo);
  await expect(gridRegion(appFrame(page))).toBeVisible();
  return appWindow!;
}

/** Opens "En vivo" inside the iPhone and returns the panel. */
async function openLiveInApp(app: FrameLocator) {
  await app.getByRole("button", { name: LIVE_LABEL, exact: true }).click();
  const panel = app.getByRole("dialog", { name: LIVE_LABEL });
  await expect(panel).toBeVisible();
  return panel;
}

test.describe("/demo con marco de iPhone", () => {
  test("se ve el marco con la app adentro, entero y sin scroll de página (AC-06, NFR-02)", async ({
    page,
  }) => {
    await page.goto("/demo");

    const frame = page.getByTestId("iphone-frame");
    await expect(frame).toBeVisible();
    const iframe = page.locator('iframe[title="Mi Grilla"]');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute("src", "/");
    // Without a session, `/` sends the frame to /login: the brand and the install guide live there.
    const app = appFrame(page);
    await expect(app.getByRole("heading", { level: 1, name: "Mi Grilla" })).toBeVisible();
    await expect(app.getByRole("button", { name: "Cómo instalarla" })).toBeVisible();
    const appWindow = await (await iframe.elementHandle()).contentFrame();
    expect(appWindow, "no se encontró el frame de la app").not.toBeNull();
    expect(new URL(appWindow!.url()).pathname).toBe("/login");

    const metrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    }));
    expect(metrics.innerWidth).toBe(1280);
    expect(metrics.innerHeight).toBe(800);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);

    // The whole phone, bezel included, inside the viewport.
    await expect(async () => {
      const box = await frame.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(metrics.innerWidth);
      expect(box!.y + box!.height).toBeLessThanOrEqual(metrics.innerHeight);
      // Scaled down to fit 800 px, but still the size of a phone, not a thumbnail.
      expect(box!.height).toBeGreaterThan(600);
    }).toPass();
  });

  // `/` is the grid now (FEAT-003a): the document never scrolls, the grid does, on its own. So the
  // wheel has to move the grid's scroll container inside the frame. The precondition (the grid is
  // taller than its box) is asserted, so a shorter grid fails as that and not as a /demo bug. `/`
  // needs a session: the test signs up inside the frame first.
  test("la app del marco responde a clicks y al scroll con la rueda (AC-07)", async ({
    page,
  }, testInfo) => {
    await page.goto("/demo");
    const app = appFrame(page);
    const iframe = page.locator('iframe[title="Mi Grilla"]');
    const appWindow = await (await iframe.elementHandle()).contentFrame();
    expect(appWindow, "no se encontró el frame de la app").not.toBeNull();
    await signUp(appWindow!, testInfo);

    // Clicks: the menu opens with the greeting, and the install guide unfolds inside it.
    const sheet = await openMenu(app);
    await expect(sheet.getByText(/^Hola, /)).toBeVisible();
    const trigger = sheet.getByRole("button", { name: "Cómo instalarla" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(sheet.getByRole("listitem")).toHaveCount(3);
    await page.keyboard.press("Escape");
    await expect(app.getByRole("dialog")).toHaveCount(0);

    // A click on a show marks it.
    const block = showBlock(app, "fri-flow-1800");
    await block.click();
    await expect(block).toHaveAttribute("aria-pressed", "true");

    const grid = gridRegion(app, "fri");
    await expect(grid).toBeVisible();
    const fit = await grid.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(
      fit.scrollHeight,
      "precondición: la grilla tiene que ser más alta que su caja para poder scrollear",
    ).toBeGreaterThan(fit.clientHeight);
    // Clicking the block scrolled it into view: start the wheel from the top.
    await grid.evaluate((el) => el.scrollTo({ top: 0 }));
    expect(await grid.evaluate((el) => el.scrollTop)).toBe(0);

    const box = await grid.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 400);

    await expect.poll(() => grid.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    // Neither the app's document nor the page around the phone moves.
    expect(await appWindow!.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("reloj de /demo (FEAT-005b)", () => {
  test("demo: domingo 23:00 muestra a Sabrina Carpenter en Flow en ≤ 2 s (AC-16)", async ({
    page,
  }, testInfo) => {
    await signUpInDemo(page, testInfo);
    const app = appFrame(page);
    const control = clockControl(page);

    // Friday 23:00 first: Tyler still plays on Flow, so what changes below is only the day.
    await control.getByLabel("Hora").fill("23:00");
    await expect(control.locator("output")).toContainText("23:00");
    const panel = await openLiveInApp(app);
    const flowNow = panel.locator('[data-live-stage="flow"] [data-live-now]');
    await expect(flowNow).toContainText(TYLER.artist);

    const changedAt = Date.now();
    await control.getByRole("tab", { name: "Domingo", exact: true }).click();
    await expect(flowNow).toContainText(SABRINA.artist);
    const elapsed = Date.now() - changedAt;

    await expect(control.locator("output")).toContainText("23:00");
    await expect(control.locator("output")).toContainText(/domingo 15 de marzo/i);
    expect(elapsed, `la app tardó ${elapsed} ms en mostrar el cambio`).toBeLessThanOrEqual(
      CLOCK_BUDGET_MS,
    );
  });

  test("demo: +15 min pasa de 22:30 a 22:45 y la app la usa (AC-17)", async ({
    page,
  }, testInfo) => {
    await signUpInDemo(page, testInfo);
    const app = appFrame(page);
    const control = clockControl(page);

    const panel = await openLiveInApp(app);
    const samsungNext = panel.locator('[data-live-stage="samsung"] [data-live-next]');
    // 22:30: Peggy Gou starts on Samsung at 23:30, in 60 min.
    await expect(samsungNext).toContainText(`${PEGGY.artist} 23:30 (en 60 min)`);

    await control.getByRole("button", { name: "+15 min" }).click();

    await expect(control.locator("output")).toContainText("22:45");
    await expect(control.getByLabel("Hora")).toHaveValue("22:45");
    // The app takes the new time, without a reload: 45 min to go.
    await expect(samsungNext).toContainText(`${PEGGY.artist} 23:30 (en 45 min)`);
  });

  test("demo: sábado 18:00 y la grilla abre en sábado (AC-18)", async ({ page }, testInfo) => {
    await signUpInDemo(page, testInfo);
    const app = appFrame(page);
    const control = clockControl(page);
    // Friday 22:30 when the grid opened.
    await expect(gridRegion(app, "fri")).toBeVisible();

    await control.getByRole("tab", { name: "Sábado", exact: true }).click();
    await control.getByLabel("Hora").fill("18:00");
    await expect(control.locator("output")).toContainText("18:00");
    await expect(control.locator("output")).toContainText(/sábado 14 de marzo/i);
    // The app already lives at Saturday 18:00 (Marina on Flow), so the check below cannot pass
    // just because the message had not arrived yet.
    const panel = await openLiveInApp(app);
    await expect(panel.locator('[data-live-stage="flow"] [data-live-now]')).toContainText(
      `${MARINA.artist} ${MARINA.start} – ${MARINA.end}`,
    );
    await panel.getByRole("button", { name: CLOSE_LABEL, exact: true }).click();
    await expect(app.getByRole("dialog", { name: LIVE_LABEL })).toHaveCount(0);
    // The grid already open keeps its tab: the clock sets the initial day only.
    await expect(gridRegion(app, "fri")).toBeVisible();
    await expect(app.getByRole("tab", { name: "Viernes", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Reloading the iframe opens the grid again, now on the clock's day.
    const iframe = page.locator('iframe[title="Mi Grilla"]');
    await iframe.evaluate((element: HTMLIFrameElement) => {
      element.contentWindow?.location.reload();
    });
    await expect(gridRegion(app, "sat")).toBeVisible();
    await expect(app.getByRole("tab", { name: "Sábado", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("demo: el reloj arranca el viernes 13 de marzo de 2026 a las 22:30 (AC-19)", async ({
    page,
  }, testInfo) => {
    await signUpInDemo(page, testInfo);
    const app = appFrame(page);
    const control = clockControl(page);

    await expect(control.locator("output")).toContainText("22:30");
    await expect(control.locator("output")).toContainText(/viernes 13 de marzo/i);
    await expect(control.getByLabel("Hora")).toHaveValue("22:30");
    await expect(control.getByRole("tab", { name: "Viernes", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // The app lives at that instant of 2026: the grid on Friday and Tyler on Flow, 22:15 – 23:30.
    await expect(gridRegion(app, "fri")).toBeVisible();
    const panel = await openLiveInApp(app);
    await expect(panel.locator('[data-live-stage="flow"] [data-live-now]')).toContainText(
      `${TYLER.artist} 22:15 – 23:30`,
    );
  });
});

test.describe("clickjacking (R-08)", () => {
  test("/, /login, /register y /demo responden con X-Frame-Options SAMEORIGIN y frame-ancestors 'self'", async ({
    request,
  }) => {
    // Without a session `/` ends on /login: the headers checked are the page's that is shown.
    for (const path of ["/", "/login", "/register", "/demo"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["x-frame-options"], path).toBe("SAMEORIGIN");
      expect(headers["content-security-policy"], path).toMatch(/frame-ancestors 'self'/);
    }
  });

  test.describe("embebida desde otro origen", () => {
    let server: Server | undefined;
    let foreignOrigin: string;

    test.beforeAll(async ({ baseURL }) => {
      const foreign = createServer((req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        if (req.url === "/control") {
          res.end("<!doctype html><title>control</title><p>control listo</p>");
          return;
        }
        res.end(
          `<!doctype html><title>sitio ajeno</title>
          <iframe id="control" src="/control"></iframe>
          <iframe id="app" src="${baseURL}/"></iframe>`,
        );
      });
      server = foreign;
      await new Promise<void>((resolve) => foreign.listen(0, "127.0.0.1", resolve));
      foreignOrigin = `http://127.0.0.1:${(foreign.address() as AddressInfo).port}`;
    });

    test.afterAll(async () => {
      // beforeAll may have failed before creating it.
      const foreign = server;
      if (!foreign) return;
      await new Promise((resolve) => foreign.close(resolve));
    });

    test("otro origen (otro puerto) no puede mostrar la app en un iframe", async ({
      page,
      baseURL,
    }) => {
      expect(new URL(foreignOrigin).origin).not.toBe(new URL(baseURL!).origin);

      // `load` waits for both frames, the refused one included.
      await page.goto(foreignOrigin, { waitUntil: "load" });

      // Control: a frameable page in the same setup does render, so the check below is not vacuous.
      await expect(page.frameLocator("#control").getByText("control listo")).toBeVisible();

      const app = await (await page.locator("#app").elementHandle()).contentFrame();
      expect(app, "el iframe no tiene frame").not.toBeNull();
      await expect(app!.getByRole("heading", { level: 1, name: "Mi Grilla" })).toHaveCount(0);
      expect(await app!.evaluate(() => document.title)).not.toBe("Mi Grilla");
    });
  });
});
