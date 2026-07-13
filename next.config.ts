import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: "10mb",
  },
  serverExternalPackages: ["pdf-parse"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
