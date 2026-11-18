import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWallpaper, type RenderWallpaperResult } from "@/components/wallpaper-canvas";
import {
  canShareFile,
  downloadWallpaper,
  shareWallpaper,
  wallpaperFile,
} from "@/components/wallpaper-delivery";
import { WallpaperButton } from "@/components/wallpaper-button";
import type { GroupPicks } from "@/lib/group-picks";
import {
  DOWNLOAD_IMAGE_LABEL,
  GENERATING_LABEL,
  PERSONAL_OPTION_LABEL,
  RETRY_LABEL,
  SAVE_TO_PHOTOS_LABEL,
  WALLPAPER_BUTTON_LABEL,
  WALLPAPER_CHOICE_LABEL,
  WALLPAPER_DONE_LABEL,
  WALLPAPER_GROUP_LABEL,
  WALLPAPER_GUIDE_STEPS,
  WALLPAPER_SHEET_TITLE,
  WITH_FRIENDS_OPTION_LABEL,
  wallpaperMessageFor,
} from "@/lib/wallpaper-messages";

import { DAYS, showsOf, STAGES } from "./schedule-fixture";
import { endVaulCloseAnimation, stubMatchMedia } from "./vaul-env";

// The canvas and the delivery are Block 2's, tested on their own: here they are fakes, so each
// test decides what the drawing and the share sheet answer.
vi.mock("@/components/wallpaper-canvas", () => ({ renderWallpaper: vi.fn() }));
vi.mock("@/components/wallpaper-delivery", () => ({
  wallpaperFile: vi.fn(),
  canShareFile: vi.fn(),
  shareWallpaper: vi.fn(),
  downloadWallpaper: vi.fn(),
}));

const render$ = vi.mocked(renderWallpaper);
const canShare$ = vi.mocked(canShareFile);
const share$ = vi.mocked(shareWallpaper);
const download$ = vi.mocked(downloadWallpaper);
const file$ = vi.mocked(wallpaperFile);

const FRIDAY = DAYS[0]!;
const FRIDAY_SHOWS = showsOf("fri");
const PREVIEW_ALT = "Vista previa del fondo del Viernes";
const FILE_NAME = "mi-grilla-viernes.png";
const BLOB = new Blob(["png"], { type: "image/png" });
const OK: RenderWallpaperResult = { ok: true, blob: BLOB, fontFallback: false };

// jsdom has no object URLs: each one handed out is numbered, so a test can tell which was revoked.
const URL_KEYS = ["createObjectURL", "revokeObjectURL"] as const;
const ORIGINAL_URL = new Map(
  URL_KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(URL, key)] as const),
);
let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;

beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  let next = 0;
  createObjectURL = vi.fn(() => `blob:wallpaper-${++next}`);
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

  render$.mockReset();
  render$.mockResolvedValue(OK);
  canShare$.mockReset();
  canShare$.mockReturnValue(false);
  share$.mockReset();
  share$.mockResolvedValue({ ok: true });
  download$.mockReset();
  file$.mockReset();
  file$.mockImplementation((blob, name) => new File([blob], name, { type: "image/png" }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [key, descriptor] of ORIGINAL_URL) {
    if (descriptor) {
      Object.defineProperty(URL, key, descriptor);
    } else {
      Reflect.deleteProperty(URL, key);
    }
  }
});

function renderButton(
  selectedIds: ReadonlySet<string> = new Set(["fri-flow-1800"]),
  groups: readonly GroupPicks[] | null = null,
  groupId?: string | null,
) {
  return render(
    <WallpaperButton
      day={FRIDAY}
      stages={STAGES}
      shows={FRIDAY_SHOWS}
      selectedIds={selectedIds}
      groups={groups}
      groupId={groupId}
    />,
  );
}

/** A drawing the test finishes when it wants, with whatever result. */
function deferredRender() {
  const pending: ((result: RenderWallpaperResult) => void)[] = [];
  render$.mockImplementation(
    () =>
      new Promise((resolve) => {
        pending.push(resolve);
      }),
  );
  return async (result: RenderWallpaperResult = OK) => {
    await act(async () => {
      pending.shift()?.(result);
    });
  };
}

async function openSheet(): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: WALLPAPER_BUTTON_LABEL }));
  });
  return screen.getByRole("dialog");
}

async function press(scope: HTMLElement, name: string) {
  await act(async () => {
    fireEvent.click(within(scope).getByRole("button", { name }));
  });
}

