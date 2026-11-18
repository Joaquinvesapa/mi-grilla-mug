import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "@/components/register-form";
import {
  type AuthFormAction,
  type AuthFormState,
  INITIAL_FORM_STATE,
} from "@/lib/account-messages";

afterEach(cleanup);

const PASSWORD = "festival2026";

function fakeAction(state: AuthFormState) {
  return vi.fn<AuthFormAction>(async () => state);
}

function getSubmit() {
  return screen.getByRole("button", { name: /crear cuenta/i });
}

async function fillAndSubmit(values: { name: string; email: string; password: string }) {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: values.name } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: values.password } });
  const form = getSubmit().closest("form");
  if (!form) {
    throw new Error("the submit button is not inside a form");
  }
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("RegisterForm", () => {
  it("test-register-form-errors-invalid: con INVALID_INPUT muestra bajo cada campo sus mensajes, con aria-invalid", async () => {
    const action = fakeAction({
      formError: null,
      fieldErrors: {
        email: ["Ese email no es válido."],
        password: [
          "La contraseña tiene que tener al menos 8 caracteres.",
          "La contraseña tiene que incluir al menos un número.",
        ],
        name: ["Escribí tu nombre."],
      },
      values: { email: "ana@", name: "" },
    });
    render(<RegisterForm action={action} />);

    await fillAndSubmit({ name: " ", email: "ana@", password: "abc" });

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Contraseña");
    const name = screen.getByLabelText("Nombre");
    for (const field of [email, password, name]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
    }
    expect(email).toHaveAccessibleDescription(expect.stringContaining("Ese email no es válido."));
    expect(password).toHaveAccessibleDescription(
      expect.stringContaining("La contraseña tiene que tener al menos 8 caracteres."),
    );
    expect(password).toHaveAccessibleDescription(
      expect.stringContaining("La contraseña tiene que incluir al menos un número."),
    );
    expect(name).toHaveAccessibleDescription(expect.stringContaining("Escribí tu nombre."));
    // Field errors only: no general message.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test-register-form-duplicate-rejected: EMAIL_TAKEN se avisa en role=alert y conserva el email y el nombre, nunca la contraseña", async () => {
    const action = fakeAction({
      formError: "Ese email ya está registrado.",
      fieldErrors: {},
      values: { email: "Ana@Mail.com", name: "Ana" },
    });
    render(<RegisterForm action={action} />);

    await fillAndSubmit({ name: "Ana", email: "Ana@Mail.com", password: PASSWORD });

    expect(screen.getByRole("alert")).toHaveTextContent("Ese email ya está registrado.");
    expect(screen.getByLabelText("Email")).toHaveValue("Ana@Mail.com");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("name")).toBe("Ana");
    expect(formData?.get("email")).toBe("Ana@Mail.com");
    expect(formData?.get("password")).toBe(PASSWORD);
  });

  it("test-form-attributes: los campos de registro llevan los atributos de la guía mobile", () => {
    render(<RegisterForm action={fakeAction(INITIAL_FORM_STATE)} />);

    const name = screen.getByLabelText("Nombre");
    expect(name).toHaveAttribute("autocomplete", "nickname");
    expect(name).toHaveAttribute("enterkeyhint", "next");
    expect(name).toBeRequired();
    expect(name).toHaveAttribute("maxlength", "40");

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAttribute("autocapitalize", "none");
    expect(email).toHaveAttribute("autocorrect", "off");
    expect(email).toHaveAttribute("spellcheck", "false");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("enterkeyhint", "next");
    expect(email).toBeRequired();
    expect(email).toHaveAttribute("maxlength", "254");

    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(password).toHaveAttribute("enterkeyhint", "go");
    expect(password).toBeRequired();
    expect(password).toHaveAttribute("minlength", "8");
    expect(password).toHaveAttribute("maxlength", "128");
  });

  it("deshabilita el botón mientras la acción está pendiente", async () => {
    let finish: (state: AuthFormState) => void = () => {};
    const action = vi.fn<AuthFormAction>(
      () =>
        new Promise<AuthFormState>((resolve) => {
          finish = resolve;
        }),
    );
    render(<RegisterForm action={action} />);

    await fillAndSubmit({ name: "Ana", email: "ana@mail.com", password: PASSWORD });
    expect(getSubmit()).toBeDisabled();

    await act(async () => {
      finish({
        formError: "No pudimos completar el pedido. Probá de nuevo en un rato.",
        fieldErrors: {},
        values: { email: "ana@mail.com", name: "Ana" },
      });
    });
    expect(getSubmit()).toBeEnabled();
  });

  it("lleva a la pantalla de inicio de sesión", () => {
    render(<RegisterForm action={fakeAction(INITIAL_FORM_STATE)} />);

    expect(screen.getByRole("link", { name: /entrá/i })).toHaveAttribute("href", "/login");
  });

  it("con next lo lleva oculto y el link a entrar lo conserva codificado", async () => {
    const next = "/invitacion/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
    const action = fakeAction(INITIAL_FORM_STATE);
    const { container } = render(<RegisterForm action={action} next={next} />);

    expect(container.querySelector('input[type="hidden"][name="next"]')).toHaveValue(next);
    expect(screen.getByRole("link", { name: /entrá/i })).toHaveAttribute(
      "href",
      "/login?next=%2Finvitacion%2FAbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE",
    );

    await fillAndSubmit({ name: "Ana", email: "ana@mail.com", password: PASSWORD });
    expect(action.mock.calls[0]?.[1].get("next")).toBe(next);
  });
});
