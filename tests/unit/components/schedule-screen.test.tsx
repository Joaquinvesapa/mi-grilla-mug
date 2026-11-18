import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { type SaveSelection, ScheduleScreen } from "@/components/schedule-screen";
import { pendingKey, SNAPSHOT_KEY } from "@/lib/offline-selection";
import { selectionMessageFor } from "@/lib/selection-messages";

import { blockOf, SCHEDULE } from "./schedule-fixture";
import { stubMatchMedia } from "./vaul-env";

afterEach(cleanup);
beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const USER_ID = "user-ana";
const NOTICE_TITLE = "Guardado solo en este celular";

function renderScreen({
  initialDayId = "fri",
  saved = [] as string[],
  userId = USER_ID,
  mode = "online" as "online" | "offline",
  saveAction = vi.fn<SaveSelection>(async () => ({ ok: true })),
  logoutAction = vi.fn(async () => {}),
} = {}) {
  const view = render(
    <ScheduleScreen
      schedule={SCHEDULE}
      savedShowIds={saved}
      initialDayId={initialDayId}
      userName="Ana"
      userId={userId}
      mode={mode}
      saveAction={saveAction}
      logoutAction={logoutAction}
    />,
  );
  return { ...view, saveAction, logoutAction };
}

/** Lets the effects and the awaited actions run. */
async function settle() {
  await act(async () => {});
}

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

function storePending(userId: string, showIds: string[]) {
  localStorage.setItem(
    pendingKey(userId),
    JSON.stringify({ version: 1, userId, showIds, savedAt: "2026-03-13T21:00:00.000Z" }),
  );
}

function storedPendingIds(userId: string): string[] | null {
  const raw = localStorage.getItem(pendingKey(userId));
  return raw === null ? null : (JSON.parse(raw) as { showIds: string[] }).showIds;
}

function storedSnapshot(): { userId: string; savedShowIds: string[] } | null {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  return raw === null ? null : (JSON.parse(raw) as { userId: string; savedShowIds: string[] });
}

function notice() {
  return screen.queryByRole("status");
}

/** A save action whose answers the test hands out one at a time. */
function deferredAction() {
  const answers: ((result: Awaited<ReturnType<SaveSelection>>) => void)[] = [];
  const saveAction = vi.fn<SaveSelection>(
    () =>
      new Promise((resolve) => {
        answers.push(resolve);
      }),
  );
  async function answer(result: Awaited<ReturnType<SaveSelection>>) {
    await act(async () => {
      answers.shift()?.(result);
    });
  }
  return { saveAction, answer };
}

function tap(showId: string) {
  fireEvent.click(blockOf(document, showId));
}

function pickDay(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
}

function pendingBar() {
  return screen.queryByRole("region", { name: "Cambios sin guardar" });
}

async function press(name: string, scope: HTMLElement = document.body) {
  await act(async () => {
    fireEvent.click(within(scope).getByRole("button", { name }));
  });
}

