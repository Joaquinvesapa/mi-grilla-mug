import { expect, test, type Locator, type Page } from "@playwright/test";

import { signUp } from "./auth";
import { declaresInShippedCss, readCssRules, readShippedCss } from "./css";
import { gridRegion, openMenu } from "./grid";

// The FEAT-001 "Muy pronto" cards are gone: `/` is the grid now (FEAT-003a). Their titles must not
// come back.
const OLD_SECTIONS = [
  "Armá tu grilla",
  "Llevala en la pantalla de bloqueo",
  "Coincidí con tu grupo",
];
const STEPS = [/Safari/, /Compartir/, /Agregar a pantalla de inicio/];
// Outside the grid: the show blocks have their own size checks (AC-28 of FEAT-003a, grid.spec.ts).
const TAPPABLE = ["a[href]", "button", '[role="button"]', "summary", "input", "select", "textarea"]
  .map((selector) => `${selector}:not([data-show-id])`)
  .join(", ");
/**
 * Vaul injects its own stylesheet, with `[data-vaul-handle]:hover` outside any media query. The app
 * never renders Vaul's handle (the drawer draws its own bar), so that rule matches nothing and cannot
 * leave a hover stuck; the test checks that it still matches nothing.
 */
const THIRD_PARTY_HOVER = ["[data-vaul-handle]"];

/** "Cómo instalarla" lives in the menu sheet (FEAT-003a): open it first. */
async function installTrigger(page: Page): Promise<Locator> {
  const sheet = await openMenu(page);
  return sheet.getByRole("button", { name: "Cómo instalarla" });
}

async function expectTapTargetsAtLeast44(page: Page) {
  for (const target of await page.locator(TAPPABLE).all()) {
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    const label =
      (await target.textContent())?.trim() ?? (await target.evaluate((el) => el.outerHTML));
    expect(box, `"${label}" no tiene caja`).not.toBeNull();
    expect(box!.width, `ancho de "${label}"`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `alto de "${label}"`).toBeGreaterThanOrEqual(44);
  }
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(
    innerWidth,
  );
}

// `/` needs a session (FR-09): every test here starts signed in, with an account of its own.
test.beforeEach(async ({ page }, testInfo) => {
  await signUp(page, testInfo);
});

