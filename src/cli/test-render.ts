/**
 * Quick render test — verifies the programmatic render agent works.
 * Usage: npx tsx src/cli/test-render.ts
 */
import * as dotenv from "dotenv";
dotenv.config();
import * as fs from "fs";
import * as path from "path";
import { RenderAgent } from "../agents/render/render-agent";

async function main() {
  const slug = "what-is-six-sigma-in-15-seconds";
  const dataPath = path.resolve("public", "content", slug, "video-data.json");

  if (!fs.existsSync(dataPath)) {
    console.error(`❌ No video-data.json for "${slug}". Run the pipeline first.`);
    process.exit(1);
  }

  const videoData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const outputDir = path.resolve("temp", "test-render-prog");

  console.log("🎬 Testing programmatic render agent...\n");
  console.time("render");

  const agent = new RenderAgent();
  const result = await agent.render(slug, videoData, outputDir);

  console.timeEnd("render");
  if (result.success) {
    const mb = ((result.fileSizeBytes || 0) / 1_048_576).toFixed(1);
    console.log(`\n✅ Success — ${mb} MB → ${result.videoPath}`);
  } else {
    console.error(`\n❌ Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
