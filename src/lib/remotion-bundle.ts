/**
 * Shared Remotion bundle cache.
 * Both the render agent and the review API import from here so they
 * reuse the same webpack bundle across their lifetimes in one process.
 */

import * as path from "path";

// v13 — CTA scene 6s, shine/ring loops, resolveImage via Next.js
let _url:      string | null    = null;
let _pending:  Promise<string> | null = null;

export async function getBundleUrl(): Promise<string> {
  if (_url) return _url;
  if (_pending) return _pending;

  _pending = (async () => {
    console.log("[bundle] Building Remotion webpack bundle (one-time)…");
    const { bundle } = await import("@remotion/bundler");
    const url = await bundle({
      entryPoint: path.resolve("src/remotion/index.ts"),
      publicDir:  path.resolve("public"),
      onProgress: (p) => { if (p % 25 === 0) console.log(`[bundle] ${p}%`); },
    });
    console.log("[bundle] Ready →", url.slice(0, 60));
    _url = url;
    return url;
  })();

  try   { return await _pending; }
  finally { _pending = null; }
}
