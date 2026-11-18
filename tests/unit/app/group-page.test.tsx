import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The page with its services simulated: what `/grupos/[groupId]` renders depends only on them.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getGroup: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/server/accounts", () => ({
  getAccounts: () => ({ getCurrentUser: mocks.getCurrentUser }),
}));
vi.mock("@/server/groups", () => ({ getGroup: mocks.getGroup }));
vi.mock("@/app/group-actions", () => ({ regenerateInviteAction: vi.fn() }));

const { default: GroupPage } = await import("@/app/grupos/[groupId]/page");

const USER = { id: "user-1", name: "Ana Pérez", email: "ana@mail.com" };
const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";

function props(groupId = GROUP_ID) {
  return { params: Promise.resolve({ groupId }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(USER);
});

afterEach(cleanup);

describe("GroupPage", () => {
  it("group-page: un grupo ajeno responde not found sin nombre ni integrantes", async () => {
    mocks.getGroup.mockResolvedValue({ ok: false, code: "NOT_FOUND" });

    await expect(GroupPage(props())).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.getGroup).toHaveBeenCalledWith("user-1", GROUP_ID);
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    expect(document.body).toHaveTextContent("");
  });

  it("group-page: sin sesión redirige a /login", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(GroupPage(props())).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.getGroup).not.toHaveBeenCalled();
  });

  it("muestra el nombre, los integrantes, el link y la vuelta a Grupos", async () => {
    mocks.getGroup.mockResolvedValue({
      ok: true,
      group: {
        id: GROUP_ID,
        name: "Los del Lolla",
        isAdmin: true,
        members: [
          { name: "Ana Pérez", initials: "AP", isAdmin: true },
          { name: "Bruno", initials: "BR", isAdmin: false },
        ],
        invite: { token: TOKEN, expiresAt: new Date(Date.now() + 3_600_000) },
      },
    });

    render(await GroupPage(props()));

    expect(screen.getByRole("heading", { level: 1, name: "Los del Lolla" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Integrantes" })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/invitacion/${TOKEN}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar link nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Grupos" })).toHaveAttribute(
      "href",
      "/grupos",
    );
  });

  it("si el grupo no carga, muestra el aviso sin datos del grupo", async () => {
    mocks.getGroup.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });

    render(await GroupPage(props()));

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el grupo");
    expect(screen.queryByRole("list", { name: "Integrantes" })).toBeNull();
  });
});
