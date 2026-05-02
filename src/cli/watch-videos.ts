#!/usr/bin/env npx tsx
/**
 * WATCH VIDEOS — Live folder watcher
 * Monitors input/ for new product folders and auto-renders.
 *
 * Usage:
 *   npx tsx src/cli/watch-videos.ts
 *   npx tsx src/cli/watch-videos.ts --input ./my-photos --output ./my-videos
 */
import * as path from "path";
import { startWatcher } from "../agents/auto-pipeline/watcher";

const args = process.argv.slice(2);
const inputIdx = args.indexOf("--input");
const outputIdx = args.indexOf("--output");

const inputDir = inputIdx !== -1 ? args[inputIdx + 1] : path.resolve("input");
const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : path.resolve("outputs");

startWatcher(inputDir, outputDir);
