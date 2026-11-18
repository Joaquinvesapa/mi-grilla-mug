import { expect, type BrowserContext, type Page } from "@playwright/test";

import { signUp, type TestAccount } from "./auth";
import { saveSelection, showBlock } from "./grid";
import { waitForServiceWorker } from "./pwa";

// The steps the E2E specs share to work without a connection (FEAT-003b, FEAT-004): signing up on
// a page the service worker controls, cutting the signal, saving on the device and opening `/`
// again from the device copy. The connection is cut with `context.setOffline`, never with
// `page.route`: Playwright's WebKit does not route the requests of a page controlled by a service
// worker, Server Actions included.

const NOTICE_TITLE = "Guardado solo en este celular";
const SNAPSHOT_KEY = "mi-grilla:snapshot";
const PENDING_PREFIX = "mi-grilla:pending:";

/** The notice of a selection saved only on this device (FR-04 of FEAT-003b). */
export function notice(page: Page) {
  return page.getByRole("status").filter({ hasText: NOTICE_TITLE });
}

export async function expectChosen(page: Page, showId: string, chosen: boolean) {
  await expect(showBlock(page, showId)).toHaveAttribute("aria-pressed", String(chosen));
}

/** The fields of the device copy the specs read; `groups` only once `/` stored them (ADR-008). */
type DeviceCopy = {
  userId: string;
  userName: string;
  savedShowIds: string[];
  groups?: { id: string; name: string }[];
};

/** The device copy as stored, or `null`. */
export async function readDeviceCopy(page: Page): Promise<DeviceCopy | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DeviceCopy) : null;
  }, SNAPSHOT_KEY);
}

/** The pending selection stored for `userId`, or `null`. */
export async function readPendingIds(page: Page, userId: string): Promise<string[] | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { showIds: string[] }).showIds : null;
  }, `${PENDING_PREFIX}${userId}`);
}

/**
 * Signs up on a page controlled by the service worker and waits until `/` has written the device
 * copy of the new account (FR-01). Returns the account and its user id, read from the copy.
 *
 * Every test account is called "Ana", so the copy is told apart by its user id: the ui has no other
 * place that shows it. The new id is unknown until `/` writes it, so the copy counts as the new
 * account's once it holds an id that is not any of `previousUserIds` (the accounts this page
 * already used) nor the one of the copy stored before signing up.
 */
export async function signUpControlled(
  page: Page,
  testInfo: Parameters<typeof signUp>[1],
  previousUserIds: readonly string[] = [],
): Promise<{ account: TestAccount; userId: string }> {
  await page.goto("/login");
  await waitForServiceWorker(page);
  const before = await readDeviceCopy(page);
  const known = new Set([...previousUserIds, ...(before ? [before.userId] : [])]);
  const account = await signUp(page, testInfo);
  await expect(page.getByRole("tab", { name: "Viernes", exact: true })).toBeVisible();
  await expect
    .poll(
      async () => {
        const userId = (await readDeviceCopy(page))?.userId ?? null;
        return userId !== null && !known.has(userId);
      },
      { message: "la pantalla no guardó la copia del dispositivo de la cuenta nueva" },
    )
    .toBe(true);
  const copy = await readDeviceCopy(page);
  expect(copy, "la copia del dispositivo desapareció después de escribirse").not.toBeNull();
  expect(copy!.userName).toBe(account.name);
  return { account, userId: copy!.userId };
}

/**
 * Cuts the connection and waits until the page itself sees it (`navigator.onLine` false), so that a
 * `setOffline(false)` right after is a real change the page announces with `online`.
 */
export async function goOffline(page: Page, context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  await expect
    .poll(() => page.evaluate(() => navigator.onLine), {
      message: "la página no se enteró de que se cortó la conexión",
    })
    .toBe(false);
}

/**
 * Without a connection, marks `showId` and taps "Guardar": the selection stays on the device, with
 * the notice (FR-02, FR-04).
 */
export async function saveOffline(
  page: Page,
  context: BrowserContext,
  showId: string,
): Promise<void> {
  await goOffline(page, context);
  await showBlock(page, showId).click();
  await expectChosen(page, showId, true);
  await saveSelection(page);
  await expect(notice(page)).toBeVisible();
}

/** Without a connection, opens `/` again: the service worker answers with the offline screen. */
export async function reopenOffline(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  // The grid from the device copy, not the "Sin conexión" card.
  await expect(page.getByRole("tab", { name: "Viernes", exact: true })).toBeVisible();
}
