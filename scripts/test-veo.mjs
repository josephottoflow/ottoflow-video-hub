/**
 * Quick Veo access test — generates a 5s text-to-video clip (no image needed).
 * Run: node scripts/test-veo.mjs
 * Saves to: temp/veo-test.mp4
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = path.resolve(__dirname, "../.env");
const envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && !k.startsWith("#") && v.length) process.env[k.trim()] = v.join("=").trim();
}

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) { console.error("No GOOGLE_API_KEY in .env"); process.exit(1); }

const ai = new GoogleGenAI({ apiKey });

console.log("Starting Veo text-to-video test (5s, 9:16)...");
console.log("This takes 1-3 minutes. Polling every 10s.");

try {
  let op = await ai.models.generateVideos({
    model:  "veo-2.0-generate-001",
    prompt: "A glowing product on a dark studio background, slow zoom in, cinematic lighting, 9:16 portrait",
    config: {
      numberOfVideos:   1,
      durationSeconds:  5,
      aspectRatio:      "9:16",
    },
  });

  console.log(`Operation started: ${op.name}`);

  let attempts = 0;
  while (!op.done) {
    await new Promise(r => setTimeout(r, 10_000));
    op = await ai.operations.getVideosOperation({ operation: op });
    attempts++;
    console.log(`[${attempts * 10}s] done=${op.done}`);
    if (attempts > 36) { console.error("Timed out after 6 min"); process.exit(1); }
  }

  if (op.error) {
    console.error("Veo error:", JSON.stringify(op.error, null, 2));
    process.exit(1);
  }

  const vid = op.response?.generatedVideos?.[0]?.video;
  if (!vid) { console.error("No video in response"); process.exit(1); }

  const outDir = path.resolve(__dirname, "../temp");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "veo-test.mp4");

  if (vid.videoBytes) {
    fs.writeFileSync(outPath, Buffer.from(vid.videoBytes, "base64"));
    console.log(`\n✅ Success! Saved to ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)}MB)`);
  } else if (vid.uri) {
    console.log(`Video URI: ${vid.uri}`);
    console.log("Note: GCS URI — would need service account to download.");
    console.log("✅ Veo API access confirmed (Vertex AI path)");
  }
} catch (err) {
  console.error("\n❌ Veo test failed:", err.message || err);
  if (err.message?.includes("403") || err.message?.includes("permission")) {
    console.log("\nThis key doesn't have Veo access yet.");
    console.log("Enable it at: https://aistudio.google.com/");
  }
  process.exit(1);
}
