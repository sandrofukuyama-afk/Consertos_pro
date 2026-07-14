import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/pwa/icon-template";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export function GET() {
  return new ImageResponse(<AppIcon />, size);
}
