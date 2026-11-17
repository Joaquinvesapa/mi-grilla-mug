import { expect, test, type APIResponse, type Page } from "@playwright/test";

const BASE_RGB = "rgb(25, 23, 36)";
const SW_URL = "/serwist/sw.js";
// A URL other than / for the navigation that fails offline: it has to survive the retry.
const FAILED_URL = "/?desde=sin-conexion";
const TAPPABLE = 'a[href], button, [role="button"], summary, input, select, textarea';

/** Width and height of a PNG, read from its IHDR chunk. */
function pngSize(body: Buffer): { width: number; height: number } {
  expect(body.subarray(1, 4).toString("ascii"), "no es un PNG").toBe("PNG");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

async function expectPng(response: APIResponse, side: number) {
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(pngSize(await response.body())).toEqual({ width: side, height: side });
}

/** Opens `/` and waits until the service worker is active and controls the page. */
async function openControlledHome(page: Page): Promise<ServiceWorkerRegistrationInfo> {
  await page.goto("/");
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? "sin service worker activo";
        }),
      { message: "el service worker no llegó a activarse", timeout: 20_000 },
    )
    .toBe("activated");
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), {
      message: "la página no quedó controlada por el service worker",
      timeout: 10_000,
    })
    .toMatch(/\/serwist\/sw\.js$/);
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      scope: registration?.scope ?? "",
      scriptURL: registration?.active?.scriptURL ?? "",
    };
  });
}

type ServiceWorkerRegistrationInfo = { scope: string; scriptURL: string };

async function readCachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(request.url);
    }
    return urls;
  });
}

// Runs in every mobile project, WebKit included: Playwright's WebKit registers the worker and its
// setOffline reaches the worker's fetches, as Chromium's does.
test.describe("service worker (FR-02, FR-03)", () => {
  test("se registra con alcance / y controla la página", async ({ page, baseURL }) => {
    const registration = await openControlledHome(page);

    expect(registration.scope).toBe(`${baseURL}/`);
    expect(registration.scriptURL).toBe(`${baseURL}${SW_URL}`);
  });

  test('sin conexión, navegar a / muestra "Sin conexión" con los estilos y la fuente (AC-03)', async ({
    page,
    context,
  }) => {
    await openControlledHome(page);

    await context.setOffline(true);
    // Without the worker this throws net::ERR_INTERNET_DISCONNECTED. Playwright does not report a
    // response for a navigation the worker answered, so the check is on what the page shows.
    await page.goto("/");

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      BASE_RGB,
    );
    const publicSans = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts)
        .filter((face) => /Public Sans/.test(face.family) && !/Fallback/.test(face.family))
        .map((face) => face.status);
    });
    expect(publicSans, "Public Sans no se cargó sin conexión").toContain("loaded");

    // The look above could also come from the HTTP cache: the precache itself has to hold the
    // screen, its CSS and its font.
    const cachedPaths = (await readCachedUrls(page)).map((url) => new URL(url).pathname);
    expect(cachedPaths, "/~offline no está en el precache").toContain("/~offline");
    expect(
      cachedPaths.filter((path) => path.endsWith(".css")),
      "no hay CSS en el precache",
    ).not.toEqual([]);
    expect(
      cachedPaths.filter((path) => path.endsWith(".woff2")),
      "no hay fuentes .woff2 en el precache",
    ).not.toEqual([]);
  });

  test('al volver la señal, "Sin conexión" recarga sola la URL que falló', async ({
    page,
    context,
  }) => {
    await openControlledHome(page);
    await context.setOffline(true);
    await page.goto(FAILED_URL);
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeVisible();

    await context.setOffline(false);

    await expect(page.getByRole("heading", { level: 1, name: "Mi Grilla" })).toBeVisible();
    await expect(page).toHaveURL(FAILED_URL);
  });

  test('"Reintentar" recarga la URL que falló, no la manda a /', async ({ page, context }) => {
    await openControlledHome(page);
    // Swallow the `online` event, so that the reload under test is the button's and not the
    // automatic one. Installed before the page's own scripts, so it is the first listener to run.
    await page.addInitScript(() =>
      window.addEventListener("online", (event) => event.stopImmediatePropagation(), {
        capture: true,
      }),
    );
    await context.setOffline(true);
    await page.goto(FAILED_URL);
    await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeVisible();
    const retry = page.getByRole("button", { name: "Reintentar" });
    // The click needs React's handler: wait until hydration has attached it to the button.
    await expect
      .poll(() => retry.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__react"))))
      .toBe(true);
    // Mark this document, to tell whether it goes away before the click.
    await page.evaluate(() => Object.assign(window, { __offlineScreen: true }));
    await context.setOffline(false);
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => "__offlineScreen" in window),
      "la pantalla se recargó sola antes del clic",
    ).toBe(true);

    await retry.click();

    await expect(page.getByRole("heading", { level: 1, name: "Mi Grilla" })).toBeVisible();
    await expect(page).toHaveURL(FAILED_URL);
  });

  test("fuera de la pantalla sin conexión, volver la señal no recarga la página", async ({
    page,
    context,
  }) => {
    await openControlledHome(page);
    // A marker that only lives as long as this document, and a count of `online` events.
    await page.evaluate(() => {
      const probe = { online: 0 };
      Object.assign(window, { __probe: probe });
      window.addEventListener("online", () => (probe.online += 1));
    });

    await context.setOffline(true);
    await context.setOffline(false);
    // Proving an absence: give a reload the time it would need to happen.
    await page.waitForTimeout(1500);

    // Still the same document: unsaved changes (PRD 02) would live in it.
    const probe = await page.evaluate(
      () => (window as unknown as { __probe?: { online: number } }).__probe ?? null,
    );
    expect(probe, "la página se recargó al volver la señal").not.toBeNull();
    // Guard: the browser did announce the signal coming back, so the check above means something.
    expect(probe!.online, "el navegador no avisó que volvió la señal").toBe(1);
  });

  test("sin conexión, GET /api/health falla por red y nada de /api/ ni de otro origen queda en caché (R-06)", async ({
    page,
    context,
    baseURL,
  }) => {
    await openControlledHome(page);
    // Online first: whatever /api/health answers, the service worker must not keep a copy of it.
    await page.evaluate(() => fetch("/api/health").catch(() => undefined));

    await context.setOffline(true);
    const outcome = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/health");
        return `respuesta ${response.status}`;
      } catch {
        return "error de red";
      }
    });

    expect(outcome).toBe("error de red");
    const cached = await readCachedUrls(page);
    expect(cached.length, "el precache está vacío").toBeGreaterThan(0);
    expect(cached.filter((url) => new URL(url).pathname.startsWith("/api/"))).toEqual([]);
    expect(cached.filter((url) => new URL(url).origin !== baseURL)).toEqual([]);
  });
});

