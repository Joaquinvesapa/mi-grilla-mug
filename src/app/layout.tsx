import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public-sans",
});

export const metadata: Metadata = {
  title: "Mi Grilla",
  description: "Armá tu grilla del festival.",
};

// Zoom stays enabled: no maximum-scale and no user-scalable=no (mobile-native, hard rule 4).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#191724",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR" className={publicSans.variable}>
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
