import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { registerAction } from "@/app/auth-actions";
import { RegisterForm } from "@/components/register-form";
import { getAccounts } from "@/server/accounts";

export const metadata: Metadata = {
  title: "Creá tu cuenta · Mi Grilla",
};

// Dynamic: it reads the request's cookies. The headers are read before getAccounts(), so nothing
// creates Better Auth while `next build` prerenders.
export default async function RegisterPage() {
  const requestHeaders = await headers();
  if (await getAccounts().getCurrentUser(requestHeaders)) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-10 pb-12">
      <header className="flex flex-col gap-3 pb-2">
        <h1 className="text-4xl font-semibold tracking-tight">Creá tu cuenta</h1>
        <p className="max-w-[32ch] text-lg text-muted-foreground">
          Con tu email y una contraseña. El nombre es el que van a ver tus amigos en los grupos.
        </p>
      </header>

      <section aria-label="Crear cuenta" className="app-card">
        <RegisterForm action={registerAction} />
      </section>
    </main>
  );
}
