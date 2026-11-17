import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/auth-actions";
import { InstallGuide } from "@/components/install-guide";
import { Button } from "@/components/ui/button";
import { getAccounts } from "@/server/accounts";

type Feature = {
  id: string;
  title: string;
  body: string;
  preview: ReactNode;
};

const FEATURES: Feature[] = [
  {
    id: "grilla",
    title: "Armá tu grilla",
    body: "Marcá los shows que querés ver, día por día y escenario por escenario, y mirá de un vistazo cuándo se pisan.",
    preview: <GridPreview />,
  },
  {
    id: "bloqueo",
    title: "Llevala en la pantalla de bloqueo",
    body: "Bajá tu día como fondo para el iPhone: lo que elegiste, encendido; el resto, en segundo plano.",
    preview: <LockScreenPreview />,
  },
  {
    id: "grupo",
    title: "Coincidí con tu grupo",
    body: "Sumá a tus amigos a un grupo y mirá quién va a cada show, para saber dónde encontrarse.",
    preview: <GroupPreview />,
  },
];

// Needs a session (FR-09). The proxy already sent away requests without a cookie; here the session
// is verified for real, so a made-up, expired or closed-session cookie ends on /login too, before
// anything protected renders (R-15). Dynamic: it reads the request's cookies, and the service
// worker never caches it (R-17). The headers are read before getAccounts(), so nothing creates
// Better Auth while `next build` prerenders.
export default async function HomePage() {
  const requestHeaders = await headers();
  const user = await getAccounts().getCurrentUser(requestHeaders);
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-10 pb-12">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-muted-foreground">Hola, {user.name}</p>
        {/* A POST through a Server Action, with Next's origin check: a GET never signs out (R-06). */}
        <form action={logoutAction} className="shrink-0">
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
      </div>

      <header className="flex flex-col gap-3 pb-2">
        <h1 className="text-5xl font-semibold tracking-tight">
          Mi <span className="text-primary">Grilla</span>
        </h1>
        <p className="max-w-[30ch] text-lg text-muted-foreground">
          Tu festival, show por show. Elegí a quién vas a ver y llevalo con vos.
        </p>
      </header>

      {FEATURES.map((feature) => (
        <section key={feature.id} aria-labelledby={`feature-${feature.id}`} className="app-card">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`feature-${feature.id}`} className="text-xl font-semibold">
              {feature.title}
            </h2>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Muy pronto
            </span>
          </div>
          <p className="text-muted-foreground">{feature.body}</p>
          <div aria-hidden="true">{feature.preview}</div>
        </section>
      ))}

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

// Decorative previews: drawn with the palette, no real data and no names.

const GRID_COLUMNS: { span: number; picked?: boolean }[][] = [
  [{ span: 2 }, { span: 2, picked: true }, { span: 1 }],
  [{ span: 1 }, { span: 3 }, { span: 1, picked: true }],
  [{ span: 3, picked: true }, { span: 2 }],
  [{ span: 2 }, { span: 1 }, { span: 2, picked: true }],
];

function GridPreview() {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {GRID_COLUMNS.map((column, columnIndex) => (
        <div key={columnIndex} className="grid grid-rows-5 gap-1.5">
          {column.map((slot, slotIndex) => (
            <div
              key={slotIndex}
              style={{ gridRow: `span ${slot.span}` }}
              className={
                slot.picked
                  ? "min-h-6 rounded-md bg-primary"
                  : "min-h-6 rounded-md bg-rp-highlight-high"
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LockScreenPreview() {
  return (
    <div className="mx-auto flex w-36 flex-col items-center gap-3 rounded-2xl border border-border bg-background px-3 pt-5 pb-4">
      <p className="tabular text-4xl font-semibold tracking-tight">21:40</p>
      <p className="text-xs text-muted-foreground">Sábado</p>
      <div className="grid w-full grid-cols-3 gap-1">
        {[false, true, false, true, false, false, false, false, true].map((lit, index) => (
          <div
            key={index}
            className={lit ? "h-5 rounded-sm bg-primary" : "h-5 rounded-sm bg-rp-highlight-med"}
          />
        ))}
      </div>
    </div>
  );
}

const GROUP_ROWS = [
  { time: "18:15", friends: ["CA", "JM"] },
  { time: "20:00", friends: ["CA", "LU", "SV", "JM"] },
  { time: "22:30", friends: ["SV"] },
];

function GroupPreview() {
  return (
    <ul className="flex flex-col gap-2">
      {GROUP_ROWS.map((row) => (
        <li
          key={row.time}
          className="flex items-center gap-3 rounded-lg bg-background/60 px-3 py-2"
        >
          <span className="tabular text-sm text-muted-foreground">{row.time}</span>
          <span className="h-2 flex-1 rounded-full bg-rp-highlight-med" />
          <span className="flex -space-x-1.5">
            {row.friends.map((initials) => (
              <span
                key={initials}
                className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-accent text-[0.625rem] font-semibold"
              >
                {initials}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
