#!/usr/bin/env npx tsx
/**
 * PROCESS VIDEOS — One-shot batch processor
 * Scans input/ folder, builds video data, renders all templates.
 *
 * Usage:
 *   npx tsx src/cli/process-videos.ts
 *   npx tsx src/cli/process-videos.ts --input ./my-photos --output ./my-videos
 */
import * as path from "path";
import { processBatch } from "../agents/auto-pipeline/watcher";

const args = process.argv.slice(2);
const inputIdx = args.indexOf("--input");
const outputIdx = args.indexOf("--output");

const inputDir = inputIdx !== -1 ? args[inputIdx + 1] : path.resolve("input");
const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : path.resolve("outputs");

processBatch(inputDir, outputDir);
