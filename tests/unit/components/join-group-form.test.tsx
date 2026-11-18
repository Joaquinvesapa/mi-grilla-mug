import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JoinGroupState } from "@/app/group-actions";
import { JoinGroupForm } from "@/components/join-group-form";
import { joinGroupMessageFor } from "@/lib/group-messages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const OFFLINE = "Necesitás conexión para hacer esto";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";

type JoinAction = (prev: JoinGroupState, formData: FormData) => Promise<JoinGroupState>;

function fakeAction(state: JoinGroupState) {
  return vi.fn<JoinAction>(async () => state);
}

async function join() {
  const form = screen.getByRole("button", { name: "Unirme" }).closest("form");
  if (!form) {
    throw new Error("the button is not inside a form");
  }
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("JoinGroupForm", () => {
  it("join-group-form: grupo completo y máximo de grupos muestran cuál límite se alcanzó", async () => {
    const full = fakeAction({ error: joinGroupMessageFor("GROUP_FULL") });
    render(<JoinGroupForm action={full} token={TOKEN} />);

    expect(screen.queryByRole("alert")).toBeNull();
    await join();

    // The token travels hidden in the form, never as anything the person typed.
    expect(full.mock.calls[0]?.[1].get("token")).toBe(TOKEN);
    expect(screen.getByRole("alert")).toHaveTextContent("El grupo está completo (20 integrantes)");
    cleanup();

    render(
      <JoinGroupForm
        action={fakeAction({ error: joinGroupMessageFor("USER_GROUP_LIMIT") })}
        token={TOKEN}
      />,
    );
    await join();

    expect(screen.getByRole("alert")).toHaveTextContent("Ya estás en 10 grupos, el máximo");
    expect(screen.getByRole("alert")).not.toHaveTextContent("completo");
  });

  it("el botón Unirme es grande y se deshabilita mientras envía", async () => {
    let finish: (state: JoinGroupState) => void = () => {};
    const action = vi.fn<JoinAction>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<JoinGroupForm action={action} token={TOKEN} />);
    const button = screen.getByRole("button", { name: "Unirme" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button.className).toMatch(/h-11|min-h-11|h-12/);

    await join();
    expect(screen.getByRole("button", { name: "Unirme" })).toBeDisabled();

    await act(async () => {
      finish({ error: joinGroupMessageFor("SERVICE_UNAVAILABLE") });
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos unirte. Probá de nuevo en un rato.",
    );
    expect(screen.getByRole("button", { name: "Unirme" })).toBeEnabled();
  });

  it("test-forms-offline-ac28: unirse sin conexión avisa y no llama a la acción", async () => {
    setOnline(false);
    const action = fakeAction({ error: null });
    render(<JoinGroupForm action={action} token={TOKEN} />);

    await join();

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(OFFLINE);
    expect(screen.getByRole("button", { name: "Unirme" })).toBeEnabled();
  });
});
