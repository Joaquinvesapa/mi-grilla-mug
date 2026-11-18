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
import {
  DOWNLOAD_IMAGE_LABEL,
  GENERATING_LABEL,
  RETRY_LABEL,
  SAVE_TO_PHOTOS_LABEL,
  WALLPAPER_BUTTON_LABEL,
  WALLPAPER_DONE_LABEL,
  WALLPAPER_GUIDE_STEPS,
  WALLPAPER_SHEET_TITLE,
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

function renderButton(selectedIds: ReadonlySet<string> = new Set(["fri-flow-1800"])) {
  return render(
    <WallpaperButton day={FRIDAY} stages={STAGES} shows={FRIDAY_SHOWS} selectedIds={selectedIds} />,
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
