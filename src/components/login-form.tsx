"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import { FormAlert } from "@/components/form-feedback";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AuthFormAction, INITIAL_FORM_STATE } from "@/lib/account-messages";

/**
 * Sign-in form. Every failure is one general message — a wrong password and an unknown email read
 * the same (NFR-04). After an error the email comes back filled; the password never does.
 */
export function LoginForm({ action }: { action: AuthFormAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_FORM_STATE);
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          enterKeyHint="next"
          required
          defaultValue={state.values.email}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>Contraseña</Label>
        <PasswordInput
          id={passwordId}
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          required
        />
      </div>

      <FormAlert message={state.formError} />

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        Entrar
      </Button>

      <Button asChild variant="link">
        <Link href="/register">¿Primera vez? Creá tu cuenta</Link>
      </Button>
    </form>
  );
}