test.describe("rutas de la PWA", () => {
  test("sirve el service worker con Service-Worker-Allowed: / y /~offline en el precache", async ({
    request,
  }) => {
    const response = await request.get(SW_URL);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^application\/javascript/);
    expect(response.headers()["service-worker-allowed"]).toBe("/");
    expect(await response.text()).toContain("/~offline");
  });

  test("GET /serwist/no-existe.js devuelve 404", async ({ request }) => {
    // Guard: the route exists, so the 404 below is its own answer and not a missing route.
    expect((await request.get(SW_URL)).status()).toBe(200);

    expect((await request.get("/serwist/no-existe.js")).status()).toBe(404);
  });

  test("sirve los íconos del manifest como PNG de 192 y 512 px", async ({ request }) => {
    await expectPng(await request.get("/icons/192"), 192);
    await expectPng(await request.get("/icons/512"), 512);
  });

  for (const size of ["100", "1920", "abc"]) {
    test(`GET /icons/${size} devuelve 404`, async ({ request }) => {
      // Guard: the route exists, so the 404 below is its own answer and not a missing route.
      expect((await request.get("/icons/192")).status()).toBe(200);

      expect((await request.get(`/icons/${size}`)).status()).toBe(404);
    });
  }

  test("el head declara el manifest y la app de pantalla de inicio de iPhone (AC-02)", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    const manifestLinks = page.locator('link[rel="manifest"]');
    await expect(manifestLinks).toHaveCount(1);
    const manifestUrl = await manifestLinks.getAttribute("href");
    const manifest = await (await request.get(manifestUrl ?? "")).json();
    expect(manifest).toMatchObject({ name: "Mi Grilla", display: "standalone", start_url: "/" });

    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
      "content",
      "Mi Grilla",
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute("content", "black-translucent");
    const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    await expectPng(await request.get(appleIcon ?? ""), 180);
  });
});

test.describe('pantalla "Sin conexión" (NFR-01)', () => {
  for (const viewport of [
    { width: 360, height: 780 },
    { width: 430, height: 932 },
  ]) {
    test(`a ${viewport.width} px: sin scroll horizontal y objetivos táctiles de 44 × 44`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/~offline");

      await expect(page.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeVisible();
      const html = await page.evaluate(() => document.documentElement.outerHTML);
      expect(html).not.toMatch(/lollapalooza/i);

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

      const targets = page.locator(TAPPABLE);
      expect(await targets.count(), "la pantalla no ofrece cómo reintentar").toBeGreaterThan(0);
      for (const target of await targets.all()) {
        const box = await target.boundingBox();
        expect(box, `"${await target.textContent()}" no tiene caja`).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});