async function closeSheet() {
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  });
  await act(async () => {
    endVaulCloseAnimation(screen.getByRole("dialog"));
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

/** A share sheet the test answers when it wants. */
function deferredShare() {
  let answer: ((result: Awaited<ReturnType<typeof shareWallpaper>>) => void) | undefined;
  share$.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );
  return async (result: Awaited<ReturnType<typeof shareWallpaper>>) => {
    await act(async () => {
      answer?.(result);
    });
  };
}

/** The `aria-live` region of the sheet: what a screen reader hears change. */
function liveRegion(scope: HTMLElement): HTMLElement {
  const region = scope.querySelector<HTMLElement>("[aria-live='polite']");
  expect(region).not.toBeNull();
  return region!;
}

/** The guide's steps, without their (aria-hidden) number badge. */
function guideItems(scope: HTMLElement): string[] {
  return within(scope)
    .queryAllByRole("listitem")
    .map((item) => item.lastElementChild?.textContent ?? "");
}

describe("WallpaperButton", () => {
  it("test-wallpaper-button-share-flow: con share de archivos, Generando… → vista previa → Guardar en Fotos → guía de 4 pasos", async () => {
    canShare$.mockReturnValue(true);
    const finish = deferredRender();
    const selected = new Set(["fri-flow-1800"]);
    renderButton(selected);

    const sheet = await openSheet();
    expect(within(sheet).getByRole("heading", { name: WALLPAPER_SHEET_TITLE })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: GENERATING_LABEL })).toBeDisabled();
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    // The day on screen, its shows and the selection, as they were when the sheet opened.
    expect(render$).toHaveBeenCalledTimes(1);
    const input = render$.mock.calls[0]![0];
    expect(input.day).toBe(FRIDAY);
    expect(input.stages).toBe(STAGES);
    expect(input.shows).toStrictEqual(FRIDAY_SHOWS);
    expect([...input.selectedIds]).toStrictEqual(["fri-flow-1800"]);

    await finish();

    const preview = within(sheet).getByRole("img", { name: PREVIEW_ALT });
    expect(preview).toHaveAttribute("src", "blob:wallpaper-1");
    expect(within(sheet).queryByRole("button", { name: GENERATING_LABEL })).toBeNull();
    expect(liveRegion(sheet)).not.toHaveTextContent(GENERATING_LABEL);
    expect(file$).toHaveBeenCalledWith(BLOB, FILE_NAME);
    expect(within(sheet).queryByRole("button", { name: DOWNLOAD_IMAGE_LABEL })).toBeNull();

    await press(sheet, SAVE_TO_PHOTOS_LABEL);

    expect(share$).toHaveBeenCalledTimes(1);
    expect(share$.mock.calls[0]![0].name).toBe(FILE_NAME);
    expect(download$).not.toHaveBeenCalled();
    expect(guideItems(sheet)).toStrictEqual([...WALLPAPER_GUIDE_STEPS.share]);
    // The preview stays, to long-press it as a fallback.
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test-wallpaper-button-download-flow: sin share de archivos, Descargar imagen descarga mi-grilla-viernes.png y muestra la guía", async () => {
    renderButton();

    const sheet = await openSheet();
    expect(within(sheet).queryByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeNull();
    expect(guideItems(sheet)).toStrictEqual([]);

    await press(sheet, DOWNLOAD_IMAGE_LABEL);

    expect(download$).toHaveBeenCalledTimes(1);
    expect(download$).toHaveBeenCalledWith(BLOB, FILE_NAME);
    expect(share$).not.toHaveBeenCalled();
    expect(guideItems(sheet)).toStrictEqual([...WALLPAPER_GUIDE_STEPS.download]);
  });

  it("test-wallpaper-button-share-cancelled: si la persona cierra la hoja del sistema, sin alerta ni guía y sigue Guardar en Fotos", async () => {
    canShare$.mockReturnValue(true);
    share$.mockResolvedValue({ ok: false, code: "SHARE_CANCELLED" });
    renderButton();

    const sheet = await openSheet();
    await press(sheet, SAVE_TO_PHOTOS_LABEL);

    expect(share$).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(guideItems(sheet)).toStrictEqual([]);
    expect(within(sheet).getByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeEnabled();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
  });

  it("test-wallpaper-button-share-failed-error: con SHARE_FAILED muestra la alerta y cambia a Descargar imagen", async () => {
    canShare$.mockReturnValue(true);
    share$.mockResolvedValue({ ok: false, code: "SHARE_FAILED" });
    renderButton();

    const sheet = await openSheet();
    await press(sheet, SAVE_TO_PHOTOS_LABEL);

    expect(within(sheet).getByRole("alert")).toHaveTextContent(wallpaperMessageFor("SHARE_FAILED"));
    expect(within(sheet).queryByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeNull();
    expect(guideItems(sheet)).toStrictEqual([]);
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();

    await press(sheet, DOWNLOAD_IMAGE_LABEL);

    expect(download$).toHaveBeenCalledWith(BLOB, FILE_NAME);
    expect(guideItems(sheet)).toStrictEqual([...WALLPAPER_GUIDE_STEPS.download]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test-wallpaper-button-render-failed-error: con ENCODE_FAILED muestra el mensaje del catálogo y Reintentar vuelve a generar", async () => {
    render$.mockResolvedValueOnce({ ok: false, code: "ENCODE_FAILED" });
    renderButton();

    const sheet = await openSheet();

    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      wallpaperMessageFor("ENCODE_FAILED"),
    );
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();

    await press(sheet, RETRY_LABEL);

    expect(render$).toHaveBeenCalledTimes(2);
    // The retry draws the same copy taken when the sheet opened.
    expect(render$.mock.calls[1]![0]).toStrictEqual(render$.mock.calls[0]![0]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
  });

  it("CANVAS_UNSUPPORTED muestra su propio mensaje", async () => {
    render$.mockResolvedValueOnce({ ok: false, code: "CANVAS_UNSUPPORTED" });
    renderButton();

    const sheet = await openSheet();

    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      wallpaperMessageFor("CANVAS_UNSUPPORTED"),
    );
    expect(within(sheet).getByRole("button", { name: RETRY_LABEL })).toBeInTheDocument();
  });

  it("si renderWallpaper rechaza (en vez de dar un código), falla con ENCODE_FAILED y sin el mensaje del navegador", async () => {
    render$.mockRejectedValueOnce(new Error("detalle interno del navegador"));
    renderButton();

    const sheet = await openSheet();

    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      wallpaperMessageFor("ENCODE_FAILED"),
    );
    expect(document.body).not.toHaveTextContent("detalle interno del navegador");
    expect(within(sheet).getByRole("button", { name: RETRY_LABEL })).toBeInTheDocument();
  });

  it("si downloadWallpaper lanza, alerta con el mensaje genérico y se queda en ready para reintentar", async () => {
    download$.mockImplementationOnce(() => {
      throw new Error("detalle interno del navegador");
    });
    renderButton();

    const sheet = await openSheet();
    await press(sheet, DOWNLOAD_IMAGE_LABEL);

    expect(within(sheet).getByRole("alert")).toHaveTextContent(wallpaperMessageFor("UNKNOWN"));
    expect(document.body).not.toHaveTextContent("detalle interno del navegador");
    expect(guideItems(sheet)).toStrictEqual([]);
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();

    // Still `ready`: the same button downloads again.
    await press(sheet, DOWNLOAD_IMAGE_LABEL);

    expect(download$).toHaveBeenCalledTimes(2);
    expect(guideItems(sheet)).toStrictEqual([...WALLPAPER_GUIDE_STEPS.download]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test-wallpaper-button-stale-result-rejected: cerrar la hoja antes de que termine descarta el resultado y revoca el object URL", async () => {
    const finish = deferredRender();
    renderButton();

    // A first drawing that does finish: its preview URL goes away when the sheet closes.
    let sheet = await openSheet();
    await finish();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toHaveAttribute(
      "src",
      "blob:wallpaper-1",
    );
    await closeSheet();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wallpaper-1");

    // A second one closed while drawing: its late result is thrown away, no URL is made for it.
    sheet = await openSheet();
    expect(within(sheet).getByRole("button", { name: GENERATING_LABEL })).toBeDisabled();
    await closeSheet();
    await finish();
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    // Opening again starts a fresh drawing instead of showing the late one.
    sheet = await openSheet();
    expect(render$).toHaveBeenCalledTimes(3);
    expect(within(sheet).getByRole("button", { name: GENERATING_LABEL })).toBeDisabled();
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    await finish();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toHaveAttribute(
      "src",
      "blob:wallpaper-2",
    );
  });

  it("al desmontar con la vista previa abierta revoca su object URL", async () => {
    const { unmount } = renderButton();

    await openSheet();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wallpaper-1");
  });

  it("test-wallpaper-button-offline: sin conexión el botón está habilitado y genera igual", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderButton();

    const trigger = screen.getByRole("button", { name: WALLPAPER_BUTTON_LABEL });
    expect(trigger).toBeEnabled();

    const sheet = await openSheet();

    expect(render$).toHaveBeenCalledTimes(1);
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: DOWNLOAD_IMAGE_LABEL })).toBeEnabled();
  });

  it("mientras genera, la acción está deshabilitada y el estado se anuncia (aria-live, aria-busy)", async () => {
    deferredRender();
    renderButton();

    const sheet = await openSheet();

    expect(liveRegion(sheet)).toHaveTextContent(GENERATING_LABEL);
    const action = within(sheet).getByRole("button", { name: GENERATING_LABEL });
    expect(action).toBeDisabled();
    expect(sheet.querySelector("[aria-busy='true']")).not.toBeNull();
    // The spinner stops with prefers-reduced-motion.
    expect(action.querySelector("svg")).toHaveClass("animate-spin", "motion-reduce:animate-none");
  });

  it("la región aria-live tiene solo el texto de estado (generando, listo o el mensaje), nunca los botones", async () => {
    canShare$.mockReturnValue(true);
    const finish = deferredRender();
    renderButton();

    const sheet = await openSheet();
    expect(within(liveRegion(sheet)).queryAllByRole("button")).toStrictEqual([]);

    await finish({ ok: false, code: "ENCODE_FAILED" });
    expect(liveRegion(sheet)).toHaveTextContent(wallpaperMessageFor("ENCODE_FAILED"));
    expect(within(liveRegion(sheet)).queryAllByRole("button")).toStrictEqual([]);

    await press(sheet, RETRY_LABEL);
    await finish();
    expect(within(sheet).getByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeInTheDocument();
    expect(within(liveRegion(sheet)).queryAllByRole("button")).toStrictEqual([]);
    expect(liveRegion(sheet)).not.toHaveTextContent(WALLPAPER_DONE_LABEL);

    await press(sheet, SAVE_TO_PHOTOS_LABEL);
    // Done: the region says so, and there is no action left (the guide is what follows).
    expect(liveRegion(sheet)).toHaveTextContent(WALLPAPER_DONE_LABEL);
    expect(within(sheet).queryAllByRole("button")).toStrictEqual([]);
  });

  it("el lugar de la vista previa tiene el mismo tope de alto generando y con la imagen", async () => {
    const finish = deferredRender();
    renderButton();

    const sheet = await openSheet();
    // The preview's box is the one marked busy; while drawing, it holds the placeholder.
    const placeholder = sheet.querySelector("[aria-busy='true']")!.firstElementChild!;
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(placeholder).toHaveClass("max-h-[45dvh]");
    expect(placeholder).not.toHaveClass("max-h-80");

    await finish();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toHaveClass("max-h-[45dvh]");
  });

  it("Reintentar dibuja la copia tomada al abrir, aunque las props cambien con la hoja abierta", async () => {
    render$.mockResolvedValueOnce({ ok: false, code: "ENCODE_FAILED" });
    const { rerender } = renderButton(new Set(["fri-flow-1800"]));

    const sheet = await openSheet();
    expect(within(sheet).getByRole("alert")).toBeInTheDocument();

    // The screen behind changes (another selection, other shows) while the sheet is open.
    rerender(
      <WallpaperButton
        day={FRIDAY}
        stages={STAGES}
        shows={FRIDAY_SHOWS.slice(0, 1)}
        selectedIds={new Set(["otro-show"])}
        groups={null}
        groupId={undefined}
      />,
    );
    await press(sheet, RETRY_LABEL);

    expect(render$).toHaveBeenCalledTimes(2);
    const retried = render$.mock.calls[1]![0];
    expect([...retried.selectedIds]).toStrictEqual(["fri-flow-1800"]);
    expect(retried.shows).toStrictEqual(FRIDAY_SHOWS);
  });

  it("un resultado de share que llega después de cerrar la hoja se descarta (resuelto ok)", async () => {
    canShare$.mockReturnValue(true);
    const answerShare = deferredShare();
    const finish = deferredRender();
    renderButton();

    let sheet = await openSheet();
    await finish();
    await press(sheet, SAVE_TO_PHOTOS_LABEL);
    await closeSheet();

    // Opened again: drawing anew when the old share sheet answers.
    sheet = await openSheet();
    await answerShare({ ok: true });

    expect(guideItems(sheet)).toStrictEqual([]);
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(liveRegion(sheet)).not.toHaveTextContent(WALLPAPER_DONE_LABEL);
    expect(within(sheet).getByRole("button", { name: GENERATING_LABEL })).toBeDisabled();

    // And the new drawing goes on as if the old share never answered.
    await finish();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toHaveAttribute(
      "src",
      "blob:wallpaper-2",
    );
    expect(within(sheet).getByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeEnabled();
  });

  it("un resultado de share que llega después de cerrar la hoja se descarta (falla tarde)", async () => {
    canShare$.mockReturnValue(true);
    const answerShare = deferredShare();
    const finish = deferredRender();
    renderButton();

    let sheet = await openSheet();
    await finish();
    await press(sheet, SAVE_TO_PHOTOS_LABEL);
    await closeSheet();

    sheet = await openSheet();
    await answerShare({ ok: false, code: "SHARE_FAILED" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: DOWNLOAD_IMAGE_LABEL })).toBeNull();
    expect(within(sheet).getByRole("button", { name: GENERATING_LABEL })).toBeDisabled();

    await finish();
    // Still "Guardar en Fotos": the late failure did not switch the new sheet to the download.
    expect(within(sheet).getByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mientras la hoja del sistema está abierta, Guardar en Fotos está deshabilitado y un segundo toque no comparte otra vez", async () => {
    canShare$.mockReturnValue(true);
    const answerShare = deferredShare();
    renderButton();

    const sheet = await openSheet();
    await press(sheet, SAVE_TO_PHOTOS_LABEL);

    const action = within(sheet).getByRole("button", { name: SAVE_TO_PHOTOS_LABEL });
    expect(action).toBeDisabled();
    await press(sheet, SAVE_TO_PHOTOS_LABEL);
    expect(share$).toHaveBeenCalledTimes(1);

    await answerShare({ ok: false, code: "SHARE_CANCELLED" });
    expect(within(sheet).getByRole("button", { name: SAVE_TO_PHOTOS_LABEL })).toBeEnabled();
  });

  it("el botón mide 44 × 44 y los controles de la hoja no arrastran la hoja", async () => {
    renderButton();

    const trigger = screen.getByRole("button", { name: WALLPAPER_BUTTON_LABEL });
    // size-11 = 2.75rem = 44 px: jsdom has no layout, so the size is read from its class.
    expect(trigger).toHaveClass("size-11", "select-none");

    const sheet = await openSheet();
    const action = within(sheet).getByRole("button", { name: DOWNLOAD_IMAGE_LABEL });
    expect(action.closest("[data-vaul-no-drag]")).not.toBeNull();
    const preview = within(sheet).getByRole("img", { name: PREVIEW_ALT });
    expect(preview.closest("[data-vaul-no-drag]")).not.toBeNull();
    // The preview stays long-pressable ("Agregar a Fotos" is the iPhone fallback).
    expect(preview).not.toHaveClass("select-none");
  });
});

