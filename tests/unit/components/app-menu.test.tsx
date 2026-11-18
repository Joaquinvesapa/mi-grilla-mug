import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppBar, AppMenu } from "@/components/app-menu";
import { readSnapshot, writeSnapshot } from "@/components/device-store";
import { groupChoiceKey } from "@/lib/group-picks";
import { pendingKey, SNAPSHOT_KEY } from "@/lib/offline-selection";

import { SCHEDULE } from "./schedule-fixture";
import { stubMatchMedia } from "./vaul-env";

afterEach(cleanup);
beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function storeCopyAndPending() {
  localStorage.setItem(SNAPSHOT_KEY, "copy-of-ana");
  localStorage.setItem(pendingKey("user-ana"), "pending-of-ana");
  localStorage.setItem(pendingKey("user-beto"), "pending-of-beto");
}

function expectCopyGonePendingsKept() {
  expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  expect(localStorage.getItem(pendingKey("user-ana"))).toBe("pending-of-ana");
  expect(localStorage.getItem(pendingKey("user-beto"))).toBe("pending-of-beto");
}

const GROUP_ID = "11111111-1111-4111-8111-111111111111";
const CHOICE_OF_ANA = JSON.stringify({ version: 1, userId: "user-ana", groupId: GROUP_ID });

/** A real device copy, with a group and its friends' picks, and the group chosen on the grid. */
function storeCopyWithGroups() {
  writeSnapshot({
    version: 1,
    userId: "user-ana",
    userName: "Ana",
    schedule: SCHEDULE,
    savedShowIds: [],
    groups: [
      {
        id: GROUP_ID,
        name: "Los del colegio",
        friends: [{ name: "Beto Gómez", initials: "BG", showIds: ["fri-flow-1800"] }],
      },
    ],
  });
  localStorage.setItem(groupChoiceKey("user-ana"), CHOICE_OF_ANA);
  // Guard: the copy is a valid one, groups included.
  expect(readSnapshot()?.groups).toHaveLength(1);
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Menú" }));
  return screen.getByRole("dialog");
}

