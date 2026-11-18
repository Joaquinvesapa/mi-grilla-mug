import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The page with its services simulated: what `/invitacion/[token]` renders depends only on them.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getInvitePreview: vi.fn(),
  joinGroup: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/accounts", () => ({
  getAccounts: () => ({ getCurrentUser: mocks.getCurrentUser }),
}));
vi.mock("@/server/groups", () => ({
  getInvitePreview: mocks.getInvitePreview,
  joinGroup: mocks.joinGroup,
}));
vi.mock("@/app/group-actions", () => ({ joinGroupAction: vi.fn() }));

const { default: InvitationPage } = await import("@/app/invitacion/[token]/page");

const USER = { id: "user-2", name: "Beto", email: "beto@mail.com" };
const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const INVALID_TEXT =
  "Este link de invitación ya no es válido. Pedile uno nuevo a alguien del grupo.";

function props(token = TOKEN) {
  return { params: Promise.resolve({ token }) };
}

/** The path `redirect()` was called with, as a URL to read its query. */
function redirectedTo(): URL {
  const path = mocks.redirect.mock.calls[0]?.[0];
  if (typeof path !== "string") {
    throw new Error("redirect was not called");
  }
  return new URL(path, "http://localhost");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(USER);
});

afterEach(cleanup);

describe("InvitationPage", () => {
  it("invitation-page: con sesión y link vigente muestra el nombre, los integrantes y Unirme", async () => {
    mocks.getInvitePreview.mockResolvedValue({
      ok: true,
      groupId: GROUP_ID,
      name: "Los del Lolla",
      memberCount: 3,
      alreadyMember: false,
    });

    const { container } = render(await InvitationPage(props()));

    expect(mocks.getInvitePreview).toHaveBeenCalledWith("user-2", TOKEN);
    expect(screen.getByRole("heading", { level: 1, name: "Los del Lolla" })).toBeInTheDocument();
    expect(screen.getByText("3 integrantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unirme" })).toBeInTheDocument();
    expect(container.querySelector('input[type="hidden"][name="token"]')).toHaveValue(TOKEN);
    expect(mocks.joinGroup).not.toHaveBeenCalled();
  });

  it("invitation-page: sin sesión redirige a /login con next de la invitación", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(InvitationPage(props())).rejects.toThrow("NEXT_REDIRECT /login");

    const target = redirectedTo();
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("next")).toBe(`/invitacion/${TOKEN}`);
    expect(mocks.getInvitePreview).not.toHaveBeenCalled();
  });

  it("sin sesión y con un token mal formado redirige a /login sin next", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(InvitationPage(props("not-a-token"))).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("invitation-page: un link vencido o reemplazado muestra el mensaje de link inválido", async () => {
    mocks.getInvitePreview.mockResolvedValue({ ok: false, code: "INVALID_INVITE" });

    render(await InvitationPage(props()));

    expect(screen.getByRole("alert")).toHaveTextContent(INVALID_TEXT);
    expect(screen.queryByRole("button", { name: "Unirme" })).toBeNull();
    expect(screen.queryByText("Los del Lolla")).toBeNull();
    expect(mocks.joinGroup).not.toHaveBeenCalled();
  });

  it("invitation-page: un integrante que abre su link va al grupo sin duplicarse", async () => {
    mocks.getInvitePreview.mockResolvedValue({
      ok: true,
      groupId: GROUP_ID,
      name: "Los del Lolla",
      memberCount: 3,
      alreadyMember: true,
    });

    await expect(InvitationPage(props())).rejects.toThrow(`NEXT_REDIRECT /grupos/${GROUP_ID}`);

    expect(mocks.redirect).toHaveBeenCalledWith(`/grupos/${GROUP_ID}`);
    expect(mocks.joinGroup).not.toHaveBeenCalled();
  });

  it("si la invitación no carga, muestra el aviso sin datos del grupo", async () => {
    mocks.getInvitePreview.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });

    render(await InvitationPage(props()));

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar la invitación");
    expect(screen.queryByRole("button", { name: "Unirme" })).toBeNull();
  });
});
