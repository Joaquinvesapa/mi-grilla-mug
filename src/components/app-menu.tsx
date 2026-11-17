"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { InstallGuide } from "@/components/install-guide";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { pendingChangesLabel } from "@/lib/selection-messages";

export type AppMenuProps = {
  userName: string;
  /** The logout Server Action: a POST with Next's origin check, never a GET (R-06 of FEAT-002). */
  logoutAction: () => void | Promise<void>;
  /** Shows that differ from what is saved: with any, signing out asks first (FR-12). */
  pendingCount: number;
};

/**
 * The menu button and the sheet it opens from the bottom: the greeting, how to install the app and
 * "Cerrar sesión". The sheet is Vaul's, so it follows the finger and closes with a swipe down or a
 * tap outside (gestures); the buttons inside are `data-vaul-no-drag`, so a tap never starts a drag.
 */
export function AppMenu({ userName, logoutAction, pendingCount }: AppMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const mustConfirm = pendingCount > 0;

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Menú">
          <Menu className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        {/* The sheet's body scrolls when the open guide is taller than 80dvh (360 × 640); Vaul
            lets it scroll and only drags the sheet from its top. */}
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-5 overflow-y-auto px-5 pt-2 pb-6">
          <DrawerHeader className="p-0 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="truncate text-xl">Hola, {userName}</DrawerTitle>
          </DrawerHeader>

          <div data-vaul-no-drag className="flex flex-col gap-3">
            <InstallGuide />
            {mustConfirm ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setConfirming(true)}
              >
                Cerrar sesión
              </Button>
            ) : (
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="lg" className="w-full">
                  Cerrar sesión
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Nested over the sheet: "Seguir editando" goes back to it, nothing is lost. */}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
              <AlertDialogDescription>
                Tenés {pendingChangesLabel(pendingCount)}. Si cerrás sesión ahora, se pierden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              {/* A plain submit, not AlertDialogAction: closing the dialog on click would unmount
                  the form before the browser submits it. */}
              <form action={logoutAction} className="contents">
                <Button type="submit" variant="destructive">
                  Salir sin guardar
                </Button>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * The screen's top bar: the app's name and the menu. It pads the notch itself (mobile-native,
 * fix 7), since `.app-fixed-screen` gives that inset back to the bars.
 */
export function AppBar(props: AppMenuProps) {
  return (
    <header className="shrink-0 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-14 items-center justify-between gap-3 pr-2 pl-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Mi <span className="text-primary">Grilla</span>
        </h1>
        <AppMenu {...props} />
      </div>
    </header>
  );
}
