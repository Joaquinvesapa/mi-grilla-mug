import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetDemoClockForTests } from "@/components/demo-clock";
import { type SaveSelection, ScheduleScreen } from "@/components/schedule-screen";
import { renderWallpaper } from "@/components/wallpaper-canvas";
import { DEMO_CLOCK_MESSAGE } from "@/lib/demo-clock";
import { GROUP_PICKER_LABEL, NO_GROUP_OPTION } from "@/lib/group-messages";
import { groupChoiceKey, type GroupPicks } from "@/lib/group-picks";
import { CLOSE_LABEL, LIVE_LABEL, SELECTED_LABEL } from "@/lib/live-messages";
import { pendingKey, SNAPSHOT_KEY } from "@/lib/offline-selection";
import { selectionMessageFor } from "@/lib/selection-messages";
import { WALLPAPER_BUTTON_LABEL, WITH_FRIENDS_OPTION_LABEL } from "@/lib/wallpaper-messages";

import { blockOf, SCHEDULE, showsOf } from "./schedule-fixture";
import { endVaulCloseAnimation, stubMatchMedia } from "./vaul-env";

// jsdom has no canvas: the wallpaper's drawing is a fake (Block 2 tests the real one).
vi.mock("@/components/wallpaper-canvas", () => ({ renderWallpaper: vi.fn() }));

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

/** Two groups, the most recent first, as `listGroupPicks` returns them. */
const COLEGIO_ID = "11111111-1111-4111-8111-111111111111";
const FACU_ID = "22222222-2222-4222-8222-222222222222";
const GROUPS: GroupPicks[] = [
  {
    id: COLEGIO_ID,
    name: "Los del colegio",
    friends: [
      { name: "Beto Gómez", initials: "BG", showIds: ["fri-flow-1800", "fri-samsung-1700"] },
      { name: "Caro Díaz", initials: "CD", showIds: ["fri-flow-1800"] },
    ],
  },
  {
    id: FACU_ID,
    name: "Facu y amigos",
    friends: [{ name: "Facu Ruiz", initials: "FR", showIds: ["fri-perrys-1815"] }],
  },
];

function renderScreen({
  initialDayId = "fri",
  saved = [] as string[],
  userId = USER_ID,
  mode = "online" as "online" | "offline",
  groups = [] as GroupPicks[] | null,
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
      groups={groups}
      saveAction={saveAction}
      logoutAction={logoutAction}
    />,
  );
  return { ...view, saveAction, logoutAction };
}

function picker() {
  return screen.queryByRole("combobox", { name: GROUP_PICKER_LABEL });
}

/** The initials a show's block shows, in order; empty when it has none. */
function initialsOn(showId: string): string[] {
  const row = blockOf(document, showId).querySelector("[data-friend-picks]");
  return row ? [...row.children].map((chip) => chip.textContent ?? "") : [];
}

function storeChoice(userId: string, groupId: string | null) {
  localStorage.setItem(groupChoiceKey(userId), JSON.stringify({ version: 1, userId, groupId }));
}

function storedChoice(userId: string): unknown {
  return JSON.parse(localStorage.getItem(groupChoiceKey(userId)) ?? "null");
}

function storedGroups(): unknown {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  return raw === null ? null : (JSON.parse(raw) as { groups: unknown }).groups;
}

function storeCopyOf(userId: string, groups: GroupPicks[]) {
  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({
      version: 1,
      userId,
      userName: "Ana",
      schedule: SCHEDULE,
      savedShowIds: [],
      groups,
    }),
  );
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
      groups: [],
    });
  });

  it("test-screen-writes-snapshot: la copia lleva los grupos que recibió la pantalla, en los tres caminos que la escriben", async () => {
    renderScreen({ saved: ["fri-flow-1800"], groups: GROUPS });
    await settle();

    expect(JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null")).toStrictEqual({
      version: 1,
      userId: USER_ID,
      userName: "Ana",
      schedule: SCHEDULE,
      savedShowIds: ["fri-flow-1800"],
      groups: GROUPS,
    });

    // A save with ok writes the copy again, with the same groups.
    localStorage.removeItem(SNAPSHOT_KEY);
    tap("fri-perrys-1815");
    await press("Guardar");
    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["fri-flow-1800", "fri-perrys-1815"]);
    expect(storedGroups()).toStrictEqual(GROUPS);
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

