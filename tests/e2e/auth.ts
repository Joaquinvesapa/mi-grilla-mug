import { expect, type Frame, type Page, type TestInfo } from "@playwright/test";

/** Meets every rule of FR-03: 8 to 128 characters, a letter and a number. */
export const TEST_PASSWORD = "festival2026";

export const TEST_NAME = "Ana";

export type TestAccount = { email: string; password: string; name: string };

/**
 * An email no other test uses: the project, the worker and the retry tell parallel runs and
 * retries apart, the time and a random part tell runs apart over a database that is never wiped.
 * So no test collides with another's account, nor locks another's email (FR-10).
 */
export function uniqueEmail(testInfo: TestInfo): string {
  const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${project}-w${testInfo.workerIndex}-r${testInfo.retry}-${Date.now()}-${random}@example.com`;
}

export type SignUpOptions = {
  /** The visible name; `TEST_NAME` by default. */
  name?: string;
  /** Where the form is opened; `/register` by default (`/register?next=…` comes back elsewhere). */
  from?: string;
  /** The path the sign-up has to land on; `/` by default. */
  expectedPath?: string;
};

/**
 * Fills and sends the sign-up form, then waits for the expected path (`/` unless told otherwise).
 * Leaves the page signed in. Takes a frame too: /demo signs up inside its iPhone frame.
 */
export async function signUp(
  target: Page | Frame,
  testInfo: TestInfo,
  { name = TEST_NAME, from = "/register", expectedPath = "/" }: SignUpOptions = {},
): Promise<TestAccount> {
  const account = { email: uniqueEmail(testInfo), password: TEST_PASSWORD, name };
  await target.goto(from);
  await target.getByLabel("Nombre").fill(account.name);
  await target.getByLabel("Email").fill(account.email);
  await target.getByLabel("Contraseña", { exact: true }).fill(account.password);
  await target.getByRole("button", { name: "Crear cuenta" }).click();
  await expect
    .poll(() => new URL(target.url()).pathname, {
      message: `el registro no terminó en ${expectedPath}`,
    })
    .toBe(expectedPath);
  return account;
}

/** Fills and sends the sign-in form on `/login`. Where it lands is the caller's to check. */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/**
 * The form's general message. Next also renders an empty `role="alert"` (its route announcer), so
 * the alert is looked for inside the form.
 */
export function formAlert(page: Page) {
  return page.locator("form").getByRole("alert");
}
