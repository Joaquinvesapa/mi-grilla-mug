import {
  expect,
  test as base,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import {
  CREATE_GROUP_BUTTON,
  formatInviteExpiry,
  GROUP_NAME_LABEL,
  JOIN_GROUP_BUTTON,
} from "@/lib/group-messages";

/** The name of AC-01. Every account only sees its own groups, so parallel tests can share it. */
export const GROUP_NAME = "Los del Lolla";

/** Path of a group's screen: `/grupos/<UUID>`. */
const GROUP_PATH = /^\/grupos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const INVITE_URL = /\/invitacion\/[A-Za-z0-9_-]{43}$/;
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type GroupFixtures = {
  /**
   * Opens another device: a fresh browser context, with the project's device and the test server's
   * `baseURL`, so each account has its own cookies. Every context is closed when the test ends.
   */
  openDevice: () => Promise<Page>;
};

export const test = base.extend<GroupFixtures>({
  openDevice: async ({ browser, baseURL }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    // Every context option the project can set, not only the device's size: the other accounts have
    // to run on the same emulated phone as `page` (screen, touch, user agent, locale, time zone…),
    // or a test could pass on one device while the app fails on the one the project is about. The
    // project's `use` also carries runner options (`trace`, `defaultBrowserType`…) that are not
    // context options, so they are picked by name instead of spread. `baseURL` comes from the
    // fixture: it is set at the config's top level, not per project.
    const {
      viewport,
      screen,
      userAgent,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      locale,
      timezoneId,
      colorScheme,
      reducedMotion,
      forcedColors,
      geolocation,
      permissions,
      extraHTTPHeaders,
      httpCredentials,
      ignoreHTTPSErrors,
      javaScriptEnabled,
      bypassCSP,
      offline,
      acceptDownloads,
      serviceWorkers,
      contextOptions,
    } = testInfo.project.use;
    await use(async () => {
      const context = await browser.newContext({
        ...contextOptions,
        baseURL,
        viewport,
        screen,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
        locale,
        timezoneId,
        colorScheme,
        reducedMotion,
        forcedColors,
        geolocation,
        permissions,
        extraHTTPHeaders,
        httpCredentials,
        ignoreHTTPSErrors,
        javaScriptEnabled,
        bypassCSP,
        offline,
        acceptDownloads,
        serviceWorkers,
      });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

/**
 * Creates a group from "Grupos" (opening it if the page is elsewhere) and waits for its screen.
 * Returns the group's id, read from the URL.
 */
export async function createGroup(page: Page, name: string): Promise<string> {
  if (new URL(page.url()).pathname !== "/grupos") {
    await page.goto("/grupos");
  }
  await page.getByLabel(GROUP_NAME_LABEL).fill(name);
  await page.getByRole("button", { name: CREATE_GROUP_BUTTON }).click();
  await expect
    .poll(() => new URL(page.url()).pathname, { message: "crear el grupo no llevó a su pantalla" })
    .toMatch(GROUP_PATH);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
}

/** Opens the link with a session, taps "Unirme" and waits for the group's screen (AC-07). */
export async function join(page: Page, link: string, groupId: string): Promise<void> {
  await page.goto(link);
  await page.getByRole("button", { name: JOIN_GROUP_BUTTON }).click();
  await expect(page).toHaveURL(`/grupos/${groupId}`);
  await expect(page.getByRole("heading", { level: 1, name: GROUP_NAME })).toBeVisible();
}

/** The "Link de invitación" card of a group's screen. */
export function inviteCard(page: Page): Locator {
  return page.getByRole("region", { name: "Link de invitación" });
}

/** The invite link as the group's screen shows it (an absolute URL, once the page hydrated). */
export async function readInviteLink(page: Page): Promise<string> {
  const link = inviteCard(page).getByText(INVITE_URL);
  await expect(link).toBeVisible();
  return (await link.textContent())?.trim() ?? "";
}

/**
 * Opens the invite link with a session, taps "Unirme" and waits for the group's screen, named
 * `groupName`. For the second and third members of a test (FEAT-006b).
 */
export async function joinGroup(
  page: Page,
  link: string,
  groupId: string,
  groupName: string,
): Promise<void> {
  await page.goto(link);
  await page.getByRole("button", { name: JOIN_GROUP_BUTTON }).click();
  await expect(page).toHaveURL(`/grupos/${groupId}`);
  await expect(page.getByRole("heading", { level: 1, name: groupName })).toBeVisible();
}

/** One row per member in the group's screen, in the list's order (who joined first goes first). */
export function memberRows(page: Page): Locator {
  return page.getByRole("list", { name: "Integrantes" }).getByRole("listitem");
}

/**
 * Every expiry text a link created between `before` and `after` (ms) can show: 72 h later, on any
 * of the minutes in between (the server's clock reads somewhere in that window).
 */
export function expiryTexts(before: number, after: number): string[] {
  const texts: string[] = [];
  const first = Math.floor((before + INVITE_TTL_MS) / MINUTE_MS) * MINUTE_MS;
  for (let time = first; time <= after + INVITE_TTL_MS; time += MINUTE_MS) {
    texts.push(formatInviteExpiry(new Date(time)));
  }
  return texts;
}
