import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { SerwistProvider } from "@/components/serwist-provider";
import { BASE } from "@/lib/palette";

import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "Mi Grilla",
  description: "Armá tu grilla del festival.",
  // Served from src/app/manifest.ts.
  manifest: "/manifest.webmanifest",
  // Added to the iPhone home screen it opens full screen, edge to edge under the status bar (the
  // shell already pads the safe areas), with its own name under the icon.
  appleWebApp: {
    capable: true,
    title: "Mi Grilla",
    statusBarStyle: "black-translucent",
  },
};

// Zoom stays enabled: no maximum-scale and no user-scalable=no (mobile-native, hard rule 4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BASE,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR" className={publicSans.variable}>
      <body>
        <SerwistProvider>
          <div className="app-shell">{children}</div>
        </SerwistProvider>
      </body>
    </html>
  );
}
