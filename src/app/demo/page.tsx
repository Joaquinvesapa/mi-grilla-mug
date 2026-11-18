import type { Metadata } from "next";

import { DemoStage } from "@/components/demo-stage";

export const metadata: Metadata = {
  title: "Demo · Mi Grilla",
};

export default function DemoPage() {
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
      <DemoStage />
    </main>
  );
}
