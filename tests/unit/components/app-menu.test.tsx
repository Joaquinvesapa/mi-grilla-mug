import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppBar, AppMenu } from "@/components/app-menu";

import { stubMatchMedia } from "./vaul-env";

afterEach(cleanup);
beforeAll(stubMatchMedia);
afterAll(() => {
  vi.unstubAllGlobals();
});

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

describe("AppBar", () => {
  it("muestra el nombre de la app como título y el menú", () => {
    render(<AppBar userName="Ana" logoutAction={vi.fn()} pendingCount={0} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mi Grilla");
    expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
  });
});
