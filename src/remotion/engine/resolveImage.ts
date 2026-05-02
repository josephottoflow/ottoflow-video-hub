/**
 * RESOLVE IMAGE — Cross-compatible image URL resolver
 *
 * Works in both Remotion Studio (dev preview) and CLI render.
 * - HTTP URLs pass through unchanged
 * - Local paths use staticFile() for CLI rendering
 * - Falls back to Next.js server for Studio preview
 */
import { staticFile, getRemotionEnvironment } from "remotion";

const NEXTJS_BASE = "http://localhost:3000";

export function resolveImage(src: string): string {
  // Already an absolute URL
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }

  // Strip leading slash if present
  const cleanPath = src.startsWith("/") ? src.slice(1) : src;

  try {
    // staticFile works for CLI rendering (bundled public dir)
    const staticUrl = staticFile(cleanPath);

    // In rendering mode, staticFile is correct
    const env = getRemotionEnvironment();
    if (env.isRendering) {
      return staticUrl;
    }

    // In Studio/preview, serve from Next.js which properly handles static files
    return `${NEXTJS_BASE}/${cleanPath}`;
  } catch {
    // Fallback to Next.js server
    return `${NEXTJS_BASE}/${cleanPath}`;
  }
}
