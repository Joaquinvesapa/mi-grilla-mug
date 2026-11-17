import { expect, test, type Locator, type Page } from "@playwright/test";

import { signUp, submitLogin, type TestAccount } from "./auth";
import {
  chooseDay,
  DAYS,
  dayName,
  discardButton,
  durationMinutes,
  expectedName,
  gridRegion,
  interval,
  pendingBar,
  saveButton,
  saveSelection,
  showBlock,
  showById,
  showsOfDay,
  STAGES,
  tapLogout,
} from "./grid";

// Runs in the mobile projects (iphone-webkit, mobile-chromium, mobile-360): /demo's desktop
// project only matches demo.spec.ts (playwright.config). Every test that needs `/` signs up an
// account of its own, so no test sees another's selection.

const CLASH = "Choca con otro show elegido";
const PENDING = "Sin guardar";
/** Why the beforeunload test is Chromium only (AGENTS.md: the reason, on the skipped line). */
const BEFOREUNLOAD_SKIP =
  "beforeunload es un extra: iOS Safari y la PWA no lo respetan siempre, y no cuenta como evidencia de AC-16 en iPhone (spec, FR-12)";
const PHONE_WIDTHS = [
  { width: 360, height: 780 },
  { width: 430, height: 932 },
];

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, "el elemento no tiene caja").not.toBeNull();
  return box!;
}

/** Whether `inner` lies whole, horizontally, inside the region's visible width. */
function fitsHorizontally(inner: Box, outer: Box): boolean {
  return inner.x >= outer.x - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5;
}

/** Whether `inner` overlaps the region's visible box at all. */
function overlaps(inner: Box, outer: Box): boolean {
  return (
    inner.x < outer.x + outer.width &&
    inner.x + inner.width > outer.x &&
    inner.y < outer.y + outer.height &&
    inner.y + inner.height > outer.y
  );
}

async function scrollGrid(region: Locator, to: { left?: number; top?: number }) {
  await region.evaluate((el, target) => {
    el.scrollTo({ ...target, behavior: "instant" as ScrollBehavior });
  }, to);
}

async function expectChosen(page: Page, showId: string, chosen: boolean) {
  await expect(showBlock(page, showId)).toHaveAttribute("aria-pressed", String(chosen));
}

