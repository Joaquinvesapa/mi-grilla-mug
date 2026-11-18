import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RenameGroupForm, type RenameGroupFormProps } from "@/components/rename-group-form";
import { groupMessageFor } from "@/lib/group-messages";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const OFFLINE = "Necesitás conexión para hacer esto";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

const GROUP_ID = "0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";

type RenameAction = RenameGroupFormProps["action"];

async function typeAndSave(name: string) {
  fireEvent.change(screen.getByLabelText("Cambiar nombre"), { target: { value: name } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Guardar nombre" }));
  });
}

describe("RenameGroupForm", () => {
  it("test-rename-form-invalid-rejected: un nombre inválido muestra su mensaje y conserva el texto escrito", async () => {
    const tooLong = "x".repeat(41);
    const action = vi.fn<RenameAction>(async () => ({
      ok: false,
      error: groupMessageFor("INVALID_NAME"),
    }));
    render(<RenameGroupForm groupId={GROUP_ID} name="Los del Lolla" action={action} />);

    const input = screen.getByLabelText("Cambiar nombre");
    expect(input).toHaveValue("Los del Lolla");
    // Mobile guides: 16 px (no iOS zoom), no autofill, "done" key; no maxLength (UTF-16 units).
    expect(input).toHaveClass("text-base");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("enterkeyhint", "done");
    expect(input).not.toHaveAttribute("maxlength");

    await typeAndSave(tooLong);

    expect(action).toHaveBeenCalledTimes(1);
    const sent = action.mock.calls[0]?.[1];
    expect(sent?.get("groupId")).toBe(GROUP_ID);
    expect(sent?.get("name")).toBe(tooLong);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El nombre tiene que tener entre 1 y 40 caracteres",
    );
    expect(screen.getByLabelText("Cambiar nombre")).toHaveValue(tooLong);
    expect(screen.getByLabelText("Cambiar nombre")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Nombre guardado")).toBeNull();
  });

  it("rename-group-form: guardar avisa Nombre guardado", async () => {
    const action = vi.fn<RenameAction>(async () => ({ ok: true }));
    render(<RenameGroupForm groupId={GROUP_ID} name="Los del Lolla" action={action} />);

    await typeAndSave("Los de siempre");

    expect(screen.getByRole("status")).toHaveTextContent("Nombre guardado");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Cambiar nombre")).toHaveValue("Los de siempre");
  });

  it("test-forms-offline-ac28: renombrar sin conexión avisa y no llama a la acción", async () => {
    setOnline(false);
    const action = vi.fn<RenameAction>(async () => ({ ok: true }));
    render(<RenameGroupForm groupId={GROUP_ID} name="Los del Lolla" action={action} />);

    await typeAndSave("Los de siempre");

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(OFFLINE);
    expect(screen.queryByText("Nombre guardado")).toBeNull();
    expect(screen.getByLabelText("Cambiar nombre")).toHaveValue("Los de siempre");
  });
});