test.describe("pantalla de inicio", () => {
  test("muestra Mi Grilla en la barra y en ningún lado nombra a Lollapalooza (AC-01, AC-13)", async ({
    page,
  }) => {
    await page.goto("/");

    const shell = page.locator(".app-shell");
    // The top bar of the grid screen.
    await expect(
      shell.locator("header").getByRole("heading", { level: 1, name: "Mi Grilla" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Mi Grilla");
    await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");

    const html = await page.evaluate(() => document.documentElement.outerHTML);
    expect(html).not.toMatch(/lollapalooza/i);
    expect(await page.title()).not.toMatch(/lollapalooza/i);
    // Nor in the menu, which only renders once it is open.
    await openMenu(page);
    const withMenu = await page.evaluate(() => document.documentElement.outerHTML);
    expect(withMenu).toContain("Cómo instalarla");
    expect(withMenu).not.toMatch(/lollapalooza/i);
  });

  test('es la grilla: sin las tarjetas "Muy pronto", el documento no scrollea y la grilla sí', async ({
    page,
  }) => {
    await page.goto("/");
    const grid = gridRegion(page);
    await expect(grid).toBeVisible();

    for (const name of OLD_SECTIONS) {
      await expect(page.getByRole("region", { name })).toHaveCount(0);
    }
    await expect(page.getByText("Muy pronto")).toHaveCount(0);

    // mobile-native fix 3: the screen is exactly the visible height; what scrolls is the grid.
    const { scrollHeight, innerHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
    const inner = await grid.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(inner.scrollHeight).toBeGreaterThan(inner.clientHeight);
  });

  test("la guía de instalación, en el menú, despliega los 3 pasos de iPhone", async ({ page }) => {
    await page.goto("/");
    const trigger = await installTrigger(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();

    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const steps = page.getByRole("listitem");
    await expect(steps).toHaveCount(3);
    for (const [index, step] of STEPS.entries()) {
      await expect(steps.nth(index)).toContainText(step);
    }
  });

  test("usa Public Sans y theme-color #191724", async ({ page }) => {
    await page.goto("/");

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily).toMatch(/Public Sans/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#191724");
  });
});

test.describe("sin scroll horizontal y objetivos táctiles de 44 × 44 (AC-15, NFR-01)", () => {
  for (const viewport of [
    { width: 360, height: 780 },
    { width: 430, height: 932 },
  ]) {
    test(`a ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      await expectNoHorizontalScroll(page);
      await expectTapTargetsAtLeast44(page);

      await (await installTrigger(page)).click();
      await expect(page.getByRole("listitem")).toHaveCount(3);

      await expectNoHorizontalScroll(page);
      await expectTapTargetsAtLeast44(page);
    });
  }
});

test.describe("shell nativo", () => {
  test("viewport-fit=cover y padding con env(safe-area-inset-*) en .app-shell (AC-16)", async ({
    page,
  }) => {
    await page.goto("/");

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("initial-scale=1");
    expect(viewport).toContain("viewport-fit=cover");
    expect(viewport).not.toMatch(/maximum-scale|user-scalable/);

    await expect(page.locator(".app-shell")).toHaveCount(1);
    const shell = (await readCssRules(page)).filter((rule) => rule.selector === ".app-shell");
    expect(shell.length, "no hay una regla .app-shell en el CSSOM").toBeGreaterThan(0);
    for (const side of ["top", "right", "bottom", "left"]) {
      const value = shell.map((rule) => rule.declarations[`padding-${side}`] ?? "").join(" ");
      expect(value, `padding-${side} de .app-shell`).toContain(`env(safe-area-inset-${side}`);
    }
  });

  test(".app-shell usa 100dvh y ninguna regla usa 100vh (AC-17)", async ({ page }) => {
    await page.goto("/");

    const rules = await readCssRules(page);
    const shell = rules.filter((rule) => rule.selector === ".app-shell");
    expect(shell.map((rule) => rule.declarations["min-height"])).toContain("100dvh");

    const withVh = rules.filter((rule) => /\b100vh\b/.test(rule.cssText));
    expect(withVh.map((rule) => rule.cssText)).toEqual([]);
  });

  test("los :hover viven solo dentro de @media (hover: hover) and (pointer: fine)", async ({
    page,
  }) => {
    await page.goto("/");

    // With the menu open, so the drawer's own rules are on the page too.
    await openMenu(page);
    const hoverRules = (await readCssRules(page)).filter((rule) =>
      rule.selector.includes(":hover"),
    );
    for (const selector of THIRD_PARTY_HOVER) {
      await expect(page.locator(selector), `${selector} no debería existir`).toHaveCount(0);
    }
    expect(hoverRules.length, "la página no tiene ningún :hover que revisar").toBeGreaterThan(0);

    const ungated = hoverRules.filter(
      (rule) =>
        !THIRD_PARTY_HOVER.some((selector) => rule.selector.startsWith(selector)) &&
        !rule.conditions.some(
          (condition) => /hover:\s*hover/.test(condition) && /pointer:\s*fine/.test(condition),
        ),
    );
    expect(ungated.map((rule) => rule.cssText)).toEqual([]);
  });

  test("sin destello gris al tocar (AC-18)", async ({ page }) => {
    await page.goto("/");
    const trigger = await installTrigger(page);

    const computed = await trigger.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("-webkit-tap-highlight-color").trim(),
    );
    if (computed !== "") {
      test.info().annotations.push({ type: "AC-18", description: `getComputedStyle: ${computed}` });
      expect(computed).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
      return;
    }

    // This engine does not expose the property in getComputedStyle: check the rule instead.
    const html = (await readCssRules(page)).filter((rule) => rule.selector === "html");
    const declared = html.map((rule) => rule.declarations["-webkit-tap-highlight-color"] ?? "");
    if (declared.some((value) => value !== "")) {
      test.info().annotations.push({ type: "AC-18", description: "regla html en el CSSOM" });
      expect(declared).toContain("transparent");
      return;
    }
    test.info().annotations.push({ type: "AC-18", description: "regla html en el CSS servido" });
    expect(
      declaresInShippedCss(
        await readShippedCss(page),
        "html",
        /-webkit-tap-highlight-color:\s*transparent/,
      ),
    ).toBe(true);
  });

  test("mantener apretado el botón no selecciona texto ni abre el menú (AC-19)", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = await installTrigger(page);

    const style = await trigger.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        userSelect:
          computed.getPropertyValue("user-select") ||
          computed.getPropertyValue("-webkit-user-select"),
        touchCallout: computed.getPropertyValue("-webkit-touch-callout").trim(),
      };
    });
    expect(style.userSelect).toBe("none");

    if (style.touchCallout !== "") {
      test.info().annotations.push({ type: "AC-19", description: "getComputedStyle" });
      expect(style.touchCallout).toBe("none");
      return;
    }
    // -webkit-touch-callout only exists in iOS WebKit: outside it the CSSOM drops it.
    test.info().annotations.push({ type: "AC-19", description: "regla button en el CSS servido" });
    expect(
      declaresInShippedCss(await readShippedCss(page), "button", /-webkit-touch-callout:\s*none/),
    ).toBe(true);
  });

  test("el botón responde en pointerdown en ≤ 100 ms y sin espera de doble toque (AC-20, NFR-07)", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = await installTrigger(page);
    await trigger.scrollIntoViewIfNeeded();

    expect(await trigger.evaluate((el) => getComputedStyle(el).touchAction)).toBe("manipulation");

    const idle = await trigger.evaluate((el) => {
      const computed = getComputedStyle(el);
      return `${computed.backgroundColor} ${computed.transform} ${computed.opacity}`;
    });
    await trigger.evaluate((el) => {
      const probe = { downAt: -1, pressedAt: -1 };
      Object.assign(window, { __pressProbe: probe });
      window.addEventListener(
        "pointerdown",
        (event) => {
          if (probe.downAt < 0) probe.downAt = event.timeStamp;
        },
        { capture: true },
      );
      new MutationObserver(() => {
        if (probe.pressedAt < 0 && el.getAttribute("data-pressed") === "true") {
          probe.pressedAt = performance.now();
        }
      }).observe(el, { attributes: true, attributeFilter: ["data-pressed"] });
    });

    const box = await trigger.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();

    await expect(trigger).toHaveAttribute("data-pressed", "true");
    const probe = await page.evaluate(
      () =>
        (window as unknown as { __pressProbe: { downAt: number; pressedAt: number } }).__pressProbe,
    );
    // While the finger is still down, the pressed state has to show up as a visual change.
    await expect
      .poll(
        () =>
          trigger.evaluate((el) => {
            const computed = getComputedStyle(el);
            return `${computed.backgroundColor} ${computed.transform} ${computed.opacity}`;
          }),
        { message: "el estado presionado no cambia el estilo del botón", timeout: 1000 },
      )
      .not.toBe(idle);
    await page.mouse.up();

    expect(probe.downAt).toBeGreaterThanOrEqual(0);
    expect(probe.pressedAt).toBeGreaterThanOrEqual(0);
    const latency = probe.pressedAt - probe.downAt;
    test.info().annotations.push({ type: "NFR-07", description: `${latency.toFixed(1)} ms` });
    expect(latency).toBeLessThanOrEqual(100);
  });
});