test.describe("la grilla (FEAT-003a)", () => {
  let account: TestAccount;

  test.beforeEach(async ({ page }, testInfo) => {
    account = await signUp(page, testInfo);
  });

  test("test-e2e-grid-all-shows: recorriendo los 3 días se ven los 91 shows en su columna, con artista y horario (AC-01)", async ({
    page,
  }) => {
    let seen = 0;
    for (const day of DAYS) {
      await chooseDay(page, day.id);
      const region = gridRegion(page, day.id);
      const expected = showsOfDay(day.id);
      await expect(region.locator("[data-show-id]")).toHaveCount(expected.length);

      for (const show of expected) {
        const block = region.locator(
          `[data-stage-column="${show.stageId}"] [data-show-id="${show.id}"]`,
        );
        await expect(block, `${show.id} en la columna ${show.stageId}`).toHaveCount(1);
        await expect(block).toHaveAccessibleName(expectedName(show));
      }
      seen += expected.length;
    }
    expect(seen).toBe(91);
  });

  test("test-e2e-grid-columns: escenarios en orden y una marca por hora en cada día (AC-02)", async ({
    page,
  }) => {
    for (const day of DAYS) {
      await chooseDay(page, day.id);
      const region = gridRegion(page, day.id);
      await expect(region.locator("[data-stage-header]")).toHaveText(
        STAGES.map((stage) => stage.name),
      );

      const shows = showsOfDay(day.id).map(interval);
      const first = Math.floor(Math.min(...shows.map((show) => show.start)) / 60);
      const last = Math.ceil(Math.max(...shows.map((show) => show.end)) / 60);
      const hours = Array.from({ length: last - first + 1 }, (_, index) => {
        const hour = (first + index) % 24;
        return `${String(hour).padStart(2, "0")}:00`;
      });
      await expect(region.locator("[data-hour-mark]")).toHaveText(hours);
    }
  });

  test("test-e2e-grid-block-content: Arjaus Crew del viernes con su subtítulo y 15:00 – 15:45 (AC-03)", async ({
    page,
  }) => {
    const arjaus = showById("fri-kidzapalooza-1500");
    expect(arjaus.subtitle).toBe("Franco y Mateo Trocca - B2B");

    const block = showBlock(gridRegion(page, "fri"), arjaus.id);
    await expect(block).toHaveAccessibleName(
      `${arjaus.artist} Franco y Mateo Trocca - B2B 15:00 – 15:45`,
    );
    await expect(block.getByText("Franco y Mateo Trocca - B2B", { exact: true })).toBeAttached();
    await expect(block.getByText("15:00 – 15:45", { exact: true })).toBeAttached();
  });

  test("test-e2e-grid-geometry: las alturas son proporcionales a la duración y el inicio cae en su marca de hora (AC-04)", async ({
    page,
  }) => {
    // Two shows of the Flow column of Friday with different durations, one starting on the hour.
    const short = showById("fri-flow-1430");
    const long = showById("fri-flow-1600");
    expect(durationMinutes(short)).not.toBe(durationMinutes(long));
    expect(long.start).toBe("16:00");

    const region = gridRegion(page, "fri");
    const shortBox = await boxOf(showBlock(page, short.id));
    const longBox = await boxOf(showBlock(page, long.id));
    expect(shortBox.height / longBox.height).toBeCloseTo(
      durationMinutes(short) / durationMinutes(long),
      2,
    );

    // The scale of the axis, from two consecutive hour marks: a block is as tall as its minutes.
    const marks = region.locator("[data-hour-mark]");
    const sixteen = marks.filter({ hasText: /^16:00$/ });
    const seventeen = marks.filter({ hasText: /^17:00$/ });
    const hourPx = (await boxOf(seventeen)).y - (await boxOf(sixteen)).y;
    expect(hourPx).toBeGreaterThan(0);
    expect(longBox.height).toBeCloseTo((hourPx * durationMinutes(long)) / 60, 0);
    // The label is drawn just under its line; the block starts on the line.
    expect(Math.abs(longBox.y - (await boxOf(sixteen)).y)).toBeLessThanOrEqual(3);
    // And the 14:30 show starts half an hour under its own 14:00 mark.
    const fourteen = await boxOf(marks.filter({ hasText: /^14:00$/ }));
    expect(Math.abs(shortBox.y - (fourteen.y + hourPx / 2))).toBeLessThanOrEqual(3);
  });

  test("test-e2e-grid-after-midnight: Peggy Gou en Samsung del viernes, 23:30 – 01:00, y el eje llega a 01:00 (AC-05)", async ({
    page,
  }) => {
    const peggy = showById("fri-samsung-2330");
    expect([peggy.dayId, peggy.stageId, peggy.start, peggy.end]).toEqual([
      "fri",
      "samsung",
      "23:30",
      "01:00",
    ]);

    const region = gridRegion(page, "fri");
    const block = region.locator(`[data-stage-column="samsung"] [data-show-id="${peggy.id}"]`);
    await expect(block).toHaveAccessibleName(expectedName(peggy));
    await expect(block).toHaveAccessibleName(/23:30 – 01:00$/);
    await expect(region.locator("[data-hour-mark]").last()).toHaveText("01:00");

    // The block ends on the 01:00 mark, the last of the axis.
    const blockBox = await boxOf(block);
    const lastMark = await boxOf(region.locator("[data-hour-mark]").last());
    expect(Math.abs(blockBox.y + blockBox.height - lastMark.y)).toBeLessThanOrEqual(3);
  });

  test('test-e2e-grid-day-switch: elegir "Sábado" muestra Skrillex y no Peggy Gou (AC-06)', async ({
    page,
  }) => {
    const skrillex = showById("sat-samsung-2345");
    const peggy = showById("fri-samsung-2330");
    await expect(showBlock(page, peggy.id)).toHaveCount(1);

    await chooseDay(page, "sat");

    await expect(page.getByRole("tab", { name: "Sábado" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(showBlock(page, skrillex.id)).toHaveAccessibleName(expectedName(skrillex));
    await expect(showBlock(page, peggy.id)).toHaveCount(0);
    await expect(gridRegion(page, "fri")).toHaveCount(0);
  });

  for (const viewport of PHONE_WIDTHS) {
    test(`test-e2e-grid-three-columns: a ${viewport.width} px se ven 3 columnas completas y Perry's se alcanza con scroll horizontal (AC-07)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const region = gridRegion(page, "fri");
      const headers = region.locator("[data-stage-header]");
      await expect(headers).toHaveCount(5);

      const visibleWhole = async () => {
        const area = await boxOf(region);
        const names: string[] = [];
        for (const header of await headers.all()) {
          if (fitsHorizontally(await boxOf(header), area)) {
            names.push((await header.textContent()) ?? "");
          }
        }
        return names;
      };

      expect(await visibleWhole()).toEqual(["Flow", "Samsung", "Alternative"]);
      // The document itself never scrolls sideways: only the grid does.
      const scrollMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.innerWidth);

      await scrollGrid(region, { left: 10_000 });
      await expect.poll(visibleWhole).toEqual(["Alternative", "Perry's", "Kidzapalooza"]);
      expect(await visibleWhole()).toHaveLength(3);
    });
  }

  test("test-e2e-grid-sticky: con scroll vertical los escenarios siguen a la vista y con scroll horizontal las horas también (AC-08)", async ({
    page,
  }) => {
    const region = gridRegion(page, "fri");
    const flow = region.locator("[data-stage-header]").first();
    const area = await boxOf(region);
    const headerTop = (await boxOf(flow)).y;

    await scrollGrid(region, { top: 600 });
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    const scrolledHeader = await boxOf(flow);
    expect(Math.abs(scrolledHeader.y - headerTop)).toBeLessThanOrEqual(1);
    expect(overlaps(scrolledHeader, area)).toBe(true);

    // The first visible hour mark under the header, before and after scrolling sideways.
    const visibleMarks = async () => {
      const current = await boxOf(region);
      const result: { text: string; x: number }[] = [];
      for (const mark of await region.locator("[data-hour-mark]").all()) {
        const box = await boxOf(mark);
        if (overlaps(box, current) && fitsHorizontally(box, current)) {
          result.push({ text: (await mark.textContent()) ?? "", x: box.x });
        }
      }
      return result;
    };
    const before = await visibleMarks();
    expect(before.length).toBeGreaterThan(0);

    await scrollGrid(region, { left: 10_000 });
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    const after = await visibleMarks();
    expect(after.map((mark) => mark.text)).toEqual(before.map((mark) => mark.text));
    for (const [index, mark] of after.entries()) {
      expect(Math.abs(mark.x - (before[index]?.x ?? Number.NaN))).toBeLessThanOrEqual(1);
    }
    // And the stage row stayed on top through the sideways scroll as well.
    expect(
      Math.abs((await boxOf(region.locator("[data-stage-header]").last())).y - headerTop),
    ).toBeLessThanOrEqual(1);
  });

  test("test-e2e-grid-initial-day: hoy, fuera del festival, abre en el viernes (AC-10)", async ({
    page,
  }) => {
    // The server's clock is the real one (no simulated clock outside /demo): today is after March
    // 2026, outside the festival.
    const today = new Date().toISOString().slice(0, 10);
    expect(DAYS.map((day) => day.date)).not.toContain(today);

    await expect(page.getByRole("tab", { name: dayName("fri"), exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(gridRegion(page, "fri")).toBeVisible();
  });

  test("test-e2e-grid-toggle: tocar un show lo marca y tocarlo de nuevo lo desmarca (AC-11)", async ({
    page,
  }) => {
    const show = "fri-flow-1800";
    await expectChosen(page, show, false);

    await showBlock(page, show).click();
    await expectChosen(page, show, true);

    await showBlock(page, show).click();
    await expectChosen(page, show, false);
  });

  test("test-e2e-grid-save-persists: marcar 2 shows, guardar, cerrar sesión y volver a entrar los muestra elegidos (AC-12)", async ({
    page,
  }) => {
    const friday = "fri-samsung-2100";
    const saturday = "sat-flow-2215";
    const untouched = "fri-flow-2215";

    await showBlock(page, friday).click();
    await chooseDay(page, "sat");
    await showBlock(page, saturday).click();
    await expect(pendingBar(page)).toContainText("2 cambios sin guardar");
    await saveSelection(page);

    await tapLogout(page);
    await expect(page).toHaveURL("/login");
    await submitLogin(page, account.email, account.password);
    await expect(page).toHaveURL("/");

    await expect(gridRegion(page, "fri")).toBeVisible();
    await expectChosen(page, friday, true);
    await expectChosen(page, untouched, false);
    await expect(showBlock(page, friday)).not.toHaveAccessibleDescription(/Sin guardar/);
    await chooseDay(page, "sat");
    await expectChosen(page, saturday, true);
    await expect(pendingBar(page)).toHaveCount(0);
  });

  test("test-e2e-grid-pending-across-days: marcar el viernes, ir al sábado y volver lo mantiene elegido y pendiente (AC-13)", async ({
    page,
  }) => {
    const show = "fri-alternative-2000";
    await showBlock(page, show).click();
    await expectChosen(page, show, true);
    await expect(showBlock(page, show)).toHaveAccessibleDescription(PENDING);

    await chooseDay(page, "sat");
    await expect(showBlock(page, show)).toHaveCount(0);
    await expect(pendingBar(page)).toContainText("1 cambio sin guardar");
    await chooseDay(page, "fri");

    await expectChosen(page, show, true);
    await expect(showBlock(page, show)).toHaveAccessibleDescription(PENDING);
    await expect(pendingBar(page)).toContainText("1 cambio sin guardar");
  });

  test('test-e2e-grid-pending-bar: con pendientes se ve el aviso con "Guardar" y "Descartar" (AC-14)', async ({
    page,
  }) => {
    await expect(pendingBar(page)).toHaveCount(0);

    await showBlock(page, "fri-perrys-1700").click();
    await expect(pendingBar(page)).toBeVisible();
    await expect(pendingBar(page)).toContainText("1 cambio sin guardar");
    await expect(saveButton(page)).toBeVisible();
    await expect(discardButton(page)).toBeVisible();

    await showBlock(page, "fri-perrys-1815").click();
    await expect(pendingBar(page)).toContainText("2 cambios sin guardar");

    // Back to what is saved: nothing pending, no notice.
    await showBlock(page, "fri-perrys-1700").click();
    await showBlock(page, "fri-perrys-1815").click();
    await expect(pendingBar(page)).toHaveCount(0);
  });

  test('test-e2e-grid-discard: guardar uno, marcar otro y "Descartar" vuelve a la guardada (AC-15)', async ({
    page,
  }) => {
    const saved = "fri-flow-2000";
    const other = "fri-alternative-1800";
    await showBlock(page, saved).click();
    await saveSelection(page);

    await showBlock(page, other).click();
    await showBlock(page, saved).click();
    await expectChosen(page, other, true);
    await expectChosen(page, saved, false);
    await expect(pendingBar(page)).toContainText("2 cambios sin guardar");

    await discardButton(page).click();

    await expect(pendingBar(page)).toHaveCount(0);
    await expectChosen(page, saved, true);
    await expectChosen(page, other, false);
    // Exactly the saved selection: after a reload, the server agrees.
    await page.reload();
    await expectChosen(page, saved, true);
    await expectChosen(page, other, false);
    await expect(page.locator('[data-show-id][aria-pressed="true"]')).toHaveCount(1);
  });

  test('test-e2e-grid-leave-confirm: con pendientes, "Cerrar sesión" pide confirmación; cancelar deja la grilla y confirmar cierra la sesión (AC-16)', async ({
    page,
  }) => {
    const show = "fri-samsung-1900";
    await showBlock(page, show).click();

    await tapLogout(page);
    const dialog = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("1 cambio sin guardar");

    await dialog.getByRole("button", { name: "Seguir editando" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL("/");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectChosen(page, show, true);
    await expect(pendingBar(page)).toContainText("1 cambio sin guardar");

    await tapLogout(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Salir sin guardar" }).click();
    await expect(page).toHaveURL("/login");

    // Confirming discarded the change: it was never saved.
    await submitLogin(page, account.email, account.password);
    await expect(page).toHaveURL("/");
    await expectChosen(page, show, false);
  });

  test("test-e2e-grid-leave-beforeunload: en Chromium, cerrar la página con pendientes dispara beforeunload (AC-16, extra de FR-12)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", BEFOREUNLOAD_SKIP); // iOS no respeta beforeunload
    const show = "fri-kidzapalooza-1700";
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.type());
      void dialog.dismiss();
    });

    await showBlock(page, show).click();
    await expect(pendingBar(page)).toBeVisible();
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => dialogs).toEqual(["beforeunload"]);
    // Dismissed: the page stays, with the change still there.
    expect(page.isClosed()).toBe(false);
    await expectChosen(page, show, true);

    // Without pending changes, closing asks nothing.
    await discardButton(page).click();
    await expect(pendingBar(page)).toHaveCount(0);
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => page.isClosed()).toBe(true);
    expect(dialogs).toEqual(["beforeunload"]);
  });

  test("test-e2e-grid-clash: dos shows del viernes que se superponen muestran la marca de choque en los dos (AC-17)", async ({
    page,
  }) => {
    const a = showById("fri-flow-1430");
    const b = showById("fri-kidzapalooza-1500");
    const [ia, ib] = [interval(a), interval(b)];
    expect(a.dayId).toBe("fri");
    expect(b.dayId).toBe("fri");
    // They share at least one minute.
    expect(Math.min(ia.end, ib.end) - Math.max(ia.start, ib.start)).toBeGreaterThanOrEqual(1);

    await showBlock(page, a.id).click();
    await expectChosen(page, a.id, true);
    // Chosen alone it clashes with nothing.
    await expect(showBlock(page, a.id)).toHaveAccessibleDescription(PENDING);
    await expect(showBlock(page, a.id)).not.toHaveAccessibleDescription(new RegExp(CLASH));
    await showBlock(page, b.id).click();

    for (const id of [a.id, b.id]) {
      await expect(showBlock(page, id)).toHaveAccessibleDescription(new RegExp(CLASH));
    }
    // The mark is there for sighted people too: the icon next to the name.
    await expect(showBlock(page, a.id).locator("svg")).toHaveCount(1);

    // Unchoosing one takes the mark off the other.
    await showBlock(page, b.id).click();
    await expect(showBlock(page, a.id)).not.toHaveAccessibleDescription(new RegExp(CLASH));
    await expect(showBlock(page, b.id)).not.toHaveAccessibleDescription(new RegExp(CLASH));
  });

  test("test-e2e-grid-edge-no-clash: dos shows del viernes que solo se tocan en el borde no muestran marca (AC-18)", async ({
    page,
  }) => {
    const a = showById("fri-flow-1430");
    const b = showById("fri-samsung-1515");
    expect(a.dayId).toBe("fri");
    expect(b.dayId).toBe("fri");
    // One ends exactly when the other starts.
    expect(interval(a).end).toBe(interval(b).start);

    await showBlock(page, a.id).click();
    await showBlock(page, b.id).click();
    await expectChosen(page, a.id, true);
    await expectChosen(page, b.id, true);

    for (const id of [a.id, b.id]) {
      await expect(showBlock(page, id)).toHaveAccessibleDescription(PENDING);
      await expect(showBlock(page, id)).not.toHaveAccessibleDescription(new RegExp(CLASH));
      await expect(showBlock(page, id).locator("svg")).toHaveCount(0);
    }
  });

  for (const viewport of PHONE_WIDTHS) {
    test(`test-e2e-grid-min-height: a ${viewport.width} px los shows de 30 minutos o menos miden al menos 44 px de alto (AC-28)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      const short = DAYS.flatMap((day) =>
        showsOfDay(day.id).filter((show) => durationMinutes(show) <= 30),
      );
      // The source has no 30-minute show: its shortest last 20 (Sunday, Kidzapalooza), which is
      // stricter — at scale they would measure less than 44.
      expect(short.length, "la fuente no tiene shows de 30 minutos o menos").toBeGreaterThan(0);

      for (const show of short) {
        await chooseDay(page, show.dayId);
        const box = await boxOf(showBlock(page, show.id));
        expect(box.height, `${show.id} (${durationMinutes(show)} min)`).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("test-e2e-grid-names-two-lines: a 360 px el nombre de cada show de 45 minutos o más ocupa 2 líneas o menos, a 12 px o más, sin elegir y elegido con choque (NFR-04)", async ({
    page,
  }) => {
    // Two passes over the 3 days, marking all 91 shows in between: more than the default 30 s on
    // a slow WebKit or CI runner.
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");

    const problems: string[] = [];
    let checked = 0;
    let clashing = 0;

    /** Measures the name of every show of 45 minutes or more of the day on screen. */
    async function measureDay(dayId: string, state: string) {
      for (const show of showsOfDay(dayId).filter((item) => durationMinutes(item) >= 45)) {
        const block = showBlock(page, show.id);
        // The artist's name is the first text of the block, the one in the block's first row.
        const metrics = await block.evaluate((element) => {
          const name = element.querySelector(":scope > span > span");
          if (!(name instanceof HTMLElement)) return null;
          const style = getComputedStyle(name);
          const rect = name.getBoundingClientRect();
          const blockRect = element.getBoundingClientRect();
          const icon = element.querySelector("svg")?.getBoundingClientRect() ?? null;
          return {
            text: name.textContent,
            height: rect.height,
            lineHeight: Number.parseFloat(style.lineHeight),
            fontSize: Number.parseFloat(style.fontSize),
            clipped: rect.bottom > blockRect.bottom + 0.5,
            // The clash mark must not sit on the name, nor stick out of the block.
            iconOnName:
              icon !== null &&
              icon.top < rect.bottom - 0.5 &&
              icon.bottom > rect.top + 0.5 &&
              icon.left < rect.right - 0.5 &&
              icon.right > rect.left + 0.5,
            iconOutside:
              icon !== null &&
              (icon.left < blockRect.left - 0.5 || icon.right > blockRect.right + 0.5),
          };
        });
        expect(metrics, `${show.id}: no se encontró el nombre`).not.toBeNull();
        expect(metrics!.text).toBe(show.artist);
        const lines = Math.round(metrics!.height / metrics!.lineHeight);
        const where = `${show.id} "${show.artist}" (${state})`;
        if (lines > 2) problems.push(`${where}: ${lines} líneas`);
        if (metrics!.fontSize < 12) problems.push(`${where}: fuente de ${metrics!.fontSize} px`);
        if (metrics!.clipped) problems.push(`${where}: el nombre queda cortado por el bloque`);
        if (metrics!.iconOnName) problems.push(`${where}: la marca de choque tapa el nombre`);
        if (metrics!.iconOutside) problems.push(`${where}: la marca de choque sale del bloque`);
        checked += 1;
      }
    }

    // Unchosen: the plain block.
    for (const day of DAYS) {
      await chooseDay(page, day.id);
      await measureDay(day.id, "sin elegir");
    }

    // Every show of the day chosen: the blocks are foam, dashed (unsaved) and, where shows of
    // different stages overlap, carry the clash mark — the widest a block's content gets.
    for (const day of DAYS) {
      await chooseDay(page, day.id);
      const dayShows = showsOfDay(day.id);
      for (const show of dayShows) {
        await showBlock(page, show.id).click();
      }
      // Checked once at the end rather than per tap: every block of the day ended up chosen.
      await expect(
        gridRegion(page, day.id).locator('[data-show-id][aria-pressed="true"]'),
      ).toHaveCount(dayShows.length);
      // With the whole day chosen, a show clashes exactly when it overlaps another one of the day.
      for (const show of dayShows.filter((item) => durationMinutes(item) >= 45)) {
        const own = interval(show);
        const overlaps = dayShows.some((other) => {
          if (other.id === show.id) return false;
          const theirs = interval(other);
          return Math.min(own.end, theirs.end) - Math.max(own.start, theirs.start) >= 1;
        });
        const block = showBlock(page, show.id);
        if (overlaps) {
          await expect(block, `${show.id} en choque`).toHaveAccessibleDescription(/Choca/);
          clashing += 1;
        } else {
          await expect(block, `${show.id} sin choque`).not.toHaveAccessibleDescription(/Choca/);
        }
      }
      await measureDay(day.id, "elegido");
    }

    expect(checked).toBeGreaterThan(0);
    // The chosen pass did measure blocks with the clash mark.
    expect(clashing, "ningún show de 45 minutos o más quedó en choque").toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  test("test-e2e-grid-no-store: la respuesta de / lleva no-store en Cache-Control (R-11)", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response, "no hubo respuesta de /").not.toBeNull();
    expect(new URL(page.url()).pathname).toBe("/");
    expect(response!.headers()["cache-control"] ?? "").toMatch(/\bno-store\b/);
  });
});

test.describe("la grilla sin sesión", () => {
  test("test-e2e-grid-requires-session: sin sesión, / termina en /login y no muestra la grilla (AC-19)", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/login");
    await expect(page.locator("[data-show-id]")).toHaveCount(0);
    await expect(gridRegion(page)).toHaveCount(0);
    expect(await page.content()).not.toContain("data-show-id");
  });
});
