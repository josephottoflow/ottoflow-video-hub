import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "puppeteer",
    "sharp",
    "googleapis",
  ],
  webpack: (config) => {
    // Remotion requires these externals
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;