describe("ScheduleScreen y el fondo de pantalla", () => {
  // The drawing is a fake that fails right away: only what the screen hands the button matters.
  beforeEach(() => {
    vi.mocked(renderWallpaper).mockReset();
    vi.mocked(renderWallpaper).mockResolvedValue({ ok: false, code: "ENCODE_FAILED" });
  });

  async function openWallpaper() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: WALLPAPER_BUTTON_LABEL }));
    });
  }

  function wallpaperInput() {
    expect(renderWallpaper).toHaveBeenCalledTimes(1);
    return vi.mocked(renderWallpaper).mock.calls[0]![0];
  }

  it("test-schedule-screen-wallpaper-unsaved: marcar un show sin Guardar y abrir el fondo pasa ese id en selectedIds", async () => {
    renderScreen({ saved: ["sat-flow-1800"] });

    tap("fri-flow-1800");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
    await openWallpaper();

    const input = wallpaperInput();
    expect(input.day.id).toBe("fri");
    expect(input.stages).toBe(SCHEDULE.stages);
    expect(input.shows.map((show) => show.id)).toStrictEqual(showsOf("fri").map((show) => show.id));
    expect([...input.selectedIds].sort()).toStrictEqual(["fri-flow-1800", "sat-flow-1800"]);
  });

  it("test-schedule-screen-wallpaper-pending: con una selección pendiente del usuario en el celular, el fondo recibe esa selección", async () => {
    storePending(USER_ID, ["fri-perrys-1815"]);
    setOnline(false);
    renderScreen({ saved: ["fri-flow-1800"], mode: "offline" });
    await settle();

    await openWallpaper();

    expect([...wallpaperInput().selectedIds]).toStrictEqual(["fri-perrys-1815"]);
  });

  it("el botón del fondo sigue al día en pantalla", async () => {
    renderScreen();

    pickDay("Sábado");
    await openWallpaper();

    const input = wallpaperInput();
    expect(input.day.id).toBe("sat");
    expect(input.shows.map((show) => show.id)).toStrictEqual(["sat-flow-1800"]);
  });

  /** With groups the sheet opens on «Grilla sola»: «Con amigos» is a second drawing. */
  async function pressWithFriends() {
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: WITH_FRIENDS_OPTION_LABEL }),
      );
    });
  }

  /** The group's drawing: the second one, after the personal one drawn on opening. */
  function groupInput() {
    expect(renderWallpaper).toHaveBeenCalledTimes(2);
    expect(vi.mocked(renderWallpaper).mock.calls[0]![0]).not.toHaveProperty("group");
    return vi.mocked(renderWallpaper).mock.calls[1]![0];
  }

  it("test-schedule-screen-wallpaper-groups: el fondo recibe los grupos y el grupo del selector de la grilla", async () => {
    storeChoice(USER_ID, FACU_ID);
    renderScreen({ groups: GROUPS });
    await settle();
    expect(picker()).toHaveValue(FACU_ID);

    // With groups the sheet opens on «Grilla sola» and draws it at once (color-en-vivo, S7).
    await openWallpaper();
    await pressWithFriends();

    const input = groupInput();
    expect(input.group?.name).toBe("Facu y amigos");
    expect([...(input.group?.friendsByShow.keys() ?? [])]).toStrictEqual(["fri-perrys-1815"]);
  });

  it('test-schedule-screen-wallpaper-groups: con "Sin grupo" en la grilla, el fondo usa el grupo más reciente', async () => {
    storeChoice(USER_ID, null);
    renderScreen({ groups: GROUPS });
    await settle();

    await openWallpaper();
    await pressWithFriends();

    expect(groupInput().group?.name).toBe("Los del colegio");
  });

  it("test-schedule-screen-wallpaper-groups: en modo offline, con los grupos de la copia del dispositivo, el fondo ofrece el del grupo", async () => {
    setOnline(false);
    // `/~offline` hands the screen the groups of the device copy (offline-app.tsx).
    renderScreen({ mode: "offline", saved: ["fri-flow-1800"], groups: [GROUPS[1]!] });
    await settle();

    await openWallpaper();
    await pressWithFriends();

    const input = groupInput();
    expect(input.group?.name).toBe("Facu y amigos");
    expect([...input.selectedIds]).toStrictEqual(["fri-flow-1800"]);
  });

  it("test-schedule-screen-wallpaper-groups: con groups null el fondo personal se genera al abrir, sin pregunta", async () => {
    renderScreen({ groups: null });

    await openWallpaper();

    expect(wallpaperInput()).not.toHaveProperty("group");
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: WITH_FRIENDS_OPTION_LABEL }),
    ).toBeNull();
  });
});

