/**
 * RENDER WORKER — BullMQ job processor
 *
 * Start with: npm run worker
 *
 * Pulls render jobs from Redis/BullMQ queue, runs the full pipeline
 * via PipelineOrchestrator, and writes results back to PostgreSQL.
 *
 * Concurrency: WORKER_CONCURRENCY env var (default: 2)
 * Lock duration: 10 minutes (renders can take up to 8 min)
 */

import "dotenv/config";
import * as http from "http";
import * as fs   from "fs";
import * as path from "path";
import { Worker, Job } from "bullmq";
import { getRenderRedis, RENDER_QUEUE, RenderJobData } from "../lib/queue";
import { enqueueRender } from "../lib/queue";
import { PipelineOrchestrator }   from "../agents/pipeline/orchestrator";
import { PipelineOrchestratorV2 } from "../agents/pipeline/orchestrator-v2";
import { updateJobStatus, markStuckJobsError, getJob, touchWorkerHeartbeat, runMigrations, updateJobProgress, createJob } from "../lib/db";
import { ensureBrowser } from "@remotion/renderer";
import { RenderAgent } from "../agents/render/render-agent";
import { emitLog, inferAgent, inferLevel, setStatus, clearLogs, store } from "../lib/pipeline-store";

const CONCURRENCY      = parseInt(process.env.WORKER_CONCURRENCY || "1", 10);
const HEARTBEAT_MS     = 180_000;   // 3 min — matches advanced worker; reduces idle Redis commands
const OOM_RSS_LIMIT_MB = 1_400;     // reject new jobs above this threshold and schedule restart

function probeEnv(): void {
  const check = (key: string, label?: string) =>
    `${label ?? key}: ${process.env[key] ? "✓" : "✗ MISSING"}`;
  const redisUrl = (process.env.REDIS_URL ?? "").replace(/:[^:@]+@/, ":***@");
  console.log("[worker] ══════════════════════ ENV PROBE ══════════════════════");
  console.log(`[worker]   ${check("GOOGLE_API_KEY",     "Gemini + Veo (AI brain + video gen)")}`);
  console.log(`[worker]   ${check("ELEVENLABS_API_KEY", "ElevenLabs voiceover")}`);
  console.log(`[worker]   ${check("JAMENDO_CLIENT_ID",  "Jamendo music")}`);
  console.log(`[worker]   ${check("TELEGRAM_BOT_TOKEN", "Telegram delivery")}`);
  console.log(`[worker]   ${check("TELEGRAM_CHAT_ID",   "Telegram chat")}`);
  console.log(`[worker]   ${check("R2_ACCOUNT_ID",      "Cloudflare R2 uploads")}`);
  console.log(`[worker]   REDIS_URL: ${redisUrl || "✗ MISSING"}`);
  console.log(`[worker]   UPSTASH_URL: ${process.env.UPSTASH_URL ? "✓" : "(not set — logs go to REDIS_URL)"}`);
  console.log(`[worker]   PORT: ${process.env.PORT ?? "3000 (default)"}`);
  console.log(`[worker]   WORKER_CONCURRENCY: ${CONCURRENCY}`);
  console.log(`[worker]   OOM_RSS_LIMIT_MB: ${OOM_RSS_LIMIT_MB}`);
  console.log("[worker] ════════════════════════════════════════════════════════");
}

// Serve public/ on localhost:3000 so Remotion Chrome can fetch background files.
// Falls back silently if Next.js dev server already holds the port.
function startStaticServer() {
  const publicDir = path.resolve("public");
  // Railway injects PORT; fall back to 3000 for local dev
  const port      = parseInt(process.env.PORT || "3000", 10);
  const MIME: Record<string, string> = {
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".json": "application/json",
  };

  const ADMIN_SECRET = process.env.NEXTAUTH_SECRET || "";

  const server = http.createServer((req, res) => {
    // Railway health check
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    // Admin queue endpoint — POST /api/queue
    if (req.method === "POST" && req.url === "/api/queue") {
      const auth = req.headers["authorization"] || "";
      if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        (async () => {
          try {
            const payload = JSON.parse(body) as {
              rowIndex: number; topic: string; style?: string;
              template?: string; version?: "v1" | "v2";
            };
            const { rowIndex, topic, style = "Educational", version } = payload;
            const template = payload.template ?? await RenderAgent.selectTemplate(topic, style);
            const job = await createJob(rowIndex, topic, template, { version: version ?? "v1" });
            await enqueueRender({ rowIndex, template, topic, dbJobId: job.id });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, jobId: job.id, template }));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }));
          }
        })();
      });
      return;
    }

    const relPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.join(publicDir, relPath);
    if (!filePath.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[worker] Port ${port} in use — Next.js is already serving public/ ✓`);
    } else {
      console.error("[worker] Static server error:", err.message);
    }
  });

  // Bind to 0.0.0.0 so Railway's health check can reach it
  server.listen(port, "0.0.0.0", () =>
    console.log(`[worker] Static file server → http://0.0.0.0:${port}/ (serves public/, health: /health)`)
  );
}

