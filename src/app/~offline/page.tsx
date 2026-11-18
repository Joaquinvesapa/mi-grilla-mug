import type { Metadata } from "next";

import { logoutAction } from "@/app/auth-actions";
import { saveSelectionAction } from "@/app/selection-actions";
import { OfflineApp } from "@/components/offline-app";

export const metadata: Metadata = {
  title: "Sin conexión · Mi Grilla",
};

// The screen the service worker answers with when a navigation fails for lack of network
// (src/app/sw.ts), in place of the URL that failed. It is precached together with its CSS, JS and
// font, so it keeps the app's look with no signal at all. A server component that only hands the
// Server Actions to OfflineApp, the client code that picks, in the browser, between the grid from
// the device copy and the "Sin conexión" card (ADR-004). The actions' ids are this build's, and
// each build replaces the precached page (R-05 of FEAT-001).
export default function OfflinePage() {
  return <OfflineApp saveAction={saveSelectionAction} logoutAction={logoutAction} />;
}
