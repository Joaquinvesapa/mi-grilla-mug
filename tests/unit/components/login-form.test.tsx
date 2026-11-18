import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/login-form";
import {
  type AuthFormAction,
  type AuthFormState,
  INITIAL_FORM_STATE,
} from "@/lib/account-messages";

afterEach(cleanup);

const PASSWORD = "festival2026";
const LOCKED_TEXT =
  "Bloqueamos el acceso a este email por 15 minutos por demasiados intentos. Probá más tarde.";

function fakeAction(state: AuthFormState) {
  return vi.fn<AuthFormAction>(async () => state);
}

function getSubmit() {
  return screen.getByRole("button", { name: /entrar/i });
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  const form = getSubmit().closest("form");
  if (!form) {
    throw new Error("the submit button is not inside a form");
  }
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("LoginForm", () => {
  it("test-login-form-invalid-message: INVALID_CREDENTIALS muestra exactamente el aviso, conserva el email y vacía la contraseña", async () => {
    const action = fakeAction({
      formError: "Email o contraseña incorrectos",
      fieldErrors: {},
      values: { email: "ana@mail.com", name: "" },
    });
    render(<LoginForm action={action} />);

    await fillAndSubmit("ana@mail.com", PASSWORD);

    expect(screen.getByRole("alert").textContent).toBe("Email o contraseña incorrectos");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@mail.com");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("ana@mail.com");
    expect(formData?.get("password")).toBe(PASSWORD);
  });

  it("test-login-form-locked-rejected: LOGIN_LOCKED muestra el aviso de bloqueo temporal", async () => {
    render(
      <LoginForm
        action={fakeAction({
          formError: LOCKED_TEXT,
          fieldErrors: {},
          values: { email: "ana@mail.com", name: "" },
        })}
      />,
    );

    await fillAndSubmit("ana@mail.com", PASSWORD);

    expect(screen.getByRole("alert")).toHaveTextContent(LOCKED_TEXT);
  });

  it("test-form-attributes: los campos de inicio de sesión llevan los atributos de la guía mobile", () => {
    render(<LoginForm action={fakeAction(INITIAL_FORM_STATE)} />);

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("type", "email");
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAttribute("autocapitalize", "none");
    expect(email).toHaveAttribute("autocorrect", "off");
    expect(email).toHaveAttribute("spellcheck", "false");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("enterkeyhint", "next");
    expect(email).toBeRequired();

    const password = screen.getByLabelText("Contraseña");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAttribute("enterkeyhint", "go");
    expect(password).toBeRequired();
  });

  it("login-form: lleva next oculto y el link a registrarse lo conserva codificado", async () => {
    const next = "/invitacion/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
    const action = fakeAction(INITIAL_FORM_STATE);
    const { container } = render(<LoginForm action={action} next={next} />);

    expect(container.querySelector('input[type="hidden"][name="next"]')).toHaveValue(next);
    const href = screen.getByRole("link", { name: /creá tu cuenta/i }).getAttribute("href") ?? "";
    expect(href).toBe("/register?next=%2Finvitacion%2FAbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE");
    expect(new URL(href, "http://localhost").searchParams.get("next")).toBe(next);

    await fillAndSubmit("ana@mail.com", PASSWORD);
    expect(action.mock.calls[0]?.[1].get("next")).toBe(next);
  });

  it("sin next no lleva el campo oculto", () => {
    const { container } = render(<LoginForm action={fakeAction(INITIAL_FORM_STATE)} />);

    expect(container.querySelector('input[name="next"]')).toBeNull();
  });

  it("sin error no muestra aviso y lleva a la pantalla de registro", () => {
    render(<LoginForm action={fakeAction(INITIAL_FORM_STATE)} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("link", { name: /creá tu cuenta/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
