import { cleanup, render, screen, within } from "@testing-library/react";
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
vi.mock("@/app/group-actions", () => ({
  regenerateInviteAction: vi.fn(),
  renameGroupAction: vi.fn(),
  removeMemberAction: vi.fn(),
  deleteGroupAction: vi.fn(),
  leaveGroupAction: vi.fn(),
}));

const { default: GroupPage } = await import("@/app/grupos/[groupId]/page");

const USER = { id: "user-1", name: "Ana Pérez", email: "ana@mail.com" };
const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";

const MEMBERS = [
  { name: "Ana Pérez", initials: "AP", isAdmin: true, userId: "user-1", isSelf: true },
  { name: "Bruno", initials: "BR", isAdmin: false, userId: "user-2", isSelf: false },
  { name: "Carla", initials: "CA", isAdmin: false, userId: "user-3", isSelf: false },
];

function groupAs(isAdmin: boolean) {
  return {
    ok: true,
    group: {
      id: GROUP_ID,
      name: "Los del Lolla",
      isAdmin,
      // The session's user is Ana when admin, Bruno when not.
      members: MEMBERS.map((member) => ({
        ...member,
        isSelf: isAdmin ? member.userId === "user-1" : member.userId === "user-2",
      })),
      invite: { token: TOKEN, expiresAt: new Date(Date.now() + 3_600_000) },
    },
  };
}

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
          { name: "Ana Pérez", initials: "AP", isAdmin: true, userId: "user-1", isSelf: true },
          { name: "Bruno", initials: "BR", isAdmin: false, userId: "user-2", isSelf: false },
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

  it("test-page-admin-controls: el admin ve Cambiar nombre, Sacar en cada fila menos la suya y Borrar grupo", async () => {
    mocks.getGroup.mockResolvedValue(groupAs(true));

    render(await GroupPage(props()));

    expect(screen.getByLabelText("Cambiar nombre")).toHaveValue("Los del Lolla");
    expect(screen.getByRole("button", { name: "Guardar nombre" })).toBeInTheDocument();

    const rows = within(screen.getByRole("list", { name: "Integrantes" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    const [ana, bruno, carla] = rows;
    if (!ana || !bruno || !carla) {
      throw new Error("three rows expected");
    }
    expect(within(ana).queryByRole("button", { name: /^Sacar/ })).toBeNull();
    expect(within(bruno).getByRole("button", { name: "Sacar a Bruno" })).toBeInTheDocument();
    expect(within(carla).getByRole("button", { name: "Sacar a Carla" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Borrar grupo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir del grupo" })).toBeInTheDocument();
  });

  it("test-page-member-no-controls: un integrante común no ve renombrar, Sacar ni Borrar grupo, y sí Salir del grupo", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ...USER, id: "user-2", name: "Bruno" });
    mocks.getGroup.mockResolvedValue(groupAs(false));

    render(await GroupPage(props()));

    expect(screen.getByRole("list", { name: "Integrantes" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cambiar nombre")).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar nombre" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Sacar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar grupo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Salir del grupo" })).toBeInTheDocument();
  });

  it("si el grupo no carga, muestra el aviso sin datos del grupo", async () => {
    mocks.getGroup.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });

    render(await GroupPage(props()));

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el grupo");
    expect(screen.queryByRole("list", { name: "Integrantes" })).toBeNull();
  });
});
