"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STEPS = [
  {
    title: "Abrí esta página en Safari",
    detail: "En iPhone solo Safari sabe sumar una web a la pantalla de inicio.",
  },
  {
    title: "Tocá Compartir",
    detail: "Es el cuadrado con la flecha hacia arriba, en la barra de abajo.",
  },
  {
    title: "Elegí “Agregar a pantalla de inicio”",
    detail: "Confirmá con “Agregar”: Mi Grilla queda con su ícono y abre a pantalla completa.",
  },
] as const;

export function InstallGuide() {
  return (
    <Collapsible className="flex flex-col gap-4">
      <CollapsibleTrigger asChild>
        <Button size="lg" className="w-full justify-between [&[data-state=open]>svg]:rotate-180">
          Cómo instalarla
          <ChevronDown className="transition-transform duration-150 ease-out" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-lg bg-background/60 p-4">
              <span
                aria-hidden="true"
                className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