describe("AppMenu", () => {
  it("test-app-menu: el botón Menú (44 × 44) abre la hoja con el saludo, la guía y Cerrar sesión", () => {
    render(<AppMenu userName="Ana" logoutAction={vi.fn()} pendingCount={0} />);

    const trigger = screen.getByRole("button", { name: "Menú" });
    // size-11 = 2.75rem = 44 px: jsdom has no layout, so the size is read from its class.
    expect(trigger).toHaveClass("size-11");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const sheet = openMenu();

    expect(within(sheet).getByRole("heading", { name: "Hola, Ana" })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Cómo instalarla" })).toBeInTheDocument();
    // The greeting reads from the left: the header's centred default for bottom sheets is replaced.
    const header = within(sheet).getByRole("heading", { name: "Hola, Ana" }).parentElement;
    expect(header?.className).toContain(
      "group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left",
    );
    expect(header?.className).not.toContain(
      "group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center",
    );
    const logout = within(sheet).getByRole("button", { name: "Cerrar sesión" });
    expect(logout.closest("[data-vaul-no-drag]")).not.toBeNull();
  });

  it("app-menu: la entrada Grupos lleva a /grupos", () => {
    render(<AppMenu userName="Ana" logoutAction={vi.fn()} pendingCount={0} />);

    const groups = within(openMenu()).getByRole("link", { name: "Grupos" });
    expect(groups).toHaveAttribute("href", "/grupos");
    // A tap on it never starts dragging the sheet.
    expect(groups.closest("[data-vaul-no-drag]")).not.toBeNull();
  });

  it("sin cambios pendientes, Cerrar sesión envía el logout directo", async () => {
    const logoutAction = vi.fn(async () => {});
    render(<AppMenu userName="Ana" logoutAction={logoutAction} pendingCount={0} />);

    const sheet = openMenu();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar sesión" }));
    });

    expect(logoutAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("AppMenu sin conexión y la copia del dispositivo", () => {
  it("test-app-menu-logout-clears-copy: los dos caminos de Cerrar sesión borran la copia y no las pendientes", async () => {
    storeCopyAndPending();
    const direct = vi.fn(async () => {});
    render(<AppMenu userName="Ana" logoutAction={direct} pendingCount={0} />);

    const sheet = openMenu();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar sesión" }));
    });
    expect(direct).toHaveBeenCalledTimes(1);
    expectCopyGonePendingsKept();

    cleanup();
    storeCopyAndPending();
    const confirmed = vi.fn(async () => {});
    render(<AppMenu userName="Ana" logoutAction={confirmed} pendingCount={2} />);

    const confirmSheet = openMenu();
    await act(async () => {
      fireEvent.click(within(confirmSheet).getByRole("button", { name: "Cerrar sesión" }));
    });
    // Asking first does not forget anything yet.
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe("copy-of-ana");
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Salir sin guardar" }),
      );
    });
    expect(confirmed).toHaveBeenCalledTimes(1);
    expectCopyGonePendingsKept();
  });

  it("test-logout-clears-groups: los dos caminos de Cerrar sesión borran la copia con los grupos y conservan la elección de grupo (R-03, ADR-008)", async () => {
    storeCopyWithGroups();
    render(<AppMenu userName="Ana" logoutAction={vi.fn(async () => {})} pendingCount={0} />);

    const sheet = openMenu();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar sesión" }));
    });
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
    expect(readSnapshot()).toBeNull();
    expect(localStorage.getItem(groupChoiceKey("user-ana"))).toBe(CHOICE_OF_ANA);

    cleanup();
    storeCopyWithGroups();
    render(<AppMenu userName="Ana" logoutAction={vi.fn(async () => {})} pendingCount={2} />);

    const confirmSheet = openMenu();
    await act(async () => {
      fireEvent.click(within(confirmSheet).getByRole("button", { name: "Cerrar sesión" }));
    });
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Salir sin guardar" }),
      );
    });
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
    expect(localStorage.getItem(groupChoiceKey("user-ana"))).toBe(CHOICE_OF_ANA);
  });

  it("test-app-menu-offline-disabled: sin conexión Cerrar sesión está deshabilitado con su texto y no borra la copia", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    storeCopyAndPending();
    const logoutAction = vi.fn(async () => {});
    render(<AppMenu userName="Ana" logoutAction={logoutAction} pendingCount={0} />);

    const sheet = openMenu();
    const logout = within(sheet).getByRole("button", { name: "Cerrar sesión" });
    expect(logout).toBeDisabled();
    expect(within(sheet).getByText("Necesitás conexión para cerrar sesión.")).toBeInTheDocument();
    expect(logout).toHaveAccessibleDescription("Necesitás conexión para cerrar sesión.");

    await act(async () => {
      fireEvent.click(logout);
    });
    expect(logoutAction).not.toHaveBeenCalled();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBe("copy-of-ana");

    // Back online, it is enabled again and the text goes away.
    await act(async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(within(sheet).getByRole("button", { name: "Cerrar sesión" })).toBeEnabled();
    expect(within(sheet).queryByText("Necesitás conexión para cerrar sesión.")).toBeNull();
  });

  it("test-app-menu-offline-dialog-hint: si se corta la señal con el diálogo abierto, Salir sin guardar queda deshabilitado con su motivo", async () => {
    render(<AppMenu userName="Ana" logoutAction={vi.fn()} pendingCount={1} />);
    const sheet = openMenu();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Cerrar sesión" }));
    });
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Salir sin guardar" })).toBeEnabled();
    expect(within(dialog).queryByText("Necesitás conexión para cerrar sesión.")).toBeNull();

    await act(async () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      window.dispatchEvent(new Event("offline"));
    });

    const leave = within(dialog).getByRole("button", { name: "Salir sin guardar" });
    expect(leave).toBeDisabled();
    expect(within(dialog).getByText("Necesitás conexión para cerrar sesión.")).toBeInTheDocument();
    expect(leave).toHaveAccessibleDescription("Necesitás conexión para cerrar sesión.");
  });

  it("sin conexión y con cambios, el botón que pide confirmar también queda deshabilitado", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<AppMenu userName="Ana" logoutAction={vi.fn()} pendingCount={1} />);

    expect(within(openMenu()).getByRole("button", { name: "Cerrar sesión" })).toBeDisabled();
  });
});

describe("AppBar", () => {
  it("muestra el nombre de la app como título y el menú", () => {
    render(<AppBar userName="Ana" logoutAction={vi.fn()} pendingCount={0} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mi Grilla");
    expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
  });
});
