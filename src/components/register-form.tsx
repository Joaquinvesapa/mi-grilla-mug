"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { describedBy, FieldMessages, FormAlert } from "@/components/form-feedback";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/account-rules";
import { type AuthFormAction, INITIAL_FORM_STATE, PASSWORD_HINT } from "@/lib/account-messages";

/**
 * Sign-up form. The browser checks are only a help: the server revalidates everything. After an
 * error the name and the email come back filled; the password never does.
 */
export function RegisterForm({ action }: { action: AuthFormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FORM_STATE);
  const id = useId();
  const { fieldErrors } = state;
  const ids = {
    name: `${id}-name`,
    nameError: `${id}-name-error`,
    email: `${id}-email`,
    emailError: `${id}-email-error`,
    password: `${id}-password`,
    passwordHint: `${id}-password-hint`,
    passwordError: `${id}-password-error`,
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.name}>Nombre</Label>
        <Input
          id={ids.name}
          name="name"
          autoComplete="nickname"
          enterKeyHint="next"
          required
          maxLength={NAME_MAX_LENGTH}
          defaultValue={state.values.name}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={describedBy(fieldErrors.name && ids.nameError)}
        />
        <FieldMessages id={ids.nameError} messages={fieldErrors.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.email}>Email</Label>
        <Input
          id={ids.email}
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          enterKeyHint="next"
          required
          maxLength={EMAIL_MAX_LENGTH}
          defaultValue={state.values.email}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={describedBy(fieldErrors.email && ids.emailError)}
        />
        <FieldMessages id={ids.emailError} messages={fieldErrors.email} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={ids.password}>Contraseña</Label>
        <PasswordInput
          id={ids.password}
          name="password"
          autoComplete="new-password"
          enterKeyHint="go"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={describedBy(
            ids.passwordHint,
            fieldErrors.password && ids.passwordError,
          )}
        />
        <p id={ids.passwordHint} className="text-sm text-muted-foreground">
          {PASSWORD_HINT}
        </p>
        <FieldMessages id={ids.passwordError} messages={fieldErrors.password} />
      </div>

      <FormAlert message={state.formError} />

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        Crear cuenta
      </Button>

      <Button asChild variant="link">
        <Link href="/login">¿Ya tenés cuenta? Entrá</Link>
      </Button>
    </form>
  );
}
