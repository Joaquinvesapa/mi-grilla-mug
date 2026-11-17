import { ImageResponse } from "next/og";

import { AppIcon } from "@/components/app-icon";

// The size iOS asks for on the home screen; it rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={size.width} />, size);
}
