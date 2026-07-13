import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
    proxyClientMaxBodySize: "25mb",
  },
  serverExternalPackages: ["pdf-parse"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