describe('ScheduleScreen y el panel "En vivo"', () => {
  beforeEach(() => {
    // Only `Date`, at 18:30 of Friday: DJO plays on Flow and Easykid on Perry's.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-03-13T18:30:00-03:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function openLive(): Promise<HTMLElement> {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: LIVE_LABEL }));
    });
    return screen.getByRole("dialog", { name: LIVE_LABEL });
  }

  function stageOrder(panel: HTMLElement): (string | undefined)[] {
    return [...panel.querySelectorAll<HTMLElement>("[data-live-stage]")].map(
      (row) => row.dataset.liveStage,
    );
  }

  it("schedule-screen: abrir y cerrar el panel no cambia el día ni los cambios pendientes", async () => {
    renderScreen();
    pickDay("Sábado");
    tap("sat-flow-1800");
    const grid = screen.getByRole("region", { name: "Grilla del Sábado" });

    const panel = await openLive();
    await act(async () => {
      fireEvent.click(within(panel).getByRole("button", { name: CLOSE_LABEL }));
    });
    await act(async () => {
      endVaulCloseAnimation(panel);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sábado" })).toHaveAttribute("aria-selected", "true");
    expect(blockOf(document, "sat-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
    // The same grid node: it was never unmounted, so its scroll position is kept (AC-03).
    expect(screen.getByRole("region", { name: "Grilla del Sábado" })).toBe(grid);
  });

  it("schedule-screen: el panel usa el draft sin guardar", async () => {
    renderScreen();
    tap("fri-perrys-1815");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");

    const panel = await openLive();

    // Easykid is chosen but unsaved: Perry's goes first, with the mark (FR-09).
    expect(stageOrder(panel)).toStrictEqual([
      "perrys",
      "flow",
      "samsung",
      "alternative",
      "kidzapalooza",
    ]);
    const easykid = panel.querySelector<HTMLElement>('[data-live-stage="perrys"] [data-live-now]');
    expect(easykid).toHaveTextContent("Easykid");
    const perrysStatus = panel.querySelector<HTMLElement>(
      '[data-live-stage="perrys"] [data-live-status]',
    );
    expect(within(perrysStatus!).getByText(SELECTED_LABEL)).toBeInTheDocument();
  });

  it("schedule-screen: en modo offline el botón también está", async () => {
    setOnline(false);
    renderScreen({ mode: "offline", saved: ["fri-flow-1800"] });
    await settle();

    const panel = await openLive();

    const djo = panel.querySelector<HTMLElement>('[data-live-stage="flow"] [data-live-now]');
    expect(djo).toHaveTextContent("DJO");
    const flowStatus = panel.querySelector<HTMLElement>(
      '[data-live-stage="flow"] [data-live-status]',
    );
    expect(within(flowStatus!).getByText(SELECTED_LABEL)).toBeInTheDocument();
    expect(stageOrder(panel)[0]).toBe("flow");
  });
});

describe("ScheduleScreen y el grupo", () => {
  function choose(groupId: string) {
    fireEvent.change(picker()!, { target: { value: groupId } });
  }

  it("test-picker-hidden-without-groups: sin grupos no hay selector ni iniciales", async () => {
    renderScreen({ groups: [] });
    await settle();

    expect(picker()).not.toBeInTheDocument();
    expect(document.querySelector("[data-friend-picks]")).toBeNull();

    // Groups that could not be loaded: the grid is there, without the picker either.
    cleanup();
    renderScreen({ groups: null });
    await settle();

    expect(screen.getByRole("region", { name: "Grilla del Viernes" })).toBeInTheDocument();
    expect(picker()).not.toBeInTheDocument();
    expect(document.querySelector("[data-friend-picks]")).toBeNull();
  });

  it("test-screen-friend-initials: con el grupo elegido, la pantalla pasa sus amigos a la grilla", async () => {
    renderScreen({ groups: GROUPS });
    await settle();

    // The picker sits between the bar and the days.
    const select = picker()!;
    const bar = screen.getByRole("heading", { level: 1, name: "Mi Grilla" });
    const days = screen.getByRole("tablist");
    expect(bar.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select.compareDocumentPosition(days) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(initialsOn("fri-flow-1800")).toStrictEqual(["BG", "CD"]);
    expect(initialsOn("fri-samsung-1700")).toStrictEqual(["BG"]);
    expect(initialsOn("fri-perrys-1815")).toStrictEqual([]);
    expect(blockOf(document, "fri-flow-1800")).toHaveAccessibleDescription(
      /Lo eligieron: Beto Gómez, Caro Díaz/,
    );

    choose(FACU_ID);

    expect(select).toHaveValue(FACU_ID);
    expect(initialsOn("fri-flow-1800")).toStrictEqual([]);
    expect(initialsOn("fri-perrys-1815")).toStrictEqual(["FR"]);
    // The picker only changes the view: nothing is sent to the server.
    expect(pendingBar()).not.toBeInTheDocument();
  });

  it('test-picker-no-group: "Sin grupo" saca las iniciales de la grilla', async () => {
    renderScreen({ groups: GROUPS });
    await settle();
    expect(initialsOn("fri-flow-1800")).toStrictEqual(["BG", "CD"]);

    fireEvent.change(picker()!, { target: { value: "" } });

    expect(picker()).toHaveValue("");
    expect(within(picker()!).getByRole("option", { name: NO_GROUP_OPTION })).toHaveProperty(
      "selected",
      true,
    );
    expect(document.querySelector("[data-friend-picks]")).toBeNull();
    expect(storedChoice(USER_ID)).toStrictEqual({ version: 1, userId: USER_ID, groupId: null });
  });

  it("test-picker-remembers: el grupo elegido se guarda y al volver a montar se adopta", async () => {
    renderScreen({ groups: GROUPS });
    await settle();

    choose(FACU_ID);
    expect(storedChoice(USER_ID)).toStrictEqual({ version: 1, userId: USER_ID, groupId: FACU_ID });

    cleanup();
    renderScreen({ groups: GROUPS });
    await settle();

    expect(picker()).toHaveValue(FACU_ID);
    expect(initialsOn("fri-perrys-1815")).toStrictEqual(["FR"]);

    // "Sin grupo" is remembered too.
    fireEvent.change(picker()!, { target: { value: "" } });
    cleanup();
    renderScreen({ groups: GROUPS });
    await settle();

    expect(picker()).toHaveValue("");
    expect(document.querySelector("[data-friend-picks]")).toBeNull();
  });

  it("test-picker-remembers: si el celular no deja guardar la elección, el grupo elegido igual se ve", async () => {
    renderScreen({ groups: GROUPS });
    await settle();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    choose(FACU_ID);

    expect(picker()).toHaveValue(FACU_ID);
    expect(initialsOn("fri-perrys-1815")).toStrictEqual(["FR"]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test-picker-default-latest: sin elección guardada se muestra el grupo más reciente", async () => {
    renderScreen({ groups: GROUPS });
    await settle();
    expect(picker()).toHaveValue(COLEGIO_ID);

    // A group the user is no longer in: the most recent one again (R-05).
    cleanup();
    storeChoice(USER_ID, "33333333-3333-4333-8333-333333333333");
    renderScreen({ groups: GROUPS });
    await settle();
    expect(picker()).toHaveValue(COLEGIO_ID);
    expect(initialsOn("fri-flow-1800")).toStrictEqual(["BG", "CD"]);

    // Another account's choice is not this user's.
    cleanup();
    localStorage.clear();
    storeChoice("user-beto", FACU_ID);
    renderScreen({ groups: GROUPS });
    await settle();
    expect(picker()).toHaveValue(COLEGIO_ID);
  });

  it("test-screen-keeps-copy-groups: con groups null, la copia conserva los grupos anteriores del mismo usuario y queda vacía para otra cuenta", async () => {
    storeCopyOf(USER_ID, [GROUPS[1]!]);
    const { saveAction } = renderScreen({ groups: null, saved: ["fri-flow-1800"] });
    await settle();

    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["fri-flow-1800"]);
    expect(storedGroups()).toStrictEqual([GROUPS[1]]);
    // Not shown: the groups of the copy only travel with it.
    expect(picker()).not.toBeInTheDocument();

    // A save with ok keeps them too.
    tap("fri-perrys-1815");
    await press("Guardar");
    expect(saveAction).toHaveBeenCalled();
    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["fri-flow-1800", "fri-perrys-1815"]);
    expect(storedGroups()).toStrictEqual([GROUPS[1]]);

    // Another account's copy: its groups are not this user's.
    cleanup();
    storeCopyOf("user-beto", GROUPS);
    renderScreen({ groups: null });
    await settle();
    expect(storedSnapshot()?.userId).toBe(USER_ID);
    expect(storedGroups()).toStrictEqual([]);

    // No copy at all.
    cleanup();
    localStorage.clear();
    renderScreen({ groups: null });
    await settle();
    expect(storedGroups()).toStrictEqual([]);
  });

  it("test-screen-keeps-copy-groups: la sincronización de una pendiente también escribe los grupos conservados", async () => {
    setOnline(true);
    storeCopyOf(USER_ID, [GROUPS[1]!]);
    storePending(USER_ID, ["fri-perrys-1815"]);
    const { saveAction } = renderScreen({ groups: null });
    await settle();

    expect(saveAction).toHaveBeenCalledWith(["fri-perrys-1815"], USER_ID);
    expect(storedSnapshot()?.savedShowIds).toStrictEqual(["fri-perrys-1815"]);
    expect(storedGroups()).toStrictEqual([GROUPS[1]]);
  });
});

describe("ScheduleScreen y el reloj de /demo", () => {
  const ORIGINAL_PARENT = Object.getOwnPropertyDescriptor(window, "parent");
  const SATURDAY_18_00 = Date.parse("2026-03-14T18:00:00-03:00");
  const SUNDAY_23_00 = Date.parse("2026-03-15T23:00:00-03:00");

  afterEach(() => {
    cleanup();
    resetDemoClockForTests();
    if (ORIGINAL_PARENT) {
      Object.defineProperty(window, "parent", ORIGINAL_PARENT);
    } else {
      // `parent` lives on the prototype: dropping the own property restores jsdom's.
      delete (window as { parent?: unknown }).parent;
    }
  });

  /** The app framed by `/demo` of its own origin (`parent` is read-only in jsdom). */
  function setDemoParent() {
    const parent = { location: { pathname: "/demo" }, postMessage: vi.fn() };
    Object.defineProperty(window, "parent", { configurable: true, get: () => parent });
    return parent;
  }

  /** `/demo` (or whoever `source` is) sends a time. */
  function sendClock(at: number, source: unknown) {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: DEMO_CLOCK_MESSAGE, at },
          origin: window.location.origin,
          source: source as MessageEventSource,
        }),
      );
    });
  }

  function selectedTab(): string | null {
    return screen.getByRole("tab", { selected: true }).textContent;
  }

  it("schedule-screen: el día inicial sale del reloj de /demo", () => {
    const parent = setDemoParent();
    renderScreen({ initialDayId: "fri" });
    // Before /demo answers, the day of the props.
    expect(selectedTab()).toBe("Viernes");

    // The first time that arrives sets the day: Saturday 18:00 opens Saturday (AC-18).
    sendClock(SATURDAY_18_00, parent);
    expect(screen.getByRole("region", { name: "Grilla del Sábado" })).toBeInTheDocument();
    expect(selectedTab()).toBe("Sábado");

    // Later changes of the clock do not move the tab: "initial day" is literal.
    sendClock(SUNDAY_23_00, parent);
    expect(selectedTab()).toBe("Sábado");

    // Opened again (another screen of the iPhone, or a reload): the store's time at mount.
    cleanup();
    renderScreen({ initialDayId: "fri" });
    expect(screen.getByRole("region", { name: "Grilla del Domingo" })).toBeInTheDocument();

    // A day the user picked before the first time arrives is kept.
    cleanup();
    resetDemoClockForTests();
    renderScreen({ initialDayId: "fri" });
    pickDay("Domingo");
    sendClock(SATURDAY_18_00, parent);
    expect(selectedTab()).toBe("Domingo");
  });

  it("schedule-screen: sin reloj de /demo, el padre faltante deja el día de las props", () => {
    // No frame at all (jsdom: `parent === window`): nobody listens, so a message changes nothing.
    renderScreen({ initialDayId: "sat" });
    sendClock(SUNDAY_23_00, window);
    expect(selectedTab()).toBe("Sábado");
    cleanup();

    // Inside /demo, a time that falls on no day of this grid leaves the day of the props.
    const parent = setDemoParent();
    render(
      <ScheduleScreen
        schedule={{ ...SCHEDULE, days: SCHEDULE.days.filter((day) => day.id !== "sun") }}
        savedShowIds={[]}
        initialDayId="sat"
        userName="Ana"
        userId={USER_ID}
        mode="online"
        groups={[]}
        saveAction={vi.fn<SaveSelection>(async () => ({ ok: true }))}
        logoutAction={vi.fn(async () => {})}
      />,
    );
    sendClock(SUNDAY_23_00, parent);
    expect(selectedTab()).toBe("Sábado");
    expect(screen.getByRole("region", { name: "Grilla del Sábado" })).toBeInTheDocument();
  });
});
