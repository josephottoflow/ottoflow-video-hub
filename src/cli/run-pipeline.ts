/**
 * CLI: Run the full pipeline on all pending products.
 * Usage: npm run pipeline
 */

import * as dotenv from "dotenv";
dotenv.config();

import { validateConfig } from "../agents/config/config";
import { PipelineOrchestrator } from "../agents/pipeline/orchestrator";

async function main() {
  console.log("🏭 TikTok Product Video Factory\n");

  // Validate environment
  const validation = validateConfig();
  if (!validation.valid) {
    console.error("❌ Missing environment variables:");
    validation.missing.forEach((key) => console.error(`   - ${key}`));
    console.error("\nCopy .env.example to .env and fill in your keys.");
    process.exit(1);
  }

  console.log(`✅ Config valid (${validation.present.length} keys loaded)\n`);

  // Run pipeline
  const pipeline = new PipelineOrchestrator();
  const results = await pipeline.processAll();

  // Summary
  console.log("\n📊 Summary:");
  for (const r of results) {
    const icon = r.success ? "✅" : "❌";
    const time = `${Math.round(r.timing.durationMs / 1000)}s`;
    console.log(
      `  ${icon} ${r.productName} — ${r.success ? r.videoUrl : r.error} (${time})`
    );
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`\n${succeeded} succeeded, ${failed} failed.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
