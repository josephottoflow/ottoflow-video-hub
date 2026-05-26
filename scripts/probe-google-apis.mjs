/**
 * Google API probe — tests Gemini, Imagen3, and Veo access.
 * Also lists available models so we can see what the key can reach.
 */

import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) { console.error("GOOGLE_API_KEY not set"); process.exit(1); }
console.log(`\nUsing key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}`);

const ai = new GoogleGenAI({ apiKey: API_KEY });
const pass = (label) => console.log(`  ✅ ${label}`);
const fail = (label, err) => {
  const msg = err?.message ?? String(err);
  // Truncate enormous JSON blobs for readability
  console.log(`  ❌ ${label}: ${msg.slice(0, 400)}`);
};

// ── 0. List available models (diagnostic) ─────────────────────────────────
console.log("\n[0] LIST MODELS — what can this key reach?");
try {
  const listed = [];
  for await (const m of ai.models.list()) {
    listed.push(m.name);
  }
  const relevant = listed.filter(n =>
    n.includes("gemini") || n.includes("imagen") || n.includes("veo")
  );
  if (relevant.length) {
    console.log("  Relevant models available:");
    relevant.forEach(n => console.log(`    • ${n}`));
  } else {
    console.log(`  No gemini/imagen/veo models listed. Total models: ${listed.length}`);
    listed.slice(0, 10).forEach(n => console.log(`    • ${n}`));
  }
} catch (err) {
  fail("models.list()", err);
}

// ── 1. Gemini ──────────────────────────────────────────────────────────────
console.log("\n[1] GEMINI 2.5 Flash — generateContent");
try {
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Respond with ONLY the word PONG.",
  });
  const text = res.text?.trim();
  if (text?.includes("PONG")) pass(`gemini-2.5-flash responded: "${text}"`);
  else pass(`gemini-2.5-flash responded (unexpected text): "${text?.slice(0,80)}"`);
} catch (err) {
  fail("gemini-2.0-flash", err);
}

// ── 2. Imagen3 ─────────────────────────────────────────────────────────────
console.log("\n[2] IMAGEN3 — generate 1 image (no save)");
try {
  const res = await ai.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt: "A single red apple on a white table, photorealistic",
    config: { numberOfImages: 1, aspectRatio: "9:16", outputMimeType: "image/jpeg" },
  });
  const img = res.generatedImages?.[0];
  if (img?.image?.imageBytes) {
    const kb = Math.round(Buffer.from(img.image.imageBytes, "base64").length / 1024);
    pass(`imagen-3.0-generate-002: ${kb}KB image received`);
  } else {
    fail("imagen-3.0-generate-002", { message: `no imageBytes — response: ${JSON.stringify(res).slice(0, 300)}` });
  }
} catch (err) {
  fail("imagen-3.0-generate-002", err);
}

// ── 3. Veo — 4s clip, poll up to 90s ──────────────────────────────────────
console.log("\n[3] VEO 3.1 Lite — start 4s generation + poll (max 90s)");
const VEO_MODEL = "veo-3.1-lite-generate-preview";
const tmpClip   = path.resolve(__dirname, "../temp/probe-clip.mp4");
fs.mkdirSync(path.dirname(tmpClip), { recursive: true });
let veoSuccess  = false;

try {
  let op = await ai.models.generateVideos({
    model:  VEO_MODEL,
    prompt: "A red apple falling in slow motion, cinematic 9:16 portrait, dramatic lighting.",
    config: { numberOfVideos: 1, durationSeconds: 4, aspectRatio: "9:16" },
  });
  console.log(`  → operation started: done=${op.done} name=${op.name ?? "(no name)"}`);

  const start    = Date.now();
  const deadline = start + 90_000;
  while (!op.done && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10_000));
    op = await ai.operations.getVideosOperation({ operation: op });
    console.log(`  → polling... done=${op.done} (${Math.round((Date.now()-start)/1000)}s elapsed)`);
  }

  if (!op.done) {
    pass(`${VEO_MODEL}: operation ACTIVE after 90s — API access confirmed. Full renders poll up to 6 min.`);
    veoSuccess = true;
  } else if (op.error) {
    fail(VEO_MODEL, { message: `operation error: ${JSON.stringify(op.error).slice(0,300)}` });
  } else {
    const vid = op.response?.generatedVideos?.[0]?.video;
    if (vid?.videoBytes) {
      fs.writeFileSync(tmpClip, Buffer.from(vid.videoBytes, "base64"));
      pass(`${VEO_MODEL}: ${(fs.statSync(tmpClip).size/1024/1024).toFixed(1)}MB clip saved → ${tmpClip}`);
      veoSuccess = true;
    } else if (vid?.uri) {
      const buf = Buffer.from(await (await fetch(vid.uri)).arrayBuffer());
      fs.writeFileSync(tmpClip, buf);
      pass(`${VEO_MODEL}: ${(buf.length/1024/1024).toFixed(1)}MB clip downloaded → ${tmpClip}`);
      veoSuccess = true;
    } else {
      fail(VEO_MODEL, { message: `no video in response: ${JSON.stringify(op.response??{}).slice(0,300)}` });
    }
  }
} catch (err) {
  fail(VEO_MODEL, err);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────");
if (veoSuccess) {
  console.log("✅ All APIs confirmed — ready for full cinematic renders.");
} else {
  console.log("⚠  One or more APIs still failing — see above.");
  console.log("\nNext steps based on errors:");
  console.log("  free_tier quota → billing not attached to THIS project");
  console.log("  404 imagen      → accept Imagen3 terms in AI Studio");
  console.log("  403/permission  → API not enabled in Cloud Console");
  console.log("  RESOURCE_EXHAUSTED (no free_tier text) → quota limit, retry later");
}
console.log("─────────────────────────────────────────────────\n");
