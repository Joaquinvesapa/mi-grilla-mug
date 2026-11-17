import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { type SaveSelection, ScheduleScreen } from "@/components/schedule-screen";
import { selectionMessageFor } from "@/lib/selection-messages";

import { blockOf, SCHEDULE } from "./schedule-fixture";
import { stubMatchMedia } from "./vaul-env";

afterEach(cleanup);
beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});

function renderScreen({
  initialDayId = "fri",
  saved = [] as string[],
  saveAction = vi.fn<SaveSelection>(async () => ({ ok: true })),
  logoutAction = vi.fn(async () => {}),
} = {}) {
  const view = render(
    <ScheduleScreen
      schedule={SCHEDULE}
      savedShowIds={saved}
      initialDayId={initialDayId}
      userName="Ana"
      saveAction={saveAction}
      logoutAction={logoutAction}
    />,
  );
  return { ...view, saveAction, logoutAction };
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
    expect(saveAction).toHaveBeenCalledWith(["fri-flow-1800", "fri-perrys-1815", "sat-flow-1800"]);
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

  it("test-screen-save-network-error: si la acción lanza (red caída) muestra NETWORK_ERROR y conserva el borrador", async () => {
    renderScreen({
      saveAction: vi.fn<SaveSelection>(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });

    tap("fri-flow-1800");
    await press("Guardar");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(selectionMessageFor("NETWORK_ERROR"));
    expect(alert).not.toHaveTextContent("Failed to fetch");
    expect(blockOf(document, "fri-flow-1800")).toHaveAttribute("aria-pressed", "true");
    expect(pendingBar()).toHaveTextContent("1 cambio sin guardar");
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
