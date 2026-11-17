import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { OfflineApp } from "@/components/offline-app";
import { selectionMessageFor } from "@/lib/selection-messages";
import type { SaveSelection } from "@/components/schedule-screen";
import { pendingKey, SNAPSHOT_KEY } from "@/lib/offline-selection";

import { blockOf, SCHEDULE } from "./schedule-fixture";
import { stubMatchMedia } from "./vaul-env";

// The retry's reload is not observable in jsdom: the real OfflineRetry, with a spy as its reload.
const reloadSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/offline-retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/offline-retry")>();
  return {
    OfflineRetry: () => <actual.OfflineRetry onReload={reloadSpy} />,
  };
});

const USER_ID = "user-ana";
const NOTICE_TITLE = "Guardado solo en este celular";

beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  reloadSpy.mockClear();
  // Back to the URL the service worker answers for the grid.
  window.history.replaceState(null, "", "/");
});

function storeSnapshot(savedShowIds: string[]) {
  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({
      version: 1,
      userId: USER_ID,
      userName: "Ana",
      schedule: SCHEDULE,
      savedShowIds,
    }),
  );
}

function storePending(userId: string, showIds: string[]) {
  localStorage.setItem(
    pendingKey(userId),
    JSON.stringify({ version: 1, userId, showIds, savedAt: "2026-03-13T21:00:00.000Z" }),
  );
}

function renderApp(saveAction = vi.fn<SaveSelection>(async () => ({ ok: true }))) {
  const logoutAction = vi.fn(async () => {});
  render(<OfflineApp saveAction={saveAction} logoutAction={logoutAction} />);
  return { saveAction };
}

/** Lets the effects and the awaited actions run. */
async function settle() {
  await act(async () => {});
}

function offlineHeading() {
  return screen.queryByRole("heading", { level: 1, name: "Sin conexión" });
}

function gridOf(dayName: string) {
  return screen.queryByRole("region", { name: `Grilla del ${dayName}` });
}

describe("OfflineApp", () => {
  it("test-offline-app-grid: con copia válida y pathname /, se ve la grilla con la selección confirmada marcada", () => {
    storeSnapshot(["fri-flow-1800"]);

    renderApp();

    expect(offlineHeading()).not.toBeInTheDocument();
    // Outside the festival the real clock opens on the first day.
    expect(gridOf("Viernes")).toBeInTheDocument();
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-samsung-1700")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("heading", { level: 1, name: "Mi Grilla" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("test-offline-app-pending-first: con copia y pendiente del mismo usuario, se ve la pendiente y el aviso", () => {
    // No signal: nothing to sync, the pending selection stays on screen.
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    storeSnapshot(["fri-flow-1800"]);
    storePending(USER_ID, ["fri-perrys-1815"]);

    const { saveAction } = renderApp();

    expect(blockOf(document, "fri-perrys-1815")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent(NOTICE_TITLE);
    expect(saveAction).not.toHaveBeenCalled();
  });

  it('test-offline-app-missing-copy: sin copia (faltante) se ve "Sin conexión"', () => {
    renderApp();

    expect(offlineHeading()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(gridOf("Viernes")).not.toBeInTheDocument();
  });

  it('test-offline-app-invalid-copy: con una copia inválida se ve "Sin conexión"', () => {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        version: 1,
        userId: USER_ID,
        userName: "Ana",
        schedule: SCHEDULE,
        // Not in the grid: the whole copy is rejected.
        savedShowIds: ["no-existe"],
      }),
    );

    renderApp();

    expect(offlineHeading()).toBeInTheDocument();
    expect(gridOf("Viernes")).not.toBeInTheDocument();
  });

  it("test-offline-app-other-path-rejected: con copia y pathname /login, la grilla se rechaza y se ve la tarjeta", () => {
    storeSnapshot(["fri-flow-1800"]);
    window.history.replaceState(null, "", "/login");

    renderApp();

    expect(offlineHeading()).toBeInTheDocument();
    expect(gridOf("Viernes")).not.toBeInTheDocument();
  });

  it("en el servidor (y al hidratar) es una pantalla vacía y ocupada, sin grilla ni tarjeta", () => {
    storeSnapshot(["fri-flow-1800"]);

    const html = renderToString(
      <OfflineApp saveAction={vi.fn<SaveSelection>()} logoutAction={vi.fn()} />,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("app-fixed-screen");
    expect(html).not.toContain("Sin conexión");
    expect(html).not.toContain("data-show-id");
  });

  it("test-offline-app-sync-rejected-back-to-confirmed: si la sincronización da INVALID_SELECTION, vuelve a la selección confirmada de la copia, no a la pendiente", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    storeSnapshot(["fri-flow-1800"]);
    storePending(USER_ID, ["fri-perrys-1815"]);
    const saveAction = vi.fn<SaveSelection>(async () => ({
      ok: false,
      code: "INVALID_SELECTION",
    }));

    renderApp(saveAction);
    await settle();

    // Guard: the pending selection was the one synced, and rejected.
    expect(saveAction).toHaveBeenCalledWith(["fri-perrys-1815"], USER_ID);
    expect(screen.getByRole("alert")).toHaveTextContent(selectionMessageFor("INVALID_SELECTION"));
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(blockOf(document, "fri-perrys-1815")).toHaveAttribute("aria-pressed", "false");
  });

  it("test-offline-app-does-not-write-copy: montar la grilla desde la copia no vuelve a escribir la copia", async () => {
    storeSnapshot(["fri-flow-1800"]);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    renderApp();
    await settle();

    // Guard: the grid is on screen, built from the copy.
    expect(gridOf("Viernes")).toBeInTheDocument();
    expect(setItem.mock.calls.filter(([key]) => key === SNAPSHOT_KEY)).toStrictEqual([]);
  });

  it("test-offline-app-real-clock-day: con el reloj real en el sábado del festival, abre la grilla del sábado", () => {
    // Only `Date` is faked: React's scheduling keeps its real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    // Saturday 20:00 in Buenos Aires (UTC-3).
    vi.setSystemTime(new Date("2026-03-14T23:00:00.000Z"));
    storeSnapshot([]);

    renderApp();

    expect(gridOf("Sábado")).toBeInTheDocument();
    expect(gridOf("Viernes")).not.toBeInTheDocument();
  });

  it("test-offline-app-grid-no-reload: con la grilla, volver la señal no recarga la página", async () => {
    storeSnapshot(["fri-flow-1800"]);
    renderApp();
    expect(gridOf("Viernes")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(reloadSpy).not.toHaveBeenCalled();

    // Guard: the card, on the other hand, does reload with the same event and the same spy.
    cleanup();
    localStorage.clear();
    renderApp();
    expect(offlineHeading()).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
