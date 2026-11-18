import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The page with its services simulated: what `/login` renders depends only on them.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/accounts", () => ({
  getAccounts: () => ({ getCurrentUser: mocks.getCurrentUser }),
}));
vi.mock("@/app/auth-actions", () => ({ loginAction: vi.fn(), registerAction: vi.fn() }));

const { default: LoginPage } = await import("@/app/login/page");
const { default: RegisterPage } = await import("@/app/register/page");

const USER = { id: "user-1", name: "Ana", email: "ana@mail.com" };
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const INVITATION = `/invitacion/${TOKEN}`;

type SearchParams = Record<string, string | string[] | undefined>;

function props(searchParams: SearchParams) {
  return { searchParams: Promise.resolve(searchParams) };
}

function hiddenNext(container: HTMLElement): Element | null {
  return container.querySelector('input[type="hidden"][name="next"]');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(null);
});

afterEach(cleanup);

describe("LoginPage", () => {
  it("login-page: con sesión y next válido redirige a la invitación", async () => {
    mocks.getCurrentUser.mockResolvedValue(USER);

    await expect(LoginPage(props({ next: INVITATION }))).rejects.toThrow(
      `NEXT_REDIRECT ${INVITATION}`,
    );
    expect(mocks.redirect).toHaveBeenCalledWith(INVITATION);
  });

  it("con sesión y sin next redirige a /", async () => {
    mocks.getCurrentUser.mockResolvedValue(USER);

    await expect(LoginPage(props({}))).rejects.toThrow("NEXT_REDIRECT /");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("sin sesión y con next válido, el formulario lo lleva", async () => {
    const { container } = render(await LoginPage(props({ next: INVITATION })));

    expect(hiddenNext(container)).toHaveValue(INVITATION);
    expect(screen.getByRole("link", { name: /creá tu cuenta/i })).toHaveAttribute(
      "href",
      `/register?${new URLSearchParams({ next: INVITATION })}`,
    );
  });

  it("login-page: un next inválido no llega al formulario (rechazado)", async () => {
    // Control: the page does hand a valid destination to the form, so its absence below is the
    // filter at work and not a form that never carries one.
    const control = render(await LoginPage(props({ next: INVITATION })));
    expect(hiddenNext(control.container)).toHaveValue(INVITATION);
    cleanup();

    for (const next of [
      "https://evil.example/",
      `//evil.example${INVITATION}`,
      "/grupos",
      `/invitacion/${TOKEN.slice(1)}`,
      [INVITATION, INVITATION],
    ]) {
      const { container } = render(await LoginPage(props({ next })));

      expect(hiddenNext(container), JSON.stringify(next)).toBeNull();
      expect(screen.getByRole("link", { name: /creá tu cuenta/i })).toHaveAttribute(
        "href",
        "/register",
      );
      cleanup();
    }

    // With a session, an invalid destination is not followed either: it lands on `/`.
    mocks.getCurrentUser.mockResolvedValue(USER);
    await expect(LoginPage(props({ next: "https://evil.example/" }))).rejects.toThrow(
      "NEXT_REDIRECT /",
    );
    expect(mocks.redirect).toHaveBeenLastCalledWith("/");
  });
});

describe("RegisterPage", () => {
  it("con sesión y next válido redirige a la invitación; con uno inválido, a /", async () => {
    mocks.getCurrentUser.mockResolvedValue(USER);

    await expect(RegisterPage(props({ next: INVITATION }))).rejects.toThrow(
      `NEXT_REDIRECT ${INVITATION}`,
    );
    await expect(RegisterPage(props({ next: "//evil.example" }))).rejects.toThrow(
      "NEXT_REDIRECT /",
    );
    expect(mocks.redirect).toHaveBeenLastCalledWith("/");
  });

  it("sin sesión pasa al formulario solo el next validado", async () => {
    const valid = render(await RegisterPage(props({ next: INVITATION })));
    expect(hiddenNext(valid.container)).toHaveValue(INVITATION);
    expect(screen.getByRole("link", { name: /ya tenés cuenta/i })).toHaveAttribute(
      "href",
      `/login?${new URLSearchParams({ next: INVITATION })}`,
    );
    cleanup();

    const invalid = render(await RegisterPage(props({ next: "/grupos" })));
    expect(hiddenNext(invalid.container)).toBeNull();
    expect(screen.getByRole("link", { name: /ya tenés cuenta/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