async function checkRedis(): Promise<void> {
  try {
    await getRenderRedis().ping();
    console.log("[worker] Redis connected ✓");
  } catch (err) {
    console.error("[worker] Cannot reach Redis:", err instanceof Error ? err.message : err);
    console.error("[worker] Check REDIS_URL in .env — should point to Railway Redis (redis.railway.internal).");
    process.exit(1);
  }
}

// Purge temp dirs older than MAX_TEMP_AGE_MS on startup + after each render.
// Prevents disk exhaustion from accumulated failed render artifacts.
const TEMP_DIR_PATH    = path.resolve(process.env.TEMP_DIR ?? "./temp");
const OUT_DIR_PATH     = path.resolve(process.env.OUTPUT_DIR ?? "./outputs");
const CONTENT_DIR_PATH = path.resolve("public", "content");
const MAX_TEMP_AGE_MS  = 24 * 60 * 60 * 1_000; // 24 hours

function purgeOldWorkDirs(): void {
  for (const base of [TEMP_DIR_PATH, OUT_DIR_PATH, CONTENT_DIR_PATH]) {
    try {
      if (!fs.existsSync(base)) continue;
      const cutoff = Date.now() - MAX_TEMP_AGE_MS;
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const full = path.join(base, entry.name);
        try {
          const { mtimeMs } = fs.statSync(full);
          if (mtimeMs < cutoff) {
            fs.rmSync(full, { recursive: true, force: true });
            console.log(`[worker] Purged stale dir: ${full}`);
          }
        } catch { /* skip undeletable entries */ }
      }
    } catch { /* non-fatal */ }
  }
}

