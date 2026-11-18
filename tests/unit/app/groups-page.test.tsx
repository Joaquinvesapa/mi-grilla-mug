import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The page with its services simulated: what `/grupos` renders depends only on what they return.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listGroups: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/accounts", () => ({
  getAccounts: () => ({ getCurrentUser: mocks.getCurrentUser }),
}));
vi.mock("@/server/groups", () => ({ listGroups: mocks.listGroups }));
vi.mock("@/app/group-actions", () => ({ createGroupAction: vi.fn() }));

const { default: GroupsPage } = await import("@/app/grupos/page");

const USER = { id: "user-1", name: "Ana Pérez", email: "ana@mail.com" };
const LOLLA_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const PRIMOS_ID = "1c7a8d2f-3e4b-4c6d-9e0f-1a2b3c4d5e6f";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(USER);
});

afterEach(cleanup);

describe("GroupsPage", () => {
  it("groups-page: lista todos los grupos del usuario", async () => {
    mocks.listGroups.mockResolvedValue({
      ok: true,
      groups: [
        {
          id: LOLLA_ID,
          name: "Los del Lolla",
          members: [
            { name: "Ana Pérez", initials: "AP", isAdmin: true },
            { name: "Bruno", initials: "BR", isAdmin: false },
          ],
        },
        {
          id: PRIMOS_ID,
          name: "Primos",
          members: [{ name: "Ana Pérez", initials: "AP", isAdmin: false }],
        },
      ],
    });

    render(await GroupsPage());

    expect(mocks.listGroups).toHaveBeenCalledWith("user-1");
    expect(screen.getByRole("heading", { level: 1, name: "Grupos" })).toBeInTheDocument();

    // Read as "name, N integrantes": the initials are for the eye, hidden from screen readers.
    const lolla = screen.getByRole("link", { name: "Los del Lolla, 2 integrantes" });
    expect(lolla).toHaveAttribute("href", `/grupos/${LOLLA_ID}`);
    expect(within(lolla).getByText("AP").closest("[aria-hidden='true']")).not.toBeNull();
    expect(within(lolla).getByText("BR").closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Primos, 1 integrante" })).toHaveAttribute(
      "href",
      `/grupos/${PRIMOS_ID}`,
    );

    expect(screen.queryByText("Todavía no estás en ningún grupo")).toBeNull();
    expect(screen.getByLabelText("Nombre del grupo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a la grilla" })).toHaveAttribute("href", "/");
  });

  it("sin grupos dice que todavía no está en ninguno y ofrece crear uno", async () => {
    mocks.listGroups.mockResolvedValue({ ok: true, groups: [] });

    render(await GroupsPage());

    expect(screen.getByText("Todavía no estás en ningún grupo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear grupo" })).toBeInTheDocument();
  });

  it("si la lista no carga, muestra el aviso sin grupos", async () => {
    mocks.listGroups.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });

    render(await GroupsPage());

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus grupos");
    expect(screen.queryByText("Todavía no estás en ningún grupo")).toBeNull();
  });

  it("sin sesión redirige a /login sin leer los grupos", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(GroupsPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.listGroups).not.toHaveBeenCalled();
  });
});
