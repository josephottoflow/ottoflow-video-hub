import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow OffthreadVideo (WebCodecs) to fetch video files from this server
  // when rendered by the Remotion bundle server on a different port.
  async headers() {
    return [
      {
        source: "/content/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, HEAD" },
          { key: "Access-Control-Allow-Headers", value: "Range" },
          { key: "Access-Control-Expose-Headers", value: "Content-Range, Accept-Ranges, Content-Length" },
        ],
      },
    ];
  },

  serverExternalPackages: [
    // Heavy native / server-only packages — keep out of webpack client bundle
    "puppeteer",
    "sharp",
    "googleapis",
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/cli",
    "@remotion/media",
    "@remotion/google-fonts",
    // DB / queue — native bindings or path-dependent require() calls
    "pg",
    "pg-native",
    "ioredis",
    "bullmq",
    "ffmpeg-static",
    "@google/genai",
  ],

  webpack: (config, { isServer }) => {
    // Prevent Node-only built-ins from being bundled in the client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:            false,
        path:          false,
        crypto:        false,
        stream:        false,
        child_process: false,
        net:           false,
        tls:           false,
      };
    }
    return config;
  },
};

export default nextConfig;
