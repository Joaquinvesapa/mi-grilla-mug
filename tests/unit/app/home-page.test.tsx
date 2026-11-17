import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { selectionMessageFor } from "@/lib/selection-messages";

import { SCHEDULE } from "../components/schedule-fixture";

// The page with its services simulated: what `/` renders depends only on what they return.
const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSchedule: vi.fn(),
  getSelection: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/accounts", () => ({
  getAccounts: () => ({ getCurrentUser: mocks.getCurrentUser }),
}));
vi.mock("@/server/schedule", () => ({ getSchedule: mocks.getSchedule }));
vi.mock("@/server/selection", () => ({ getSelection: mocks.getSelection }));
vi.mock("@/app/auth-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/app/selection-actions", () => ({ saveSelectionAction: vi.fn() }));
// The screen itself is real in the other tests; here only what the page hands it matters.
const screenSpy = vi.hoisted(() => vi.fn());
vi.mock("@/components/schedule-screen", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/schedule-screen")>();
  return {
    ScheduleScreen: (props: Parameters<typeof actual.ScheduleScreen>[0]) => {
      screenSpy(props);
      return <actual.ScheduleScreen {...props} />;
    },
  };
});

const { default: HomePage } = await import("@/app/page");

const USER = { id: "user-1", name: "Ana", email: "ana@mail.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue(USER);
  mocks.getSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
  mocks.getSelection.mockResolvedValue({ ok: true, showIds: ["fri-flow-1800"] });
});

afterEach(cleanup);

async function renderPage() {
  render(await HomePage());
}

describe("HomePage", () => {
  it("test-page-load-error: si la grilla no carga, se ve el error SCHEDULE_UNAVAILABLE con el menú y sin grilla", async () => {
    mocks.getSchedule.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      selectionMessageFor("SCHEDULE_UNAVAILABLE"),
    );
    expect(screen.getByRole("button", { name: "Menú" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Grilla del/ })).not.toBeInTheDocument();
    expect(document.querySelector("[data-show-id]")).toBeNull();
  });

  it("si la selección no carga, muestra el mismo error y no la grilla", async () => {
    mocks.getSelection.mockResolvedValue({ ok: false, code: "SERVICE_UNAVAILABLE" });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      selectionMessageFor("SCHEDULE_UNAVAILABLE"),
    );
    expect(document.querySelector("[data-show-id]")).toBeNull();
  });

  it("con todo cargado y fuera del festival abre en el viernes con la selección guardada del usuario", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T15:00:00-03:00"));
    try {
      await renderPage();
    } finally {
      vi.useRealTimers();
    }

    expect(mocks.getSelection).toHaveBeenCalledWith("user-1");
    // Outside the festival it opens on Friday (FR-08).
    expect(screen.getByRole("region", { name: "Grilla del Viernes" })).toBeInTheDocument();
    expect(document.querySelector('[data-show-id="fri-flow-1800"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("Muy pronto")).not.toBeInTheDocument();
  });

  it("durante el festival abre en el día en curso (sábado 21:30 → Sábado)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T21:30:00-03:00"));
    try {
      await renderPage();
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByRole("region", { name: "Grilla del Sábado" })).toBeInTheDocument();
  });

  it("una grilla sin días muestra el error y no la grilla", async () => {
    mocks.getSchedule.mockResolvedValue({
      ok: true,
      schedule: { days: [], stages: SCHEDULE.stages, shows: [] },
    });

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      selectionMessageFor("SCHEDULE_UNAVAILABLE"),
    );
    expect(screen.queryByRole("region", { name: /^Grilla del/ })).not.toBeInTheDocument();
  });

  it("test-home-page-user-id: pasa a la pantalla el id del usuario de la sesión y mode online", async () => {
    await renderPage();

    expect(screenSpy).toHaveBeenCalled();
    expect(screenSpy.mock.calls[0]?.[0]).toMatchObject({
      userId: "user-1",
      userName: "Ana",
      mode: "online",
      savedShowIds: ["fri-flow-1800"],
    });
  });

  it("sin sesión redirige a /login sin cargar la grilla", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(mocks.getSchedule).not.toHaveBeenCalled();
    expect(mocks.getSelection).not.toHaveBeenCalled();
  });
});
