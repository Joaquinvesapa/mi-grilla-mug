import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import { InviteLink, type InviteLinkProps } from "@/components/invite-link";
import { formatInviteExpiry } from "@/lib/group-messages";

const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const NOW = new Date("2026-11-18T15:00:00.000Z");
// Friday 20/11 at 03:15 in Argentina (UTC−3).
const EXPIRES_AT = new Date("2026-11-20T06:15:00.000Z");
const COPY_FAILED = "No pudimos copiarlo: mantené apretado el link para copiarlo";

type RegenerateAction = InviteLinkProps["regenerateAction"];

afterEach(() => {
  cleanup();
  // The Web Share and Clipboard APIs each test installs on jsdom's navigator.
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

function setNavigator(name: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

function linkUrl(): string {
  return `${window.location.origin}/invitacion/${TOKEN}`;
}

type Overrides = Partial<Omit<InviteLinkProps, "regenerateAction">> & {
  regenerateAction?: Mock<RegenerateAction>;
};

function renderLink(overrides: Overrides = {}) {
  const regenerateAction =
    overrides.regenerateAction ?? vi.fn<RegenerateAction>(async () => ({ ok: true }));
  render(
    <InviteLink
      groupId={GROUP_ID}
      groupName="Los del Lolla"
      invite={{ token: TOKEN, expiresAt: EXPIRES_AT }}
      isAdmin={false}
      now={NOW}
      {...overrides}
      regenerateAction={regenerateAction}
    />,
  );
  return { regenerateAction };
}

async function tapShare() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Compartir link" }));
  });
}

