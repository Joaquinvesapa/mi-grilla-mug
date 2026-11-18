import type { Metadata } from "next";
import { connection } from "next/server";

import { DemoStage } from "@/components/demo-stage";
import { getSchedule } from "@/server/schedule";

export const metadata: Metadata = {
  title: "Demo · Mi Grilla",
};

export default async function DemoPage() {
  // The grid comes from the database: read at request time, never while `next build` prerenders.
  await connection();
  // Without it the clock still works; it only loses the mini timeline.
  const schedule = await getSchedule();

  return (
    <main className="flex h-dvh flex-col items-center gap-5 px-6 py-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Mi <span className="text-primary">Grilla</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          La app de verdad, en un iPhone. Tocá y scrolleá adentro del marco.
        </p>
      </header>
      <DemoStage schedule={schedule.ok ? schedule.schedule : undefined} />
    </main>
  );
}
