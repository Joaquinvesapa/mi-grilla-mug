import { expect, test, type Page } from "@playwright/test";

import { formAlert, signUp, submitLogin, TEST_PASSWORD, uniqueEmail } from "./auth";

const INVALID_CREDENTIALS = "Email o contraseña incorrectos";
const LOGIN_LOCKED =
  "Bloqueamos el acceso a este email por 15 minutos por demasiados intentos. Probá más tarde.";
const SESSION_DAYS = 30;
const TAPPABLE = 'a[href], button, [role="button"], summary, input, select, textarea';

function logoutButton(page: Page) {
  return page.getByRole("button", { name: "Cerrar sesión" });
}

test.describe("registro", () => {
  test("test-e2e-register-home: registrarse lleva a / con el saludo (AC-01)", async ({
    page,
  }, testInfo) => {
    const account = await signUp(page, testInfo);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(`Hola, ${account.name}`)).toBeVisible();
    await expect(logoutButton(page)).toBeVisible();
  });

  test("test-e2e-register-duplicate-rejected: el mismo email con otras mayúsculas es rechazado (AC-02)", async ({
    page,
    context,
  }, testInfo) => {
    const account = await signUp(page, testInfo);
    await context.clearCookies();

    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Otra Ana");
    await page.getByLabel("Email").fill(account.email.toUpperCase());
    await page.getByLabel("Contraseña", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(formAlert(page)).toHaveText("Ese email ya está registrado.");
    await expect(page).toHaveURL("/register");
  });

  test("test-e2e-register-invalid-rejected: una contraseña sin número muestra esa regla (AC-03)", async ({
    page,
  }, testInfo) => {
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Ana");
    await page.getByLabel("Email").fill(uniqueEmail(testInfo));
    await page.getByLabel("Contraseña", { exact: true }).fill("abcdefgh");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(
      page.getByText("La contraseña tiene que incluir al menos un número."),
    ).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page).toHaveURL("/register");
  });
});

test.describe("inicio y cierre de sesión", () => {
  test("test-e2e-login-ok: cerrar sesión y volver a entrar con email y contraseña lleva a / (AC-06)", async ({
    page,
  }, testInfo) => {
    const account = await signUp(page, testInfo);
    await logoutButton(page).click();
    await expect(page).toHaveURL("/login");

    await submitLogin(page, account.email, account.password);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(`Hola, ${account.name}`)).toBeVisible();
  });

  test("test-e2e-login-invalid-identical: un email inexistente y una contraseña incorrecta muestran el mismo texto (AC-07, NFR-04)", async ({
    page,
    context,
  }, testInfo) => {
    const account = await signUp(page, testInfo);
    await context.clearCookies();

    await page.goto("/login");
    await submitLogin(page, uniqueEmail(testInfo), TEST_PASSWORD);
    await expect(formAlert(page)).toHaveText(INVALID_CREDENTIALS);
    const unknownEmail = await formAlert(page).textContent();

    await page.goto("/login");
    await submitLogin(page, account.email, "otraClave99");
    await expect(formAlert(page)).toHaveText(INVALID_CREDENTIALS);
    const wrongPassword = await formAlert(page).textContent();

    expect(wrongPassword).toBe(unknownEmail);
    await expect(page).toHaveURL("/login");
  });

  test("test-e2e-session-persists: la sesión sigue al recargar y en otra página, con cookie httpOnly de 30 días (AC-08)", async ({
    page,
    context,
  }, testInfo) => {
    const account = await signUp(page, testInfo);
    await logoutButton(page).click();
    await expect(page).toHaveURL("/login");
    await submitLogin(page, account.email, account.password);
    await expect(page).toHaveURL("/");
    const signedInAt = Date.now() / 1000;

    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByText(`Hola, ${account.name}`)).toBeVisible();

    const other = await context.newPage();
    await other.goto("/");
    await expect(other).toHaveURL("/");
    await expect(other.getByText(`Hola, ${account.name}`)).toBeVisible();

    const session = (await context.cookies()).find((cookie) =>
      cookie.name.endsWith("session_token"),
    );
    expect(session, "no hay cookie de sesión").toBeDefined();
    expect(session!.httpOnly).toBe(true);
    const expected = signedInAt + SESSION_DAYS * 24 * 60 * 60;
    expect(Math.abs(session!.expires - expected), "expires a 30 días (±1 min)").toBeLessThanOrEqual(
      60,
    );
  });

  test('test-e2e-logout: "Cerrar sesión" lleva a /login, y ni / ni volver atrás muestran la pantalla (AC-10)', async ({
    page,
  }, testInfo) => {
    await signUp(page, testInfo);

    await logoutButton(page).click();
    await expect(page).toHaveURL("/login");

    // Back to the history entry of the protected screen (`/`, pushed by the sign-up redirect): it
    // has to end on /login without showing it again (R-17).
    await page.goBack();
    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/Hola,/)).toHaveCount(0);
    await expect(logoutButton(page)).toHaveCount(0);

    await page.goto("/");
    await expect(page).toHaveURL("/login");
    await expect(page.getByText(/Hola,/)).toHaveCount(0);
    await expect(logoutButton(page)).toHaveCount(0);
  });

  test("test-e2e-protected-unauthorized: sin sesión, o con una cookie inventada, / redirige a /login (AC-11)", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    // The proxy answers before rendering anything: a bare 307, with no HTML document. (The page's own
    // `redirect("/login")` is a 307 too, but it comes with a rendered HTML document.)
    const direct = await request.get("/", { maxRedirects: 0 });
    expect(direct.status()).toBe(307);
    expect(new URL(direct.headers()["location"] ?? "", baseURL).pathname).toBe("/login");
    expect(direct.headers()["content-type"], "el 307 sin cookie no es del proxy").toBeUndefined();
    expect(await direct.text()).not.toContain("Cerrar sesión");

    await page.goto("/");
    await expect(page).toHaveURL("/login");
    expect(await page.content()).not.toContain("Cerrar sesión");

    // A cookie with the right name gets past the proxy: the page itself verifies it, and its
    // redirect comes with a rendered document. If the cookie's name ever changes, the proxy
    // answers its bare 307 here and this fails loudly instead of the half below passing without
    // ever reaching the page.
    const forged = { name: "better-auth.session_token", value: "inventada.firma-falsa" };
    const pastProxy = await request.get("/", {
      maxRedirects: 0,
      headers: { cookie: `${forged.name}=${forged.value}` },
    });
    expect(
      pastProxy.headers()["content-type"],
      "el proxy no dejó pasar la cookie inventada",
    ).toMatch(/^text\/html/);
    expect(await pastProxy.text()).not.toContain("Cerrar sesión");
    await context.addCookies([{ ...forged, url: baseURL! }]);
    await page.goto("/");
    await expect(page).toHaveURL("/login");
    expect(await page.content()).not.toContain("Cerrar sesión");
    await expect(page.getByText(/Hola,/)).toHaveCount(0);
  });

  test("test-e2e-lockout-rejected: después de 5 contraseñas incorrectas, la correcta es rechazada con el aviso de bloqueo (AC-12)", async ({
    page,
    context,
  }, testInfo) => {
    const account = await signUp(page, testInfo);
    await context.clearCookies();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await page.goto("/login");
      await submitLogin(page, account.email, `incorrecta${attempt}`);
      await expect(formAlert(page), `intento ${attempt}`).toHaveText(INVALID_CREDENTIALS);
    }

    await page.goto("/login");
    await submitLogin(page, account.email, account.password);

    await expect(formAlert(page)).toHaveText(LOGIN_LOCKED);
    await expect(page).toHaveURL("/login");
  });
});

