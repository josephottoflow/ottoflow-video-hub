/**
 * FOLDER WATCHER — Monitors input directory for new product folders
 * Triggers auto-build + render when new images are detected.
 */
import * as fs from "fs";
import * as path from "path";
import { scanInputFolder, buildFromFolder } from "./data-builder";
import { detectImages } from "./image-detector";
import { execSync } from "child_process";

const POLL_INTERVAL_MS = 3000;  // Check every 3 seconds
const SETTLE_TIME_MS = 5000;    // Wait 5s after last change before processing

interface WatchState {
  knownFolders: Map<string, { imageCount: number; lastChange: number; processed: boolean }>;
  running: boolean;
}

/**
 * Render a single product with a specific template
 */
function renderTemplate(slug: string, templateId: string, outputDir: string): boolean {
  const propsPath = path.resolve("public", "content", slug, "video-data.json");
  if (!fs.existsSync(propsPath)) {
    console.error(`[watcher] No video data for ${slug}`);
    return false;
  }

  const outputPath = path.join(outputDir, `${slug}-${templateId}.mp4`);

  // Write props file that Remotion expects
  const videoData = JSON.parse(fs.readFileSync(propsPath, "utf-8"));
  const renderPropsPath = path.join(outputDir, `${slug}-${templateId}-props.json`);
  fs.writeFileSync(renderPropsPath, JSON.stringify({ data: videoData }));

  const cmd = [
    "npx remotion render",
    "src/remotion/index.ts",
    templateId,
    outputPath,
    `--props="${renderPropsPath}"`,
    "--codec=h264",
    "--image-format=jpeg",
    "--jpeg-quality=90",
    "--width=1080",
    "--height=1920",
    "--port=3100",
    "--log=verbose",
  ].join(" ");

  try {
    console.log(`[watcher] Rendering ${slug} with template "${templateId}"...`);
    execSync(cmd, { stdio: "inherit", timeout: 300000, cwd: path.resolve(".") });

    if (fs.existsSync(outputPath)) {
      const size = (fs.statSync(outputPath).size / 1048576).toFixed(1);
      console.log(`[watcher] Done: ${outputPath} (${size}MB)`);
      return true;
    }
  } catch (err) {
    console.error(`[watcher] Render failed for ${slug}/${templateId}:`, err instanceof Error ? err.message : err);
  }
  return false;
}

/**
 * Process a single product folder — build data + render all templates
 */
async function processFolder(folderPath: string, outputBaseDir: string): Promise<void> {
  const result = await buildFromFolder(folderPath);

  console.log(`\n[watcher] === Processing: ${result.productName} ===`);
  console.log(`[watcher] Images: ${result.imageCount}`);
  console.log(`[watcher] Templates: ${result.templates.join(", ")}`);

  const outputDir = path.join(outputBaseDir, result.slug);
  fs.mkdirSync(outputDir, { recursive: true });

  let success = 0;
  for (const templateId of result.templates) {
    if (renderTemplate(result.slug, templateId, outputDir)) {
      success++;
    }
  }

  console.log(`[watcher] === ${result.productName}: ${success}/${result.templates.length} videos rendered ===\n`);
}

/**
 * One-shot batch: process all folders in input directory
 */
export async function processBatch(inputDir: string, outputDir: string): Promise<void> {
  console.log(`\n[batch] Scanning ${inputDir}...`);
  const results = await scanInputFolder(inputDir);

  if (results.length === 0) {
    console.log("[batch] No products found. Add folders with images to the input directory.");
    return;
  }

  console.log(`[batch] Found ${results.length} products\n`);

  for (const result of results) {
    const productOutputDir = path.join(outputDir, result.slug);
    fs.mkdirSync(productOutputDir, { recursive: true });

    let success = 0;
    for (const templateId of result.templates) {
      if (renderTemplate(result.slug, templateId, productOutputDir)) {
        success++;
      }
    }
    console.log(`[batch] ${result.productName}: ${success}/${result.templates.length} videos`);
  }

  console.log("\n[batch] All done!");
}

/**
 * Live watcher: poll input directory for new/changed folders
 */
export function startWatcher(inputDir: string, outputDir: string): void {
  console.log(`\n[watcher] Watching: ${inputDir}`);
  console.log(`[watcher] Output:   ${outputDir}`);
  console.log(`[watcher] Polling every ${POLL_INTERVAL_MS / 1000}s, settle time ${SETTLE_TIME_MS / 1000}s`);
  console.log(`[watcher] Press Ctrl+C to stop\n`);

  const state: WatchState = {
    knownFolders: new Map(),
    running: true,
  };

  // Initial scan
  if (fs.existsSync(inputDir)) {
    const entries = fs.readdirSync(inputDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const folderPath = path.join(inputDir, entry.name);
      const images = detectImages(folderPath);
      state.knownFolders.set(entry.name, {
        imageCount: images.total,
        lastChange: Date.now(),
        processed: images.total > 0,  // Mark existing as already processed
      });
    }
    console.log(`[watcher] Found ${state.knownFolders.size} existing folders (skipping)`);
  }

  const poll = async () => {
    if (!state.running) return;

    try {
      if (!fs.existsSync(inputDir)) {
        fs.mkdirSync(inputDir, { recursive: true });
      }

      const entries = fs.readdirSync(inputDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

        const folderPath = path.join(inputDir, entry.name);
        const images = detectImages(folderPath);

        if (images.total === 0) continue;

        const known = state.knownFolders.get(entry.name);

        if (!known) {
          // New folder
          console.log(`[watcher] New folder detected: ${entry.name} (${images.total} images)`);
          state.knownFolders.set(entry.name, {
            imageCount: images.total,
            lastChange: Date.now(),
            processed: false,
          });
        } else if (images.total !== known.imageCount) {
          // Image count changed
          console.log(`[watcher] Folder updated: ${entry.name} (${known.imageCount} -> ${images.total} images)`);
          known.imageCount = images.total;
          known.lastChange = Date.now();
          known.processed = false;
        } else if (!known.processed && Date.now() - known.lastChange >= SETTLE_TIME_MS) {
          // Settled — time to process
          console.log(`[watcher] Folder settled: ${entry.name} — processing...`);
          await processFolder(folderPath, outputDir);
          known.processed = true;
        }
      }
    } catch (err) {
      console.error("[watcher] Poll error:", err instanceof Error ? err.message : err);
    }

    setTimeout(poll, POLL_INTERVAL_MS);
  };

  poll();
}