async function processJob(job: Job<RenderJobData>): Promise<void> {
  const { rowIndex, template, topic, dbJobId, version, renderVariant, hookStyle, musicVibe } = job.data;

  // OOM guard — reject job if RSS is already dangerously high
  const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  if (rssMb > OOM_RSS_LIMIT_MB) {
    console.error(`[worker] OOM guard: RSS=${rssMb}MB > ${OOM_RSS_LIMIT_MB}MB — rejecting job ${dbJobId} and restarting`);
    // Throw so BullMQ marks the job failed and Railway restarts the container
    throw new Error(`Worker OOM guard triggered (RSS=${rssMb}MB) — job will be retried after restart`);
  }

  // Routing: v2-ugc template implies v2 orchestrator even if version field is absent
  const effectiveVersion = version ?? (template === "v2-ugc" ? "v2" : "v1");

  console.log(`\n[worker] ════════════════════ JOB START ════════════════════`);
  console.log(`[worker] Job ID : ${dbJobId}`);
  console.log(`[worker] Topic  : ${topic}`);
  console.log(`[worker] Row    : ${rowIndex} | Template: ${template} | Version: ${effectiveVersion}`);
  console.log(`[worker] Variant: ${renderVariant ?? "default"} | Hook: ${(job.data as {hookStyle?:string}).hookStyle ?? "default"} | Vibe: ${musicVibe ?? "default"}`);
  console.log(`[worker] Memory : RSS=${rssMb}MB | Limit=${OOM_RSS_LIMIT_MB}MB`);
  console.log(`[worker] ═══════════════════════════════════════════════════`);

  // Check if this job was killed via the UI before we start any work
  try {
    const dbJob = await getJob(dbJobId);
    if (dbJob?.status === "error") {
      console.log(`[worker] Job ${dbJobId} was killed — skipping`);
      return;
    }
  } catch { /* db blip — proceed */ }

  clearLogs();

  try {
    await updateJobStatus(dbJobId, "processing", { bull_job_id: job.id });
  } catch (err) {
    console.warn("[worker] Could not update job status to processing:", err instanceof Error ? err.message : err);
  }

  // Sync pipeline-store progress → BullMQ + DB every 5s so UI shows real-time %
  const progressInterval = setInterval(() => {
    const pct = store.progress;
    job.updateProgress(pct).catch(() => {});
    updateJobProgress(dbJobId, pct).catch(() => {});
  }, 5_000);

  const startTime = Date.now();
  let result;
  try {
    result = effectiveVersion === "v2"
      ? await new PipelineOrchestratorV2().processSingleByRowIndex(rowIndex, renderVariant as any, hookStyle as any, dbJobId, musicVibe)
      : await new PipelineOrchestrator().processSingleByRowIndex(rowIndex, template, renderVariant as any, hookStyle as any, dbJobId, musicVibe);
  } catch (err) {
    clearInterval(progressInterval);
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    const durationMs = Date.now() - startTime;
    setStatus("error");
    try {
      await updateJobStatus(dbJobId, "error", { error: message, duration_ms: durationMs });
    } catch (dbErr) {
      console.warn("[worker] Could not write error status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    throw new Error(message);
  }

  clearInterval(progressInterval);
  const durationMs = Date.now() - startTime;

  // Purge stale temp dirs after every render (belt-and-suspenders alongside the finally blocks)
  setImmediate(() => purgeOldWorkDirs());

  if (result.success) {
    setStatus("done");
    try {
      await updateJobStatus(dbJobId, "done", {
        output_path: result.outputDir,
        output_link: result.outputLink,
        duration_ms: durationMs,
      });
    } catch (dbErr) {
      console.warn("[worker] Could not write done status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    console.log(`[worker] Done: ${topic} → ${result.outputLink} (${Math.round(durationMs / 1000)}s)`);
  } else {
    setStatus("error");
    try {
      await updateJobStatus(dbJobId, "error", { error: result.error, duration_ms: durationMs });
    } catch (dbErr) {
      console.warn("[worker] Could not write error status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    throw new Error(result.error || "Pipeline failed");
  }
}

async function startup() {
  probeEnv();
  startStaticServer();
  await checkRedis();

  // Ensure DB schema is up to date (idempotent — safe on every startup)
  try {
    await runMigrations();
    console.log("[worker] DB migrations applied ✓");
  } catch (err) {
    console.warn("[worker] DB migration warning:", err instanceof Error ? err.message : err);
  }

  // Forward console.log + console.error to Redis so Vercel SSE shows live progress
  const _origLog   = console.log.bind(console);
  const _origError = console.error.bind(console);
  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    _origLog(msg);
    emitLog(inferAgent(msg), msg, inferLevel(msg));
  };
  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    _origError(msg);
    emitLog(inferAgent(msg), `ERROR: ${msg}`, "error");
  };

  // Ensure Chrome Headless Shell is available (downloads if missing, fast if cached)
  try {
    await ensureBrowser();
    console.log("[worker] Chrome Headless Shell ready ✓");
  } catch (err) {
    console.warn("[worker] Could not ensure browser:", err instanceof Error ? err.message : err);
  }

  // Clear any jobs that were left in "processing" from a previous crash
  try {
    const cleaned = await markStuckJobsError(10 * 60 * 1000);
    if (cleaned > 0) console.log(`[worker] Marked ${cleaned} stuck job(s) as error on startup`);
  } catch (err) {
    console.warn("[worker] Could not clean stuck jobs (DB may be unreachable):", err instanceof Error ? err.message : err);
  }

  // Purge stale render artifacts left from previous worker instances or crashed renders.
  // Runs once on startup to reclaim disk space before the first render.
  purgeOldWorkDirs();

  // Write a heartbeat to Postgres every 3 min (was 30s — reduces Upstash Redis commands by 83%).
  await touchWorkerHeartbeat();
  const heartbeatInterval = setInterval(() => {
    touchWorkerHeartbeat().catch((e) =>
      console.warn("[worker] heartbeat failed:", e instanceof Error ? e.message : e)
    );
  }, HEARTBEAT_MS);

  const renderRedis = getRenderRedis();
  const worker = new Worker<RenderJobData>(RENDER_QUEUE, processJob, {
    connection:    renderRedis,
    concurrency:   CONCURRENCY,
    lockDuration:  600_000,
    lockRenewTime: 120_000,
  });

  worker.on("completed", (job) => {
    const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`[worker] Completed: ${job.id} | RSS=${rss}MB`);
    if (rss > OOM_RSS_LIMIT_MB) {
      console.warn(`[worker] HIGH MEMORY after render (RSS=${rss}MB) — consider restart if this persists`);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Failed: ${job?.id} — ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`[worker] Error:`, err.message);
  });

  console.log(`[worker] Render worker started`);
  console.log(`[worker] Queue: ${RENDER_QUEUE} | Concurrency: ${CONCURRENCY}`);
  console.log(`[worker] Waiting for jobs...\n`);

  async function shutdown() {
    console.log("[worker] Shutting down gracefully...");
    clearInterval(heartbeatInterval);
    await worker.close();
    await renderRedis.quit();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);
}

startup();