test.describe("pantallas de cuenta", () => {
  for (const path of ["/login", "/register"]) {
    test(`test-e2e-password-toggle: el control muestra y oculta la contraseña en ${path} (AC-14)`, async ({
      page,
    }) => {
      await page.goto(path);
      const password = page.getByLabel("Contraseña", { exact: true });
      await password.fill("secreta123");
      await expect(password).toHaveAttribute("type", "password");

      await page.getByRole("button", { name: "Mostrar contraseña" }).click();
      await expect(password).toHaveAttribute("type", "text");
      await expect(password).toHaveValue("secreta123");
      await expect(page.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await page.getByRole("button", { name: "Ocultar contraseña" }).click();
      await expect(password).toHaveAttribute("type", "password");
      await expect(password).toHaveValue("secreta123");
      // The control is type="button": nothing was submitted.
      await expect(page).toHaveURL(path);
    });
  }

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 430, height: 932 },
  ]) {
    test(`test-e2e-auth-screens-mobile: a ${viewport.width} px, /login y /register sin scroll horizontal y con tocables de 44 × 44 (NFR-03)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);

      for (const path of ["/login", "/register"]) {
        await page.goto(path);
        await expect(page.locator("form")).toBeVisible();

        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(
          scrollWidth,
          `${path}: scrollWidth ${scrollWidth} > ${innerWidth}`,
        ).toBeLessThanOrEqual(innerWidth);

        const targets = await page.locator(TAPPABLE).all();
        expect(targets.length, `${path} no tiene tocables`).toBeGreaterThan(0);
        for (const target of targets) {
          if (!(await target.isVisible())) continue;
          const box = await target.boundingBox();
          const label =
            (await target.getAttribute("aria-label")) ||
            (await target.getAttribute("name")) ||
            (await target.textContent())?.trim() ||
            (await target.evaluate((el) => el.outerHTML));
          expect(box, `${path}: "${label}" no tiene caja`).not.toBeNull();
          expect(box!.width, `${path}: ancho de "${label}"`).toBeGreaterThanOrEqual(44);
          expect(box!.height, `${path}: alto de "${label}"`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});