/** Two groups, the most recent first, as `listGroupPicks` returns them. */
const LOLLA: GroupPicks = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Los del Lolla",
  friends: [
    { name: "Ana Pérez", initials: "AP", showIds: ["fri-flow-1800"] },
    { name: "Bruno Gómez", initials: "BG", showIds: ["fri-flow-1800", "fri-samsung-1700"] },
  ],
};
const FACU: GroupPicks = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Facu y cía",
  friends: [{ name: "Facu Ruiz", initials: "FR", showIds: ["fri-perrys-1815"] }],
};
const GROUP_FILE_NAME = "mi-grilla-viernes-los-del-lolla.png";
const LOLLA_ALT = "Vista previa del fondo del Viernes con Los del Lolla";

/** The two options of the sheet: "Grilla sola" and "Con amigos". */
function options(scope: HTMLElement) {
  return {
    personal: within(scope).getByRole("button", { name: PERSONAL_OPTION_LABEL }),
    group: within(scope).getByRole("button", { name: WITH_FRIENDS_OPTION_LABEL }),
  };
}

function sheetPicker(scope: HTMLElement) {
  return within(scope).queryByRole<HTMLSelectElement>("combobox", { name: WALLPAPER_GROUP_LABEL });
}

/** The group of the `call`-th drawing: its name and, per show, the friends' initials. */
function drawnGroup(call: number) {
  const input = render$.mock.calls[call]![0];
  if (!input.group) {
    return undefined;
  }
  return {
    name: input.group.name,
    byShow: Object.fromEntries(
      [...input.group.friendsByShow].map(([showId, friends]) => [
        showId,
        friends.map((friend) => friend.initials),
      ]),
    ),
  };
}

