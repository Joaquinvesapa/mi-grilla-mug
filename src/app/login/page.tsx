import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/auth-actions";
import { ForgetDeviceCopy } from "@/components/forget-device-copy";
import { InstallGuide } from "@/components/install-guide";
import { LoginForm } from "@/components/login-form";
import { getAccounts } from "@/server/accounts";

export const metadata: Metadata = {
  title: "Entrar · Mi Grilla",
};

// Dynamic: it reads the request's cookies. The headers are read before getAccounts(), so nothing
// creates Better Auth while `next build` prerenders.
export default async function LoginPage() {
  const requestHeaders = await headers();
  if (await getAccounts().getCurrentUser(requestHeaders)) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-10 pb-12">
      {/* Nobody is signed in here: the last user's device copy goes (R-03 of FEAT-003b). */}
      <ForgetDeviceCopy />
      <header className="flex flex-col gap-3 pb-2">
        <h1 className="text-5xl font-semibold tracking-tight">
          Mi <span className="text-primary">Grilla</span>
        </h1>
        <p className="max-w-[30ch] text-lg text-muted-foreground">
          Entrá con tu email para armar tu grilla y verla con tu grupo.
        </p>
      </header>

      <section aria-label="Entrar" className="app-card">
        <LoginForm action={loginAction} />
      </section>

      <section aria-labelledby="install" className="app-card">
        <h2 id="install" className="text-xl font-semibold">
          Instalala en tu iPhone
        </h2>
        <p className="text-muted-foreground">
          Sin tienda de apps: se suma desde Safari y abre a pantalla completa, como cualquier otra.
        </p>
        <InstallGuide />
      </section>
    </main>
  );
}
