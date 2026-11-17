import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordInput } from "@/components/password-input";

afterEach(cleanup);

function getField() {
  return screen.getByLabelText("Contraseña");
}

function renderInForm() {
  const onSubmit = vi.fn();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="password">Contraseña</label>
      <PasswordInput id="password" name="password" autoComplete="current-password" />
    </form>,
  );
  return onSubmit;
}

describe("PasswordInput", () => {
  it("test-password-toggle: tocar el control muestra lo escrito y volver a tocarlo lo oculta, sin enviar el formulario", () => {
    const onSubmit = renderInForm();

    expect(getField()).toHaveAttribute("type", "password");
    const show = screen.getByRole("button", { name: "Mostrar contraseña" });
    expect(show).toHaveAttribute("type", "button");
    expect(show).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(show);

    expect(getField()).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Ocultar contraseña" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hide);

    expect(getField()).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("conserva lo escrito al alternar y pasa los atributos al campo", () => {
    renderInForm();

    fireEvent.change(getField(), { target: { value: "festival2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));

    expect(getField()).toHaveValue("festival2026");
    expect(getField()).toHaveAttribute("name", "password");
    expect(getField()).toHaveAttribute("autocomplete", "current-password");
  });

  it("da respuesta táctil en el control con data-pressed", () => {
    renderInForm();
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });

    fireEvent.pointerDown(toggle);
    expect(toggle).toHaveAttribute("data-pressed", "true");

    fireEvent.pointerUp(toggle);
    expect(toggle).not.toHaveAttribute("data-pressed");
  });
});