function beforeUnloadPrevented(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("ScheduleScreen", () => {
  it("test-screen-toggle: tocar un show lo elige y tocarlo de nuevo lo desmarca", () => {
    renderScreen();

    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
    tap("fri-flow-1800");
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    tap("fri-flow-1800");
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
  });

  it("dos toques en la misma tarea suman los dos shows (el borrador no se pisa)", () => {
    renderScreen();

    act(() => {
      fireEvent.click(blockOf(document, "fri-flow-1800"));
      fireEvent.click(blockOf(document, "fri-perrys-1815"));
    });

    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-perrys-1815")).toHaveAttribute("aria-pressed", "true");
    expect(pendingBar()).toHaveTextContent("2 cambios sin guardar");
  });

  it("test-screen-pending-across-days: lo marcado el viernes sigue elegido y pendiente al volver del sábado", () => {
    renderScreen();

    tap("fri-flow-1800");
    pickDay("Sábado");

    expect(screen.getByRole("region", { name: "Grilla del Sábado" })).toBeInTheDocument();
    expect(document.querySelector('[data-show-id="fri-flow-1800"]')).toBeNull();
    expect(blockOf(document, "sat-flow-1800")).toHaveAttribute("aria-pressed", "false");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");

    pickDay("Viernes");

    const block = blockOf(document, "fri-flow-1800");
    expect(block).toHaveAttribute("aria-pressed", "true");
    expect(block).toHaveAttribute("data-pending", "true");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
  });

  it("test-screen-pending-bar: con un cambio aparece el aviso con Guardar y Descartar; sin cambios, no", () => {
    renderScreen({ saved: ["fri-samsung-1700"] });
    expect(pendingBar()).not.toBeInTheDocument();

    tap("fri-flow-1800");
    const bar = pendingBar();
    expect(bar).toHaveTextContent("1 cambio sin guardar");
    expect(within(bar!).getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(within(bar!).getByRole("button", { name: "Descartar" })).toBeInTheDocument();

    // Unchoosing a saved show is a change too.
    tap("fri-samsung-1700");
    expect(pendingBar()).toHaveTextContent("2 cambios sin guardar");

    // Back to exactly what is saved: nothing pending, no bar.
    tap("fri-flow-1800");
    tap("fri-samsung-1700");
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it("test-screen-discard: Descartar vuelve exactamente a la selección guardada", async () => {
    renderScreen({ saved: ["fri-samsung-1700"] });

    tap("fri-samsung-1700");
    tap("fri-flow-1800");
    await press("Descartar");

    expect(blockOf(document, "fri-samsung-1700")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
    expect(blockOf(document, "fri-flow-1800")).not.toHaveAttribute("data-pending");
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it("test-screen-save-ok: Guardar manda el borrador completo y con ok el aviso desaparece", async () => {
    const { saveAction } = renderScreen({ saved: ["sat-flow-1800"] });

    tap("fri-perrys-1815");
    tap("fri-flow-1800");
    await press("Guardar");

    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenCalledWith(
      ["fri-flow-1800", "fri-perrys-1815", "sat-flow-1800"],
      USER_ID,
    );
    expect(pendingBar()).not.toBeInTheDocument();
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-flow-1800")).not.toHaveAttribute("data-pending");
  });

  it("test-screen-save-error: con SERVICE_UNAVAILABLE muestra su mensaje y conserva el borrador", async () => {
    renderScreen({
      saveAction: vi.fn<SaveSelection>(async () => ({ ok: false, code: "SERVICE_UNAVAILABLE" })),
    });

    tap("fri-flow-1800");
    await press("Guardar");

    expect(screen.getByRole("alert")).toHaveTextContent(selectionMessageFor("SERVICE_UNAVAILABLE"));
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");

    // Discarding clears the message along with the draft.
    await press("Descartar");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test-screen-save-offline-pending: si la acción lanza (red caída) la selección queda pendiente en el celular, con el aviso y sin error", async () => {
    renderScreen({
      saved: ["sat-flow-1800"],
      saveAction: vi.fn<SaveSelection>(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });

    tap("fri-flow-1800");
    await press("Guardar");

    expect(storedPendingIds(USER_ID)).toStrictEqual(["fri-flow-1800", "sat-flow-1800"]);
    expect(notice()).toHaveTextContent(NOTICE_TITLE);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Failed to fetch");
    // Saved on the device: it is the user's last save, nothing is pending on screen.
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(pendingBar()).not.toBeInTheDocument();
    // The device copy keeps only what the server confirmed.
    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["sat-flow-1800"]);
  });

  it("test-screen-save-offline-skips-call: sin conexión no llama a la acción y deja la selección pendiente", async () => {
    setOnline(false);
    const { saveAction } = renderScreen();

    tap("fri-flow-1800");
    await press("Guardar");

    expect(saveAction).not.toHaveBeenCalled();
    expect(storedPendingIds(USER_ID)).toStrictEqual(["fri-flow-1800"]);
    expect(notice()).toHaveTextContent(NOTICE_TITLE);
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it("test-screen-save-storage-error: si el celular no deja guardar, muestra STORAGE_UNAVAILABLE y conserva el borrador", async () => {
    setOnline(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    renderScreen();

    tap("fri-flow-1800");
    await press("Guardar");

    expect(screen.getByRole("alert")).toHaveTextContent(selectionMessageFor("STORAGE_UNAVAILABLE"));
    expect(document.body).not.toHaveTextContent("quota");
    expect(notice()).not.toBeInTheDocument();
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
    expect(localStorage.getItem(pendingKey(USER_ID))).toBeNull();
  });

  it("test-screen-sync-on-mount: con una pendiente del usuario arranca en ella, la sincroniza con (ids, userId) y con ok la borra y quita el aviso", async () => {
    storePending(USER_ID, ["fri-flow-1800", "fri-perrys-1815"]);
    const { saveAction, answer } = deferredAction();
    renderScreen({ saved: ["sat-flow-1800"], saveAction });
    await settle();

    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-perrys-1815")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-flow-1800")).not.toHaveAttribute("data-pending");
    expect(notice()).toHaveTextContent(NOTICE_TITLE);
    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenCalledWith(["fri-flow-1800", "fri-perrys-1815"], USER_ID);

    // While it syncs, "Guardar" cannot start a second save (R-05).
    tap("fri-samsung-1700");
    expect(within(pendingBar()!).getByRole("button", { name: "Guardando…" })).toBeDisabled();

    await answer({ ok: true });

    expect(storedPendingIds(USER_ID)).toBeNull();
    expect(notice()).not.toBeInTheDocument();
    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["fri-flow-1800", "fri-perrys-1815"]);
    // The change made meanwhile is still a change, and now it can be saved.
    expect(within(pendingBar()!).getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
  });

  it("test-screen-sync-on-online: sin conexión no sincroniza; el evento online la dispara una sola vez aunque llegue dos veces", async () => {
    setOnline(false);
    storePending(USER_ID, ["fri-flow-1800"]);
    const { saveAction, answer } = deferredAction();
    renderScreen({ saveAction });
    await settle();

    expect(saveAction).not.toHaveBeenCalled();
    expect(notice()).toHaveTextContent(NOTICE_TITLE);

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(1);

    await answer({ ok: true });
    expect(storedPendingIds(USER_ID)).toBeNull();
    expect(notice()).not.toBeInTheDocument();
  });

  it("test-screen-sync-error-retry: con SERVICE_UNAVAILABLE o una excepción la pendiente queda y el siguiente online reintenta", async () => {
    storePending(USER_ID, ["fri-flow-1800"]);
    const saveAction = vi
      .fn<SaveSelection>()
      .mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ ok: true });
    renderScreen({ saveAction });
    await settle();

    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(storedPendingIds(USER_ID)).toStrictEqual(["fri-flow-1800"]);
    expect(notice()).toHaveTextContent(NOTICE_TITLE);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(2);
    expect(storedPendingIds(USER_ID)).toStrictEqual(["fri-flow-1800"]);
    expect(notice()).toHaveTextContent(NOTICE_TITLE);
    expect(document.body).not.toHaveTextContent("Failed to fetch");

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(3);
    expect(storedPendingIds(USER_ID)).toBeNull();
    expect(notice()).not.toBeInTheDocument();
  });

  it("test-screen-sync-invalid-discarded: con INVALID_SELECTION borra la pendiente, vuelve a lo confirmado y muestra su mensaje", async () => {
    storePending(USER_ID, ["fri-flow-1800"]);
    const saveAction = vi.fn<SaveSelection>(async () => ({
      ok: false,
      code: "INVALID_SELECTION",
    }));
    renderScreen({ saved: ["sat-flow-1800"], saveAction });
    await settle();

    expect(storedPendingIds(USER_ID)).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(selectionMessageFor("INVALID_SELECTION"));
    expect(notice()).not.toBeInTheDocument();
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
    expect(pendingBar()).not.toBeInTheDocument();

    // Nothing left to retry.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(1);
  });

  it("test-screen-sync-mismatch-kept: con USER_MISMATCH la pendiente queda para su dueño y no se muestra como selección de esta cuenta", async () => {
    storePending(USER_ID, ["fri-flow-1800"]);
    const saveAction = vi.fn<SaveSelection>(async () => ({ ok: false, code: "USER_MISMATCH" }));
    renderScreen({ saved: ["sat-flow-1800"], saveAction });
    await settle();

    expect(storedPendingIds(USER_ID)).toStrictEqual(["fri-flow-1800"]);
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
    expect(notice()).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(selectionMessageFor("USER_MISMATCH"));

    // Not retried against this session.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(1);
  });

  it("test-screen-other-user-pending-ignored: la pendiente de otra cuenta no se muestra, no se sincroniza y no se toca", async () => {
    storePending("user-a", ["fri-flow-1800"]);
    const { saveAction } = renderScreen({ userId: "user-b" });
    await settle();
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(notice()).not.toBeInTheDocument();
    expect(saveAction).not.toHaveBeenCalled();
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
    expect(storedPendingIds("user-a")).toStrictEqual(["fri-flow-1800"]);
  });

  it("test-screen-sync-skipped-while-saving: un online que llega mientras Guardar espera respuesta no manda la pendiente vieja en paralelo", async () => {
    setOnline(false);
    storePending(USER_ID, ["fri-flow-1800"]);
    const { saveAction, answer } = deferredAction();
    renderScreen({ saveAction });
    await settle();
    expect(saveAction).not.toHaveBeenCalled();

    setOnline(true);
    tap("fri-perrys-1815");
    await press("Guardar");
    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction).toHaveBeenLastCalledWith(["fri-flow-1800", "fri-perrys-1815"], USER_ID);

    // The signal "comes back" while the save is still waiting: the old pending must not race it.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(1);

    await answer({ ok: true });
    expect(storedPendingIds(USER_ID)).toBeNull();
    expect(notice()).not.toBeInTheDocument();

    // Nothing pending is left, so a later online has nothing to send.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(saveAction).toHaveBeenCalledTimes(1);
  });

  it("test-screen-online-save-clears-pending: un Guardar con ok borra una pendiente vieja del usuario", async () => {
    storePending(USER_ID, ["fri-flow-1800"]);
    const saveAction = vi
      .fn<SaveSelection>()
      .mockResolvedValueOnce({ ok: false, code: "SERVICE_UNAVAILABLE" })
      .mockResolvedValueOnce({ ok: true });
    renderScreen({ saveAction });
    await settle();
    expect(storedPendingIds(USER_ID)).toStrictEqual(["fri-flow-1800"]);

    tap("fri-perrys-1815");
    await press("Guardar");

    expect(saveAction).toHaveBeenLastCalledWith(["fri-flow-1800", "fri-perrys-1815"], USER_ID);
    expect(storedPendingIds(USER_ID)).toBeNull();
    expect(notice()).not.toBeInTheDocument();
    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["fri-flow-1800", "fri-perrys-1815"]);
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it("test-screen-writes-snapshot: con mode online escribe la copia con la selección confirmada", async () => {
    renderScreen({ saved: ["fri-flow-1800"] });
    await settle();

    expect(JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null")).toStrictEqual({
      version: 1,
      userId: USER_ID,
      userName: "Ana",
      schedule: SCHEDULE,
      savedShowIds: ["fri-flow-1800"],
    });
  });

  it("con mode offline no escribe la copia al montar", async () => {
    renderScreen({ mode: "offline", saved: ["fri-flow-1800"] });
    await settle();

    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  it("si la copia no se puede escribir al montar, la pantalla funciona igual", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const { saveAction } = renderScreen();
    await settle();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    tap("fri-flow-1800");
    await press("Guardar");
    expect(saveAction).toHaveBeenCalledWith(["fri-flow-1800"], USER_ID);
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it("test-screen-stale-error-cleared: si tras un error el borrador vuelve a lo guardado, el error no reaparece en el próximo cambio", async () => {
    renderScreen({
      saveAction: vi.fn<SaveSelection>(async () => ({ ok: false, code: "SERVICE_UNAVAILABLE" })),
    });

    tap("fri-flow-1800");
    await press("Guardar");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Back to exactly what is saved, by hand: the failure no longer applies to anything.
    tap("fri-flow-1800");
    expect(pendingBar()).not.toBeInTheDocument();

    tap("fri-samsung-1700");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mientras guarda muestra Guardando… y no deja guardar dos veces", async () => {
    let finish: (result: { ok: true }) => void = () => {};
    const saveAction = vi.fn<SaveSelection>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderScreen({ saveAction });

    tap("fri-flow-1800");
    await press("Guardar");

    const busy = within(pendingBar()!).getByRole("button", { name: "Guardando…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(within(pendingBar()!).getByRole("button", { name: "Descartar" })).toBeDisabled();
    await act(async () => {
      fireEvent.click(busy);
    });
    expect(saveAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ ok: true });
    });
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it("un día inicial desconocido cae en el primer día de la grilla", () => {
    renderScreen({ initialDayId: "nope" });

    expect(screen.getByRole("region", { name: "Grilla del Viernes" })).toBeInTheDocument();
  });

  it("test-screen-leave-confirm: con pendientes Cerrar sesión pide confirmar; sin pendientes sale directo", async () => {
    const { logoutAction } = renderScreen();

    tap("fri-flow-1800");
    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    await press("Cerrar sesión", screen.getByRole("dialog"));

    const confirm = screen.getByRole("alertdialog");
    expect(confirm).toHaveTextContent("1 cambio sin guardar");
    expect(logoutAction).not.toHaveBeenCalled();

    await press("Seguir editando", confirm);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(logoutAction).not.toHaveBeenCalled();
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");

    await press("Cerrar sesión", screen.getByRole("dialog"));
    await press("Salir sin guardar", screen.getByRole("alertdialog"));
    expect(logoutAction).toHaveBeenCalledTimes(1);

    cleanup();
    const clean = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Menú" }));
    await press("Cerrar sesión", screen.getByRole("dialog"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(clean.logoutAction).toHaveBeenCalledTimes(1);
  });

  it("test-screen-beforeunload: el aviso de salida está registrado solo mientras hay pendientes", async () => {
    renderScreen();
    expect(beforeUnloadPrevented()).toBe(false);

    tap("fri-flow-1800");
    expect(beforeUnloadPrevented()).toBe(true);

    await press("Descartar");
    expect(beforeUnloadPrevented()).toBe(false);

    tap("fri-flow-1800");
    cleanup();
    // Unmounted, the handler is gone too.
    expect(beforeUnloadPrevented()).toBe(false);
  });

  it("marca el choque en los dos shows elegidos que se superponen, no en los que solo se tocan", () => {
    renderScreen();

    tap("fri-samsung-1700");
    tap("fri-flow-1800");
    expect(within(blockOf(document, "fri-flow-1800")).queryByText(/Choca/)).toBeNull();

    tap("fri-perrys-1815");
    expect(within(blockOf(document, "fri-flow-1800")).getByText(/Choca/)).toBeInTheDocument();
    expect(within(blockOf(document, "fri-perrys-1815")).getByText(/Choca/)).toBeInTheDocument();
    expect(within(blockOf(document, "fri-samsung-1700")).queryByText(/Choca/)).toBeNull();
  });
});
