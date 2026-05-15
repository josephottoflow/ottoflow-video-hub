/**
 * API: /api/review/[slug]
 *
 * GET  → Instant compliance report (reads video-data.json, no rendering)
 * POST → Renders 6 scene stills at 50% scale + returns compliance report
 *
 * Stills are saved to public/content/{slug}/stills/ and served as static assets.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs   from "fs";
import * as path from "path";
import { getBundleUrl } from "@/lib/remotion-bundle";

// Scene frame positions (mid-point of each scene)
const SCENE_FRAMES: Record<string, number> = {
  hook:     30,   // 0–59
  problem:  105,  // 60–149
  hero:     210,  // 150–299
  features: 420,  // 300–599
  proof:    660,  // 600–749
  cta:      795,  // 750–839
};

// ─── Compliance checker ───────────────────────────────────────

function checkCompliance(data: Record<string, unknown>) {
  const checks: { agent: string; rule: string; pass: boolean; detail: string }[] = [];

  const add = (agent: string, rule: string, pass: boolean, detail: string) =>
    checks.push({ agent, rule, pass, detail });

  // Script Writer
  const hook  = data.hook  as Record<string, unknown> | undefined;
  const intro = data.productIntro as Record<string, unknown> | undefined;
  add("Script Writer", "Hook question present",   !!hook?.painPointQuestion, String(hook?.painPointQuestion || "—").slice(0, 60));
  add("Script Writer", "Product name present",    !!intro?.productName,      String(intro?.productName || "—"));
  add("Script Writer", "Tagline present",         !!intro?.tagline,          String(intro?.tagline || "—").slice(0, 60));

  // Design Agent / Branding Agent
  const colors = data.brandColors as Record<string, string> | undefined;
  const primary = (colors?.primary || "").toLowerCase();
  add("Design Agent",   "Brand colors set",          !!colors?.primary,                                 colors?.primary || "—");
  add("Branding Agent", "Ottoflow indigo applied",   primary === "#6366f1" || primary === "6366f1",     primary || "—");
  add("Design Agent",   "Background color set",      !!colors?.background,                              colors?.background || "—");

  // Prompt Engine — all 6 scene objects present
  const requiredScenes = ["hook","productIntro","simulatedDemo","imageShowcase","featureCallouts","socialProofCta"];
  for (const scene of requiredScenes) {
    add("Prompt Engine", `Scene: ${scene}`, scene in data, scene in data ? "✓" : "missing");
  }

  // Pexels Client
  const bgs    = data.backgrounds as { photos?: string[]; videos?: string[] } | undefined;
  const photos = bgs?.photos?.length ?? 0;
  const videos = bgs?.videos?.length ?? 0;
  add("Pexels Client", "Background photos fetched", photos > 0, `${photos} photo${photos !== 1 ? "s" : ""}`);
  add("Pexels Client", "Background videos fetched", videos > 0, `${videos} video${videos !== 1 ? "s" : ""}`);

  // Storyboard / Render Agent
  const imgs = (data.imageShowcase as Record<string, unknown[]> | undefined)?.images ?? [];
  add("Storyboard",   "Images in showcase",         imgs.length > 0,  `${imgs.length} image${imgs.length !== 1 ? "s" : ""}`);

  // Branding Agent — CTA
  const cta = (data.socialProofCta as Record<string, unknown> | undefined)?.ctaText;
  add("Branding Agent", "CTA text set",             !!cta, String(cta || "—").slice(0, 40));

  return checks;
}

// ─── GET — compliance only (instant) ─────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe     = slug.replace(/[^a-z0-9-]/g, "");
  const dataPath = path.resolve("public", "content", safe, "video-data.json");

  if (!fs.existsSync(dataPath)) {
    return NextResponse.json({ error: "No video-data.json found for this slug" }, { status: 404 });
  }

  let data: Record<string, unknown>;
  try   { data = JSON.parse(fs.readFileSync(dataPath, "utf-8")); }
  catch { return NextResponse.json({ error: "Malformed video-data.json" }, { status: 500 }); }

  const checks = checkCompliance(data);
  const pass   = checks.filter((c) => c.pass).length;
  const total  = checks.length;

  // Check which stills already exist
  const stillsDir = path.resolve("public", "content", safe, "stills");
  const stillsReady = fs.existsSync(stillsDir) &&
    Object.keys(SCENE_FRAMES).every((name) =>
      fs.existsSync(path.join(stillsDir, `scene-${name}.jpg`))
    );

  const stills = stillsReady
    ? Object.keys(SCENE_FRAMES).map((name) => `/content/${safe}/stills/scene-${name}.jpg`)
    : [];

  return NextResponse.json({ slug: safe, checks, pass, total, stills, stillsReady });
}

// ─── POST — render stills + compliance ───────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe     = slug.replace(/[^a-z0-9-]/g, "");
  const dataPath = path.resolve("public", "content", safe, "video-data.json");

  if (!fs.existsSync(dataPath)) {
    return NextResponse.json({ error: "No video-data.json for this slug" }, { status: 404 });
  }

  let data: Record<string, unknown>;
  try   { data = JSON.parse(fs.readFileSync(dataPath, "utf-8")); }
  catch { return NextResponse.json({ error: "Malformed video-data.json" }, { status: 500 }); }

  const checks = checkCompliance(data);

  // Render 6 stills
  const stillsDir = path.resolve("public", "content", safe, "stills");
  fs.mkdirSync(stillsDir, { recursive: true });

  try {
    const serveUrl = await getBundleUrl();
    const { renderStill, selectComposition } = await import("@remotion/renderer");

    const composition = await selectComposition({
      serveUrl,
      id:                   "cinematic",
      inputProps:           { data },
      timeoutInMilliseconds: 30_000,
    });

    const stills: string[] = [];

    for (const [name, frame] of Object.entries(SCENE_FRAMES)) {
      const outPath  = path.join(stillsDir, `scene-${name}.jpg`);
      const publicUrl = `/content/${safe}/stills/scene-${name}.jpg`;

      await renderStill({
        composition,
        serveUrl,
        frame,
        output:      outPath,
        imageFormat: "jpeg",
        jpegQuality: 85,
        scale:       0.5,            // 540×960 — fast, still readable
        inputProps:  { data },
        timeoutInMilliseconds: 30_000,
      });

      stills.push(publicUrl);
    }

    const pass = checks.filter((c) => c.pass).length;
    return NextResponse.json({ slug: safe, checks, pass, total: checks.length, stills, stillsReady: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Still render failed: ${msg}`, checks }, { status: 500 });
  }
}
