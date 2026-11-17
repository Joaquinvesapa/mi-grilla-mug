// The app icon, drawn for `next/og` (`ImageResponse`): only inline styles and flex layout, which is
// what Satori renders. One drawing for every size: the favicon, the iPhone home screen icon and the
// manifest icons (src/app/icon.tsx, apple-icon.tsx and icons/[size]/route.tsx).

// Satori does not read the app's CSS variables: the palette goes in as hex.
import { BASE, FOAM } from "@/lib/palette";

// No font weight: `next/og` draws with its bundled font, which only ships the regular weight.
// Sized against the side so that "MG" stays inside the maskable safe zone (the centered circle of
// 80 % of the side) on every size: Android crops a maskable icon to any shape within it.
const FONT_SCALE = 0.36;

export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: BASE,
      }}
    >
      <span
        style={{
          color: FOAM,
          fontSize: `${Math.round(size * FONT_SCALE)}px`,
          letterSpacing: "-0.04em",
          lineHeight: 1,
        }}
      >
        MG
      </span>
    </div>
  );
}