async function choose(scope: HTMLElement, groupId: string) {
  await act(async () => {
    fireEvent.change(sheetPicker(scope)!, { target: { value: groupId } });
  });
}

describe("WallpaperButton con grupos", () => {
  it("test-wallpaper-sheet-draws-default-on-open: con un grupo, la hoja abre con Grilla sola elegida y dibujada sin tocar nada; Con amigos dibuja el grupo y Grilla sola redibuja", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA], LOLLA.id);

    const sheet = await openSheet();

    expect(within(sheet).getByText(WALLPAPER_CHOICE_LABEL)).toBeInTheDocument();
    const { personal, group } = options(sheet);
    expect(personal).toHaveAttribute("aria-pressed", "true");
    expect(group).toHaveAttribute("aria-pressed", "false");
    // The filled button is the chosen one; the other is the outline.
    expect(personal).toHaveAttribute("data-variant", "default");
    expect(group).toHaveAttribute("data-variant", "outline");
    // Drawn on opening, personal, without pressing anything.
    expect(render$).toHaveBeenCalledTimes(1);
    expect(drawnGroup(0)).toBeUndefined();
    expect(file$).toHaveBeenLastCalledWith(BLOB, FILE_NAME);
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
    expect(sheet.querySelector("[aria-busy='true']")).toBeNull();
    // No picker for the personal one.
    expect(sheetPicker(sheet)).toBeNull();
    // 44 px or more, no tap delay nor text selection, and not dragging the sheet (mobile-native).
    for (const option of [personal, group]) {
      expect(option).toHaveClass("h-12", "touch-manipulation", "select-none");
      expect(option.closest("[data-vaul-no-drag]")).not.toBeNull();
    }

    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(2);
    expect(drawnGroup(1)?.name).toBe("Los del Lolla");
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toBeInTheDocument();
    expect(group).toHaveAttribute("aria-pressed", "true");
    expect(group).toHaveAttribute("data-variant", "default");
    expect(personal).toHaveAttribute("data-variant", "outline");

    await press(sheet, PERSONAL_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(3);
    expect(drawnGroup(2)).toBeUndefined();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
    expect(personal).toHaveAttribute("data-variant", "default");
  });

  it("test-wallpaper-sheet-switch-option: se pasa de Grilla sola a Con amigos y de vuelta sin cerrar la hoja ni perder el foco; generando, las opciones y el selector están deshabilitados", async () => {
    const finish = deferredRender();
    renderButton(new Set(["fri-flow-1800"]), [LOLLA, FACU], LOLLA.id);

    // Opens drawing "Grilla sola": both options refuse meanwhile.
    const sheet = await openSheet();
    const { personal, group } = options(sheet);
    expect(render$).toHaveBeenCalledTimes(1);
    expect(personal).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAttribute("aria-disabled", "true");
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(1);

    await finish();
    expect(personal).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
    expect(personal).not.toHaveAttribute("aria-disabled", "true");
    // No picker for the personal one.
    expect(sheetPicker(sheet)).toBeNull();

    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    // Drawing: both options and the picker refuse, and a second tap does not draw again.
    expect(render$).toHaveBeenCalledTimes(2);
    expect(personal).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(sheetPicker(sheet)).toHaveAttribute("aria-disabled", "true");
    await press(sheet, PERSONAL_OPTION_LABEL);
    await choose(sheet, FACU.id);
    expect(render$).toHaveBeenCalledTimes(2);

    await finish();
    expect(group).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toBeInTheDocument();
    expect(personal).not.toHaveAttribute("aria-disabled", "true");

    personal.focus();
    await press(sheet, PERSONAL_OPTION_LABEL);
    await finish();

    // The same buttons, never unmounted: the focus stays where it was.
    expect(options(sheet).personal).toBe(personal);
    expect(document.activeElement).toBe(personal);
    expect(personal).toHaveAttribute("aria-pressed", "true");
    expect(group).toHaveAttribute("aria-pressed", "false");
    expect(render$).toHaveBeenCalledTimes(3);
    expect(drawnGroup(2)).toBeUndefined();
    expect(screen.getByRole("dialog")).toBe(sheet);
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
    expect(sheetPicker(sheet)).toBeNull();
  });

  it("test-wallpaper-sheet-null-groups-personal: con groups null genera el personal al abrir, sin pregunta", async () => {
    renderButton(new Set(["fri-flow-1800"]), null, undefined);

    const sheet = await openSheet();

    expect(render$).toHaveBeenCalledTimes(1);
    expect(drawnGroup(0)).toBeUndefined();
    expect(within(sheet).queryByText(WALLPAPER_CHOICE_LABEL)).toBeNull();
    expect(within(sheet).queryByRole("button", { name: WITH_FRIENDS_OPTION_LABEL })).toBeNull();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
  });

  it("test-wallpaper-sheet-default-from-picker: Con amigos dibuja el grupo del selector de la grilla, y el selector de la hoja lo muestra y lo cambia", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA, FACU], FACU.id);

    const sheet = await openSheet();
    // The picker only shows up for "Con amigos".
    expect(sheetPicker(sheet)).toBeNull();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);

    // The first drawing is "Grilla sola", on opening.
    expect(render$).toHaveBeenCalledTimes(2);
    expect(drawnGroup(1)).toStrictEqual({
      name: "Facu y cía",
      byShow: { "fri-perrys-1815": ["FR"] },
    });
    const picker = sheetPicker(sheet)!;
    expect(picker).toHaveValue(FACU.id);
    // Without "Sin grupo": the wallpaper of a group always has a group.
    expect(
      within(picker)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Los del Lolla", "Facu y cía"]);
    expect(within(sheet).getByRole("img", { name: /con Facu y cía$/ })).toBeInTheDocument();
    expect(file$).toHaveBeenLastCalledWith(BLOB, "mi-grilla-viernes-facu-y-cia.png");

    await choose(sheet, LOLLA.id);

    expect(render$).toHaveBeenCalledTimes(3);
    expect(drawnGroup(2)?.name).toBe("Los del Lolla");
    expect(picker).toHaveValue(LOLLA.id);
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toBeInTheDocument();
    expect(file$).toHaveBeenLastCalledWith(BLOB, GROUP_FILE_NAME);
    // The redraw released the previous preview.
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wallpaper-2");
  });

  it("test-wallpaper-sheet-single-group-no-picker: con un solo grupo, Con amigos dibuja ese grupo y no hay selector", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA], LOLLA.id);

    const sheet = await openSheet();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);

    expect(drawnGroup(1)?.name).toBe("Los del Lolla");
    expect(sheetPicker(sheet)).toBeNull();
    expect(within(sheet).queryByRole("combobox")).toBeNull();
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toBeInTheDocument();
  });

  it("test-wallpaper-sheet-no-group-uses-latest: con Sin grupo en la grilla, Con amigos dibuja el grupo más reciente", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA, FACU], null);

    const sheet = await openSheet();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);

    expect(drawnGroup(1)?.name).toBe("Los del Lolla");
    expect(sheetPicker(sheet)).toHaveValue(LOLLA.id);
  });

  it("test-wallpaper-sheet-no-groups-direct: sin grupos genera el personal al abrir, sin pregunta", async () => {
    renderButton(new Set(["fri-flow-1800"]), [], undefined);

    const sheet = await openSheet();

    expect(render$).toHaveBeenCalledTimes(1);
    expect(drawnGroup(0)).toBeUndefined();
    expect(within(sheet).queryByText(WALLPAPER_CHOICE_LABEL)).toBeNull();
    expect(within(sheet).queryByRole("button", { name: PERSONAL_OPTION_LABEL })).toBeNull();
    expect(file$).toHaveBeenCalledWith(BLOB, FILE_NAME);
  });

  it("test-wallpaper-sheet-personal-option: Grilla sola dibuja sin group y con el nombre de archivo personal", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA], LOLLA.id);

    // Nothing pressed: "Grilla sola" is the one drawn on opening.
    const sheet = await openSheet();

    expect(render$).toHaveBeenCalledTimes(1);
    const input = render$.mock.calls[0]![0];
    expect(input).not.toHaveProperty("group");
    expect([...input.selectedIds]).toStrictEqual(["fri-flow-1800"]);
    expect(file$).toHaveBeenCalledWith(BLOB, FILE_NAME);
    expect(options(sheet).personal).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();

    await press(sheet, DOWNLOAD_IMAGE_LABEL);
    expect(download$).toHaveBeenCalledWith(BLOB, FILE_NAME);
    expect(guideItems(sheet)).toStrictEqual([...WALLPAPER_GUIDE_STEPS.download]);
  });

  it("test-wallpaper-sheet-draft-and-saved-picks: el show marcado sin guardar va en selectedIds y las iniciales de Bruno salen de sus showIds guardados", async () => {
    // The draft on screen: DJO saved, Easykid marked and not saved yet.
    renderButton(new Set(["fri-flow-1800", "fri-perrys-1815"]), [LOLLA], LOLLA.id);

    const sheet = await openSheet();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);

    const input = render$.mock.calls[1]![0];
    expect([...input.selectedIds].sort()).toStrictEqual(["fri-flow-1800", "fri-perrys-1815"]);
    expect(drawnGroup(1)).toStrictEqual({
      name: "Los del Lolla",
      byShow: { "fri-flow-1800": ["AP", "BG"], "fri-samsung-1700": ["BG"] },
    });
  });

  it("test-wallpaper-sheet-group-share: con share de archivos, el fondo del grupo se llama mi-grilla-viernes-los-del-lolla.png y se entrega con Guardar en Fotos", async () => {
    canShare$.mockReturnValue(true);
    renderButton(new Set(["fri-flow-1800"]), [LOLLA], LOLLA.id);

    const sheet = await openSheet();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);

    expect(file$).toHaveBeenCalledWith(BLOB, GROUP_FILE_NAME);
    await press(sheet, SAVE_TO_PHOTOS_LABEL);

    expect(share$).toHaveBeenCalledTimes(1);
    expect(share$.mock.calls[0]![0].name).toBe(GROUP_FILE_NAME);
    expect(download$).not.toHaveBeenCalled();
    expect(guideItems(sheet)).toStrictEqual([...WALLPAPER_GUIDE_STEPS.share]);
    expect(liveRegion(sheet)).toHaveTextContent(WALLPAPER_DONE_LABEL);
  });

  it("test-wallpaper-sheet-picker-rejects-invalid: un valor inválido en el selector de la hoja se rechaza y no redibuja", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA, FACU], LOLLA.id);

    const sheet = await openSheet();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    const picker = sheetPicker(sheet)!;

    // Values the options do not carry, as a tampered DOM would send them.
    for (const value of ["33333333-3333-4333-8333-333333333333", ""]) {
      const forged = document.createElement("option");
      forged.value = value;
      picker.append(forged);
      await choose(sheet, value);
    }

    expect(render$).toHaveBeenCalledTimes(2);
    expect(picker).toHaveValue(LOLLA.id);
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toBeInTheDocument();
  });

  it("test-wallpaper-sheet-retry-keeps-group: tras ENCODE_FAILED, Reintentar redibuja con el mismo grupo", async () => {
    // "Grilla sola" on opening draws; "Con amigos" and the other group fail.
    render$.mockResolvedValueOnce(OK);
    render$.mockResolvedValueOnce({ ok: false, code: "ENCODE_FAILED" });
    render$.mockResolvedValueOnce({ ok: false, code: "ENCODE_FAILED" });
    renderButton(new Set(["fri-flow-1800"]), [LOLLA, FACU], FACU.id);

    const sheet = await openSheet();
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      wallpaperMessageFor("ENCODE_FAILED"),
    );

    // Another group chosen in the sheet, which fails too: the retry draws that one.
    await choose(sheet, LOLLA.id);
    expect(drawnGroup(2)?.name).toBe("Los del Lolla");
    await press(sheet, RETRY_LABEL);

    expect(render$).toHaveBeenCalledTimes(4);
    expect(render$.mock.calls[3]![0]).toStrictEqual(render$.mock.calls[2]![0]);
    expect(options(sheet).group).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toBeInTheDocument();
    expect(file$).toHaveBeenLastCalledWith(BLOB, GROUP_FILE_NAME);
  });

  it("test-wallpaper-sheet-retap-option: tocar la opción que ya está en pantalla no redibuja ni revoca su URL; tras un fallo, tocarla reintenta", async () => {
    renderButton(new Set(["fri-flow-1800"]), [LOLLA], LOLLA.id);

    const sheet = await openSheet();
    // Already on screen after opening: "Grilla sola" does not draw again.
    await press(sheet, PERSONAL_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(2);
    const preview = within(sheet).getByRole("img", { name: LOLLA_ALT });
    expect(preview).toHaveAttribute("src", "blob:wallpaper-2");
    const revoked = revokeObjectURL.mock.calls.length;

    // Already on screen: no further drawing, and the preview's URL stays alive.
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(revoked);
    expect(within(sheet).getByRole("img", { name: LOLLA_ALT })).toHaveAttribute(
      "src",
      "blob:wallpaper-2",
    );

    // "Grilla sola" fails: tapping it again is a retry, not "already on screen".
    render$.mockResolvedValueOnce({ ok: false, code: "ENCODE_FAILED" });
    await press(sheet, PERSONAL_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(3);
    expect(within(sheet).getByRole("alert")).toHaveTextContent(
      wallpaperMessageFor("ENCODE_FAILED"),
    );
    await press(sheet, PERSONAL_OPTION_LABEL);
    expect(render$).toHaveBeenCalledTimes(4);
    expect(drawnGroup(3)).toBeUndefined();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toBeInTheDocument();
  });

  it("test-wallpaper-sheet-late-result-dropped: un redibujo que termina después de cerrar la hoja no se muestra y su URL queda revocada", async () => {
    const finish = deferredRender();
    renderButton(new Set(["fri-flow-1800"]), [LOLLA], LOLLA.id);

    let sheet = await openSheet();
    await finish();
    expect(within(sheet).getByRole("img", { name: PREVIEW_ALT })).toHaveAttribute(
      "src",
      "blob:wallpaper-1",
    );

    // A redraw for "Con amigos", closed before it ends.
    await press(sheet, WITH_FRIENDS_OPTION_LABEL);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wallpaper-1");
    await closeSheet();
    await finish();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Opened again: back to "Grilla sola", drawing it afresh and showing nothing of the dropped one.
    sheet = await openSheet();
    expect(render$).toHaveBeenCalledTimes(3);
    expect(within(sheet).queryByRole("img")).not.toBeInTheDocument();
    expect(options(sheet).personal).toHaveAttribute("aria-pressed", "true");
    expect(options(sheet).group).toHaveAttribute("aria-pressed", "false");
  });

  it("test-wallpaper-sheet-action-sticky: la acción principal queda fija abajo del cuerpo con scroll, opaca y sin doblar la safe area, generando, lista y tras un fallo, con grupo y sin grupo", async () => {
    /** The action's box: the same element in every state, stuck to the bottom of the body. */
    function expectSticky(button: HTMLElement): HTMLElement {
      const box = button.parentElement!;
      // jsdom has no layout: the stickiness is read from the classes.
      expect(box).toHaveClass("sticky", "bottom-0", "bg-card");
      // Inside the body that scrolls, so the preview and the question scroll above it.
      const body = box.closest(".overflow-y-auto");
      expect(body).not.toBeNull();
      expect(body).toHaveClass("overscroll-contain");
      // The drawer already pads the home indicator: neither the box nor the body pads it again.
      expect(box.className).not.toContain("safe-area-inset-bottom");
      expect(body!.className).not.toContain("safe-area-inset-bottom");
      // Still out of the sheet's drag, and 44 px or more.
      expect(button.closest("[data-vaul-no-drag]")).not.toBeNull();
      expect(button).toHaveClass("h-12");
      return box;
    }

    // With a group: generating, failed (Reintentar) and ready keep the same box, no jump.
    const finish = deferredRender();
    renderButton(new Set(["fri-flow-1800"]), [LOLLA, FACU], LOLLA.id);
    let sheet = await openSheet();
    const box = expectSticky(within(sheet).getByRole("button", { name: GENERATING_LABEL }));
    await finish({ ok: false, code: "ENCODE_FAILED" });
    expect(expectSticky(within(sheet).getByRole("button", { name: RETRY_LABEL }))).toBe(box);
    await press(sheet, RETRY_LABEL);
    await finish();
    expect(expectSticky(within(sheet).getByRole("button", { name: DOWNLOAD_IMAGE_LABEL }))).toBe(
      box,
    );
    cleanup();

    // The personal one, without groups, is stuck the same way.
    render$.mockReset();
    render$.mockResolvedValue(OK);
    renderButton();
    sheet = await openSheet();
    expectSticky(within(sheet).getByRole("button", { name: DOWNLOAD_IMAGE_LABEL }));
  });
});
