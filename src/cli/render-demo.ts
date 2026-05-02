/**
 * CLI: Render the ClaudeVideoExport.com demo video directly.
 * Usage: npx tsx src/cli/render-demo.ts
 */
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

const outputDir = path.resolve("outputs", "demo");
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, "claude-video-export-demo.mp4");

console.log("🎬 Rendering ClaudeVideoExport.com demo video...\n");
console.log("  Composition: demo-video");
console.log("  Resolution:  1080x1920 (9:16 portrait)");
console.log("  Duration:    33.5 seconds (1005 frames @ 30fps)");
console.log(`  Output:      ${outputPath}\n`);

try {
  execSync(
    `npx remotion render src/remotion/index.ts demo-video ${outputPath} --concurrency=4`,
    { stdio: "inherit", cwd: process.cwd() }
  );
  console.log(`\n✅ Demo video rendered: ${outputPath}`);

  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
  console.log(`   Size: ${sizeMB} MB`);
} catch (error) {
  console.error("\n❌ Render failed:", error);
  process.exit(1);
}
