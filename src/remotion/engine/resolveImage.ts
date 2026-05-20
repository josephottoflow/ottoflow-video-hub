/**
 * RESOLVE IMAGE — Cross-compatible image/video URL resolver
 *
 * Always serves through Next.js (port 3000) which reads public/ from disk.
 * This avoids the Remotion bundle's static-copy of publicDir which is taken
 * at bundle-build time — new downloads after the bundle is cached would 404.
 */

const NEXTJS_BASE = process.env.REMOTION_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function resolveImage(src: string): string {
  // Already an absolute URL — pass through unchanged
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // Strip leading slash if present
  const cleanPath = src.startsWith("/") ? src.slice(1) : src;

  // Serve from Next.js — always up-to-date, not limited to bundle snapshot
  return `${NEXTJS_BASE}/${cleanPath}`;
}
