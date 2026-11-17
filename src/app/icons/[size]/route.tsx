import { ImageResponse } from "next/og";

import { AppIcon } from "@/components/app-icon";

// The manifest icons (src/app/manifest.ts). Any other size is a 404, without drawing anything.
const ICON_SIZES = ["192", "512"] as const;

type IconSize = (typeof ICON_SIZES)[number];

function isIconSize(value: string): value is IconSize {
  return (ICON_SIZES as readonly string[]).includes(value);
}

// Both sizes are drawn at build time; a size outside the list never reaches GET.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { size: IconSize }[] {
  return ICON_SIZES.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const { size } = await params;
  if (!isIconSize(size)) return new Response(null, { status: 404 });

  const side = Number(size);
  return new ImageResponse(<AppIcon size={side} />, { width: side, height: side });
}