describe("InviteLink", () => {
  it("invite-link: muestra el link, el vencimiento y Compartir", () => {
    renderLink();

    expect(screen.getByText(linkUrl())).toBeInTheDocument();
    expect(screen.getByText(formatInviteExpiry(EXPIRES_AT))).toBeInTheDocument();
    expect(screen.getByText("Vence el viernes 20/11 a las 03:15")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compartir link" })).toBeInTheDocument();
  });

  it("invite-link: Compartir usa la hoja del sistema y si no copia el link", async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    setNavigator("share", share);
    renderLink();

    await tapShare();

    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0]?.[0]).toMatchObject({ url: linkUrl() });
    expect(share.mock.calls[0]?.[0].title).toContain("Los del Lolla");
    expect(screen.queryByText("Link copiado")).toBeNull();

    // The person closes the sheet: nothing to say.
    share.mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    await tapShare();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();

    // Without the share sheet, the link is copied.
    cleanup();
    Reflect.deleteProperty(navigator, "share");
    const writeText = vi.fn(async (_text: string) => {});
    setNavigator("clipboard", { writeText });
    renderLink();

    await tapShare();

    expect(writeText).toHaveBeenCalledWith(linkUrl());
    expect(screen.getByRole("status")).toHaveTextContent("Link copiado");
  });

  it("invite-link: si copiar da error, el link queda visible con el aviso", async () => {
    setNavigator(
      "share",
      vi.fn(async () => Promise.reject(new DOMException("no", "NotAllowedError"))),
    );
    setNavigator("clipboard", {
      writeText: vi.fn(async () => Promise.reject(new Error("denied"))),
    });
    renderLink();

    await tapShare();

    expect(screen.getByRole("alert")).toHaveTextContent(COPY_FAILED);
    const link = screen.getByText(linkUrl());
    expect(link).toBeVisible();
    // Selectable on a long press: not inside a button or a link, which are user-select: none.
    expect(link.closest("button, a")).toBeNull();
    expect(link).toHaveClass("select-all");
  });

  it("invite-link: el administrador genera un link nuevo sin confirmación y el integrante común no lo ve", async () => {
    const { regenerateAction } = renderLink({ isAdmin: true });

    // R-14 is an accepted risk (spec, round 3): the tap sends it, nothing asks first.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generar link nuevo" }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(regenerateAction).toHaveBeenCalledTimes(1);
    expect(regenerateAction.mock.calls[0]?.[1].get("groupId")).toBe(GROUP_ID);

    cleanup();
    renderLink({ isAdmin: false });
    expect(screen.queryByRole("button", { name: "Generar link nuevo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Compartir link" })).toBeInTheDocument();
  });

  it("invite-link: un link vencido o sin link no ofrece compartir y dice a quién pedir uno nuevo", async () => {
    const expiredAt = new Date(NOW.getTime() - 60_000);
    renderLink({ invite: { token: TOKEN, expiresAt: expiredAt }, isAdmin: false });

    expect(screen.getByText("El link venció")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compartir link" })).toBeNull();
    expect(screen.queryByText(linkUrl())).toBeNull();
    expect(
      screen.getByText(/Pedile a quien administra el grupo un link nuevo/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar link nuevo" })).toBeNull();

    // Expiring at exactly now no longer works (the service's `now < expires_at`).
    cleanup();
    renderLink({ invite: { token: TOKEN, expiresAt: NOW }, isAdmin: false });
    expect(screen.getByText("El link venció")).toBeInTheDocument();

    cleanup();
    const { regenerateAction } = renderLink({ invite: null, isAdmin: true });
    expect(screen.getByText("No hay un link activo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compartir link" })).toBeNull();
    expect(screen.queryByText(/Pedile a quien administra/)).toBeNull();
    // Generating never asks first (R-14 accepted in spec round 3), with or without a link.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generar link nuevo" }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(regenerateAction).toHaveBeenCalledTimes(1);
    expect(regenerateAction.mock.calls[0]?.[1].get("groupId")).toBe(GROUP_ID);
  });

  it("invite-link: si generar falla, muestra el motivo", async () => {
    const regenerateAction = vi.fn<RegenerateAction>(async () => ({
      ok: false,
      error: "Solo quien administra el grupo puede generar un link nuevo.",
    }));
    renderLink({ isAdmin: true, regenerateAction });

    // With an active link too: the tap sends it directly and the answer is shown.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generar link nuevo" }));
    });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(regenerateAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Solo quien administra el grupo puede generar un link nuevo.",
    );
    expect(screen.queryByText("Link nuevo generado")).toBeNull();
  });

  it("invite-link: en el render del servidor no hay URL y Compartir está deshabilitado", () => {
    // The server snapshot of the origin is `null`: a relative URL must never be shown or shared.
    const html = renderToString(
      <InviteLink
        groupId={GROUP_ID}
        groupName="Los del Lolla"
        invite={{ token: TOKEN, expiresAt: EXPIRES_AT }}
        isAdmin={false}
        now={NOW}
        regenerateAction={vi.fn<RegenerateAction>(async () => ({ ok: true }))}
      />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;

    expect(container.textContent).not.toContain("/invitacion/");
    expect(container.textContent).toContain(formatInviteExpiry(EXPIRES_AT));
    expect(within(container).getByRole("button", { name: "Compartir link" })).toBeDisabled();
  });

  it("invite-link: regenerar avisa Link nuevo generado y Generar queda deshabilitado mientras envía", async () => {
    let finish: (state: { ok: true }) => void = () => {};
    const regenerateAction = vi.fn<RegenerateAction>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderLink({ isAdmin: true, regenerateAction });

    const generate = screen.getByRole("button", { name: "Generar link nuevo" });
    await act(async () => {
      fireEvent.click(generate);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // Still sending: the button is disabled, and a second tap cannot send it again.
    expect(generate).toBeDisabled();
    expect(generate).toHaveAttribute("aria-busy", "true");
    fireEvent.click(generate);
    expect(regenerateAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      finish({ ok: true });
    });

    expect(screen.getByRole("status")).toHaveTextContent("Link nuevo generado");
    expect(screen.getByRole("button", { name: "Generar link nuevo" })).toBeEnabled();
  });

  it("invite-link: link vencido con administrador no ofrece compartir y Generar no pide confirmación", async () => {
    const { regenerateAction } = renderLink({
      invite: { token: TOKEN, expiresAt: new Date(NOW.getTime() - 60_000) },
      isAdmin: true,
    });

    expect(screen.getByText("El link venció")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compartir link" })).toBeNull();
    expect(screen.queryByText(/Pedile a quien administra/)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generar link nuevo" }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(regenerateAction).toHaveBeenCalledTimes(1);
    expect(regenerateAction.mock.calls[0]?.[1].get("groupId")).toBe(GROUP_ID);
  });

  it("invite-link: sin link, el integrante común ve que no hay uno activo y a quién pedirlo", () => {
    renderLink({ invite: null, isAdmin: false });

    expect(screen.getByText("No hay un link activo")).toBeInTheDocument();
    expect(
      screen.getByText("Pedile a quien administra el grupo un link nuevo."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compartir link" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Generar link nuevo" })).toBeNull();
  });
});
