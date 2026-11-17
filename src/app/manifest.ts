import type { MetadataRoute } from "next";

// Rosé Pine base: the splash screen and the status bar match the app's background.
import { BASE } from "@/lib/palette";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mi Grilla",
    short_name: "Mi Grilla",
    description: "Armá tu grilla del festival.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BASE,
    theme_color: BASE,
    // Served by src/app/icons/[size]/route.tsx, which only knows these two sizes.
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      // The monogram sits inside the maskable safe zone, so the same image serves both purposes.
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
