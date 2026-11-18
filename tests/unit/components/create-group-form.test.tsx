import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateGroupFormState } from "@/app/group-actions";
import { CreateGroupForm } from "@/components/create-group-form";
import { groupMessageFor } from "@/lib/group-messages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const OFFLINE = "Necesitás conexión para hacer esto";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

type CreateAction = (
  prev: CreateGroupFormState,
  formData: FormData,
) => Promise<CreateGroupFormState>;

function fakeAction(state: CreateGroupFormState) {
  return vi.fn<CreateAction>(async () => state);
}

async function typeAndSubmit(name: string) {
  fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: name } });
  const form = screen.getByRole("button", { name: "Crear grupo" }).closest("form");
  if (!form) {
    throw new Error("the submit button is not inside a form");
  }
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("CreateGroupForm", () => {
  it("create-group-form: nombre inválido muestra el largo permitido y conserva lo escrito", async () => {
    const tooLong = "x".repeat(41);
    const action = fakeAction({ error: groupMessageFor("INVALID_NAME"), name: tooLong });
    render(<CreateGroupForm action={action} />);

    const input = screen.getByLabelText("Nombre del grupo");
    // Mobile guides: 16 px (no iOS zoom), no autofill, "done" key; no maxLength (UTF-16 units).
    expect(input).toHaveClass("text-base");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("enterkeyhint", "done");
    expect(input).toBeRequired();
    expect(input).not.toHaveAttribute("maxlength");

    await typeAndSubmit(tooLong);

    expect(action.mock.calls[0]?.[1].get("name")).toBe(tooLong);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El nombre tiene que tener entre 1 y 40 caracteres",
    );
    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue(tooLong);
    expect(screen.getByLabelText("Nombre del grupo")).toHaveAttribute("aria-invalid", "true");
  });

  it("create-group-form: con 10 grupos crear es rechazado y muestra el máximo", async () => {
    const action = fakeAction({
      error: groupMessageFor("USER_GROUP_LIMIT"),
      name: "Los del Lolla",
    });
    render(<CreateGroupForm action={action} />);

    await typeAndSubmit("Los del Lolla");

    expect(screen.getByRole("alert")).toHaveTextContent("Ya estás en 10 grupos, el máximo");
    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue("Los del Lolla");
  });

  it("test-forms-offline-ac28: crear sin conexión avisa y no llama a la acción", async () => {
    setOnline(false);
    const action = fakeAction({ error: null, name: "" });
    render(<CreateGroupForm action={action} />);

    await typeAndSubmit("Los del Lolla");

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(OFFLINE);
    expect(screen.getByLabelText("Nombre del grupo")).toHaveValue("Los del Lolla");
    expect(screen.getByRole("button", { name: "Crear grupo" })).toBeEnabled();
  });

  it("test-guard-message-priority: el aviso de conexión le gana al error de la acción y el próximo envío con conexión lo limpia", async () => {
    setOnline(true);
    const action = vi
      .fn<CreateAction>()
      .mockResolvedValueOnce({ error: groupMessageFor("INVALID_NAME"), name: "" })
      .mockResolvedValueOnce({ error: groupMessageFor("USER_GROUP_LIMIT"), name: "Los del Lolla" });
    render(<CreateGroupForm action={action} />);

    await typeAndSubmit("");
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 y 40 caracteres");

    setOnline(false);
    await typeAndSubmit("Los del Lolla");
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(OFFLINE);

    setOnline(true);
    await typeAndSubmit("Los del Lolla");
    expect(action).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Ya estás en 10 grupos, el máximo");
    expect(screen.queryByText(OFFLINE)).toBeNull();
  });

  it("crear rechazado por la red con conexión muestra el genérico", async () => {
    setOnline(true);
    const action = vi.fn<CreateAction>(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<CreateGroupForm action={action} />);

    await typeAndSubmit("Los del Lolla");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos guardar. Probá de nuevo en un rato.",
    );
  });
});
