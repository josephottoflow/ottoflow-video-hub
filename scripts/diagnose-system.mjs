/**
 * SYSTEM DIAGNOSTICS — Real state inspection (no guesses)
 *
 * Queries:
 *   1. Postgres DB — job status breakdown, stuck jobs, last heartbeat
 *   2. BullMQ / Redis — queue counts, active jobs, stalled, failed, delayed
 *   3. Redis raw — stale locks, key inventory
 *
 * Usage:
 *   npx tsx scripts/diagnose-system.mjs
 *   npx tsx scripts/diagnose-system.mjs --fix   (apply safe auto-fixes)
 */

import "dotenv/config";
import pg from "pg";
import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";

const FIX_MODE = process.argv.includes("--fix");

// ─── helpers ──────────────────────────────────────────────────
const hr   = (label) => console.log(`\n${"═".repeat(60)}\n  ${label}\n${"═".repeat(60)}`);
const sec  = (label) => console.log(`\n  ── ${label}`);
const row  = (...cols) => console.log("  " + cols.map(String).map(c => c.padEnd(20)).join(" │ ").trimEnd());
const fmt  = (d) => d ? new Date(d).toISOString().replace("T"," ").slice(0,19) + " UTC" : "—";
const ago  = (d) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000)  return `${Math.round(ms/1000)}s ago`;
  if (ms < 3600_000) return `${Math.round(ms/60000)}m ago`;
  return `${Math.round(ms/3600000)}h ago`;
};
const colorStatus = (s) => {
  if (!s) return s;
  if (s === "done")       return `✅ ${s}`;
  if (s === "processing") return `🔄 ${s}`;
  if (s === "pending")    return `⏳ ${s}`;
  if (s === "error")      return `❌ ${s}`;
  return s;
};

// ─── DB connection ─────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || "postgresql://ottoflow:ottoflow@localhost:5432/ottoflow";
const db = new pg.Pool({
  connectionString: DB_URL,
  max: 3,
  ssl: DB_URL.includes("neon") || DB_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
});

// ─── Redis connection ──────────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  connectTimeout: 8_000,
  commandTimeout: 10_000,
  tls: REDIS_URL.startsWith("rediss://") ? {} : undefined,
});
redis.on("error", (e) => {});

const queue = new Queue("render", { connection: redis });

// ══════════════════════════════════════════════════════════════
// SECTION 1: POSTGRES — JOB STATE
// ══════════════════════════════════════════════════════════════
async function inspectDb() {
  hr("POSTGRES — JOB STATE");
  try {
    await db.query("SELECT 1");
    console.log(`  ✓ Connected to Postgres`);
    console.log(`  URL: ${DB_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  } catch (e) {
    console.error(`  ✗ Cannot connect to Postgres: ${e.message}`);
    console.error(`  DATABASE_URL: ${process.env.DATABASE_URL ? "set" : "NOT SET"}`);
    return;
  }

  // Status breakdown
  sec("Status breakdown");
  const { rows: counts } = await db.query(`
    SELECT status, COUNT(*) as count,
           MIN(created_at) as oldest,
           MAX(created_at) as newest
    FROM jobs
    GROUP BY status
    ORDER BY count DESC
  `);
  row("Status", "Count", "Oldest", "Newest");
  row("──────", "─────", "──────", "──────");
  for (const r of counts) {
    row(colorStatus(r.status), r.count, fmt(r.oldest), fmt(r.newest));
  }

  // All jobs last 48h
  sec("All jobs (last 48h, newest first)");
  const { rows: recentJobs } = await db.query(`
    SELECT id, topic, status, version, template, error, progress,
           created_at, started_at, completed_at, duration_ms, bull_job_id,
           retry_count
    FROM jobs
    WHERE created_at > NOW() - INTERVAL '48 hours'
    ORDER BY created_at DESC
    LIMIT 50
  `);

  if (recentJobs.length === 0) {
    console.log("  (no jobs in last 48h)");
  } else {
    row("ID (first 8)", "Status", "Progress", "Topic (40c)", "Created", "Duration");
    row("────────────", "──────", "────────", "──────────", "───────", "────────");
    for (const j of recentJobs) {
      const dur = j.duration_ms ? `${Math.round(j.duration_ms/1000)}s` : (j.started_at ? `~${ago(j.started_at)}` : "—");
      row(
        j.id.slice(0,8),
        colorStatus(j.status),
        `${j.progress ?? 0}%`,
        (j.topic || "").slice(0,40),
        ago(j.created_at),
        dur
      );
      if (j.status === "error" && j.error) {
        console.log(`      ⚠ ERROR: ${j.error.slice(0,120)}`);
      }
    }
  }

  // Stuck jobs — "processing" older than 15 min
  sec("Stuck jobs (processing > 15 min)");
  const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  const { rows: stuck } = await db.query(`
    SELECT id, topic, status, started_at, bull_job_id, retry_count, progress
    FROM jobs
    WHERE status = 'processing' AND started_at < $1
    ORDER BY started_at
  `, [cutoff]);

  if (stuck.length === 0) {
    console.log("  ✓ No stuck jobs");
  } else {
    console.log(`  ⚠ ${stuck.length} stuck job(s) found:`);
    for (const j of stuck) {
      console.log(`    id=${j.id.slice(0,8)} topic="${(j.topic||"").slice(0,40)}" started=${ago(j.started_at)} progress=${j.progress}% bull=${j.bull_job_id || "none"} retries=${j.retry_count}`);
    }

    if (FIX_MODE) {
      const result = await db.query(`
        UPDATE jobs
        SET status = 'error',
            error = 'Stuck job — reset by diagnose-system.mjs (stuck > 15 min)',
            completed_at = NOW()
        WHERE status = 'processing' AND started_at < $1
      `, [cutoff]);
      console.log(`  🔧 FIX: marked ${result.rowCount} stuck job(s) as error`);
    } else {
      console.log("  → Run with --fix to mark these as error and free the queue");
    }
  }

  // Pending jobs
  sec("Pending jobs (not yet queued)");
  const { rows: pending } = await db.query(`
    SELECT id, topic, version, template, created_at, retry_count
    FROM jobs
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT 20
  `);
  if (pending.length === 0) {
    console.log("  ✓ No pending jobs");
  } else {
    for (const j of pending) {
      console.log(`    id=${j.id.slice(0,8)} v=${j.version} tmpl=${j.template} topic="${(j.topic||"").slice(0,40)}" created=${ago(j.created_at)} retries=${j.retry_count}`);
    }
  }

  // Error jobs last 24h
  sec("Error jobs (last 24h)");
  const { rows: errJobs } = await db.query(`
    SELECT id, topic, error, completed_at, retry_count, version
    FROM jobs
    WHERE status = 'error' AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY completed_at DESC
    LIMIT 20
  `);
  if (errJobs.length === 0) {
    console.log("  ✓ No error jobs in last 24h");
  } else {
    for (const j of errJobs) {
      console.log(`    id=${j.id.slice(0,8)} v=${j.version} topic="${(j.topic||"").slice(0,35)}" retries=${j.retry_count}`);
      if (j.error) console.log(`      → ${j.error.slice(0, 120)}`);
    }
  }

  // Done jobs last 24h
  sec("Done jobs (last 24h)");
  const { rows: done } = await db.query(`
    SELECT id, topic, output_link, duration_ms, completed_at, version
    FROM jobs
    WHERE status = 'done' AND completed_at > NOW() - INTERVAL '24 hours'
    ORDER BY completed_at DESC
    LIMIT 10
  `);
  if (done.length === 0) {
    console.log("  (no successful renders in last 24h)");
  } else {
    for (const j of done) {
      console.log(`    id=${j.id.slice(0,8)} v=${j.version} dur=${Math.round((j.duration_ms||0)/1000)}s topic="${(j.topic||"").slice(0,35)}" completed=${ago(j.completed_at)}`);
      if (j.output_link) console.log(`      → ${j.output_link.slice(0,100)}`);
    }
  }

  // Worker heartbeat
  sec("Worker heartbeat");
  try {
    const { rows: hb } = await db.query(`SELECT touched_at FROM worker_heartbeat WHERE id = 'main'`);
    if (hb.length === 0) {
      console.log("  ⚠ No heartbeat row found — worker has never touched DB");
    } else {
      const touchedMs = Date.now() - new Date(hb[0].touched_at).getTime();
      const isLive    = touchedMs < 6 * 60 * 1000; // 6 min — heartbeat is every 3 min
      console.log(`  ${isLive ? "✓" : "⚠"} Last heartbeat: ${ago(hb[0].touched_at)} (${fmt(hb[0].touched_at)})`);
      if (!isLive) console.log(`  ⚠ Worker appears OFFLINE (heartbeat > 6 min ago)`);
    }
  } catch (e) {
    console.log(`  ✗ Cannot read heartbeat: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 2: BULLMQ / REDIS — QUEUE STATE
// ══════════════════════════════════════════════════════════════
async function inspectQueue() {
  hr("BULLMQ / REDIS — QUEUE STATE");
  try {
    const pong = await redis.ping();
    console.log(`  ✓ Redis connected (${pong})`);
    console.log(`  URL: ${REDIS_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  } catch (e) {
    console.error(`  ✗ Cannot reach Redis: ${e.message}`);
    return;
  }

  // Queue counts
  sec("Queue counts");
  let counts;
  try {
    counts = await queue.getJobCounts("waiting", "active", "delayed", "failed", "completed", "paused");
    row("Waiting", "Active", "Delayed", "Failed", "Completed", "Paused");
    row("───────", "──────", "───────", "──────", "─────────", "──────");
    row(counts.waiting, counts.active, counts.delayed, counts.failed, counts.completed, counts.paused);
  } catch (e) {
    console.error(`  ✗ Cannot get queue counts: ${e.message}`);
  }

  // Active jobs
  sec("Active jobs (currently processing)");
  try {
    const active = await queue.getActive();
    if (active.length === 0) {
      console.log("  ✓ No active jobs");
    } else {
      for (const j of active) {
        const data = j.data;
        const elapsed = j.processedOn ? Math.round((Date.now() - j.processedOn) / 1000) : "?";
        console.log(`  Job ${j.id}: topic="${(data.topic||"").slice(0,40)}" v=${data.version} elapsed=${elapsed}s progress=${j.progress}%`);
        console.log(`    bull_id=${j.id} dbJobId=${data.dbJobId} row=${data.rowIndex} variant=${data.renderVariant || "default"}`);
      }
    }
  } catch (e) {
    console.error(`  ✗ Cannot get active jobs: ${e.message}`);
  }

  // Waiting jobs
  sec("Waiting jobs (queued, not yet processing)");
  try {
    const waiting = await queue.getWaiting();
    if (waiting.length === 0) {
      console.log("  ✓ Queue is empty");
    } else {
      for (const j of waiting) {
        const data = j.data;
        console.log(`  Job ${j.id}: topic="${(data.topic||"").slice(0,40)}" v=${data.version} attempts=${j.attemptsMade}/${j.opts?.attempts}`);
      }
    }
  } catch (e) {
    console.error(`  ✗ Cannot get waiting jobs: ${e.message}`);
  }

  // Delayed jobs
  sec("Delayed jobs (scheduled for future)");
  try {
    const delayed = await queue.getDelayed();
    if (delayed.length === 0) {
      console.log("  ✓ No delayed jobs");
    } else {
      for (const j of delayed) {
        const data = j.data;
        const eta  = j.delay ? new Date(j.timestamp + j.delay).toISOString() : "unknown";
        console.log(`  Job ${j.id}: topic="${(data.topic||"").slice(0,40)}" eta=${eta}`);
      }
    }
  } catch (e) {
    console.error(`  ✗ Cannot get delayed jobs: ${e.message}`);
  }

  // Failed jobs
  sec("Failed jobs (last 20)");
  try {
    const failed = await queue.getFailed(0, 19);
    if (failed.length === 0) {
      console.log("  ✓ No failed jobs in queue");
    } else {
      for (const j of failed) {
        const data = j.data;
        console.log(`  Job ${j.id}: topic="${(data.topic||"").slice(0,40)}" attempts=${j.attemptsMade}`);
        if (j.failedReason) console.log(`    → ${j.failedReason.slice(0, 150)}`);
        if (j.stacktrace?.[0]) console.log(`    stack: ${j.stacktrace[0].split("\n")[0]}`);
      }
    }
  } catch (e) {
    console.error(`  ✗ Cannot get failed jobs: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 3: REDIS RAW — LOCKS, KEY INVENTORY
// ══════════════════════════════════════════════════════════════
async function inspectRedisRaw() {
  hr("REDIS RAW — KEY INVENTORY + STALE LOCKS");

  sec("All BullMQ render keys");
  try {
    const keys = await redis.keys("bull:render:*");
    // Group by prefix pattern
    const groups = {};
    for (const k of keys) {
      const parts = k.split(":");
      const group = parts.slice(0, 3).join(":");
      groups[group] = (groups[group] || 0) + 1;
    }
    if (Object.keys(groups).length === 0) {
      console.log("  (no bull:render:* keys found)");
    } else {
      for (const [g, count] of Object.entries(groups).sort()) {
        console.log(`  ${g}: ${count} keys`);
      }
    }
  } catch (e) {
    console.error(`  ✗ KEYS scan failed: ${e.message}`);
  }

  // Stale locks (BullMQ job locks)
  sec("Stale BullMQ locks (job:*:lock)");
  try {
    const lockKeys = await redis.keys("bull:render:*:lock");
    if (lockKeys.length === 0) {
      console.log("  ✓ No stale locks");
    } else {
      console.log(`  Found ${lockKeys.length} lock(s):`);
      for (const k of lockKeys) {
        const ttl = await redis.pttl(k);
        const val = await redis.get(k);
        const isStale = ttl < 0; // -1 = no expiry, -2 = doesn't exist
        console.log(`  ${isStale ? "⚠ STALE" : "   live"} ${k} TTL=${ttl}ms token=${(val || "").slice(0,20)}`);
        if (FIX_MODE && isStale) {
          await redis.del(k);
          console.log(`    🔧 FIX: deleted stale lock ${k}`);
        }
      }
      if (!FIX_MODE && lockKeys.some(k => true)) {
        console.log("  → Run with --fix to delete stale locks");
      }
    }
  } catch (e) {
    console.error(`  ✗ Lock scan failed: ${e.message}`);
  }

  // Redis memory / server info
  sec("Redis server info");
  try {
    const info = await redis.info("memory");
    const memMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const peakMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);
    if (memMatch) console.log(`  Used memory: ${memMatch[1].trim()}`);
    if (peakMatch) console.log(`  Peak memory: ${peakMatch[1].trim()}`);
  } catch (e) {
    console.error(`  ✗ Redis INFO failed: ${e.message}`);
  }

  // Pipeline log state in Redis (Upstash or Railway)
  sec("Pipeline log state (Upstash/Redis pub)");
  try {
    const statusKey = "pipeline:status";
    const logsKey   = "pipeline:logs";
    const status    = await redis.get(statusKey);
    const logCount  = await redis.llen(logsKey);
    console.log(`  pipeline:status = ${status || "(empty)"}`);
    console.log(`  pipeline:logs   = ${logCount} entries`);
    if (logCount > 0) {
      const lastLog = await redis.lindex(logsKey, -1);
      console.log(`  last log entry: ${lastLog?.slice(0, 120)}`);
    }
  } catch (e) {
    console.log(`  (cannot read pipeline log state: ${e.message})`);
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 4: RECONCILIATION RECOMMENDATIONS
// ══════════════════════════════════════════════════════════════
async function reconcile() {
  hr("RECONCILIATION RECOMMENDATIONS");

  // Check for DB jobs that are "processing" but NOT in BullMQ active queue
  sec("DB vs Queue reconciliation (orphaned 'processing' jobs)");
  try {
    const { rows: dbProcessing } = await db.query(`
      SELECT id, bull_job_id, topic, started_at, progress
      FROM jobs WHERE status = 'processing'
    `);
    const active = await queue.getActive();
    const activeBullIds = new Set(active.map(j => j.id));

    const orphaned = dbProcessing.filter(j => {
      if (!j.bull_job_id) return true; // no BullMQ reference at all
      return !activeBullIds.has(j.bull_job_id);
    });

    if (orphaned.length === 0) {
      console.log("  ✓ All DB 'processing' jobs have a live BullMQ entry");
    } else {
      console.log(`  ⚠ ${orphaned.length} orphaned 'processing' job(s) — in DB but NOT in BullMQ active queue:`);
      for (const j of orphaned) {
        console.log(`    id=${j.id.slice(0,8)} topic="${(j.topic||"").slice(0,40)}" started=${ago(j.started_at)} progress=${j.progress}% bull=${j.bull_job_id || "none"}`);
      }
      if (FIX_MODE) {
        for (const j of orphaned) {
          await db.query(`
            UPDATE jobs SET status = 'error',
              error = 'Orphaned — was processing but not found in BullMQ active queue. Reset by diagnose-system.mjs.',
              completed_at = NOW()
            WHERE id = $1
          `, [j.id]);
        }
        console.log(`  🔧 FIX: marked ${orphaned.length} orphaned job(s) as error`);
      } else {
        console.log("  → Run with --fix to mark these as error");
      }
    }
  } catch (e) {
    console.error(`  ✗ Reconciliation failed: ${e.message}`);
  }

  // Check for BullMQ jobs with no DB record
  sec("Queue vs DB reconciliation (BullMQ jobs with no DB record)");
  try {
    const allBullJobs = [
      ...await queue.getActive(),
      ...await queue.getWaiting(),
    ];
    for (const bj of allBullJobs) {
      const dbJobId = bj.data?.dbJobId;
      if (!dbJobId) {
        console.log(`  ⚠ BullMQ job ${bj.id} has no dbJobId in payload`);
        continue;
      }
      const { rows } = await db.query(`SELECT id, status FROM jobs WHERE id = $1`, [dbJobId]);
      if (rows.length === 0) {
        console.log(`  ⚠ BullMQ job ${bj.id} references DB job ${dbJobId} which does NOT exist in DB`);
      }
    }
    if (allBullJobs.length === 0) {
      console.log("  ✓ Queue is empty — no BullMQ jobs to reconcile");
    } else {
      console.log(`  ✓ Checked ${allBullJobs.length} BullMQ job(s) — all have valid DB records`);
    }
  } catch (e) {
    console.error(`  ✗ Reconciliation failed: ${e.message}`);
  }

  // Stale "pending" jobs (older than 2h, never queued)
  sec("Stale pending jobs (pending > 2h — never entered queue)");
  try {
    const { rows: stalePending } = await db.query(`
      SELECT id, topic, created_at, version
      FROM jobs
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '2 hours'
    `);
    if (stalePending.length === 0) {
      console.log("  ✓ No stale pending jobs");
    } else {
      console.log(`  ⚠ ${stalePending.length} pending job(s) older than 2h (never queued):`);
      for (const j of stalePending) {
        console.log(`    id=${j.id.slice(0,8)} v=${j.version} topic="${(j.topic||"").slice(0,40)}" created=${ago(j.created_at)}`);
      }
      if (FIX_MODE) {
        await db.query(`
          UPDATE jobs SET status = 'error',
            error = 'Never entered queue — stale pending > 2h. Reset by diagnose-system.mjs.',
            completed_at = NOW()
          WHERE status = 'pending' AND created_at < NOW() - INTERVAL '2 hours'
        `);
        console.log(`  🔧 FIX: marked ${stalePending.length} stale pending job(s) as error`);
      } else {
        console.log("  → Run with --fix to mark these as error");
      }
    }
  } catch (e) {
    console.error(`  ✗ Stale pending check failed: ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 5: RECOVERY RECOMMENDATIONS
// ══════════════════════════════════════════════════════════════
async function recommendations() {
  hr("RECOVERY RECOMMENDATIONS");

  const { rows: statusRows } = await db.query(`SELECT status, COUNT(*) as n FROM jobs GROUP BY status`);
  const statusMap = Object.fromEntries(statusRows.map(r => [r.status, parseInt(r.n)]));

  const { rows: heartbeat } = await db.query(`SELECT touched_at FROM worker_heartbeat WHERE id = 'main'`).catch(() => ({ rows: [] }));
  const heartbeatAge = heartbeat[0] ? Date.now() - new Date(heartbeat[0].touched_at).getTime() : Infinity;
  const workerLive   = heartbeatAge < 6 * 60 * 1000;

  let counts;
  try { counts = await queue.getJobCounts("waiting", "active", "delayed", "failed"); }
  catch { counts = {}; }

  const recommendations = [];

  if (!workerLive) {
    recommendations.push({
      severity: "CRITICAL",
      issue:    `Worker appears OFFLINE — last heartbeat ${Math.round(heartbeatAge / 60000)}min ago`,
      action:   "Run: railway up  (or check Railway dashboard for worker service status)",
    });
  }

  if ((statusMap.processing || 0) > 0) {
    recommendations.push({
      severity: "HIGH",
      issue:    `${statusMap.processing} job(s) stuck in 'processing' — may be orphaned from crashed worker`,
      action:   "Run: npx tsx scripts/diagnose-system.mjs --fix  (clears orphaned + stuck jobs)",
    });
  }

  if ((counts.failed || 0) > 0) {
    recommendations.push({
      severity: "MEDIUM",
      issue:    `${counts.failed} failed job(s) in BullMQ queue`,
      action:   "Review errors above, then run: await queue.clean(0, 1000, 'failed')  to clear",
    });
  }

  if ((statusMap.pending || 0) > 0 && !workerLive) {
    recommendations.push({
      severity: "HIGH",
      issue:    `${statusMap.pending} pending job(s) waiting for a worker that appears offline`,
      action:   "Start the worker (railway up) to process pending jobs",
    });
  }

  if ((statusMap.done || 0) === 0) {
    recommendations.push({
      severity: "INFO",
      issue:    "No successful renders completed yet",
      action:   "Run test render: npx tsx scripts/test-v2-render.mjs",
    });
  }

  if (recommendations.length === 0) {
    console.log("  ✓ System looks healthy — no critical issues detected");
  } else {
    for (const rec of recommendations) {
      const icon = rec.severity === "CRITICAL" ? "🔴" : rec.severity === "HIGH" ? "🟠" : rec.severity === "MEDIUM" ? "🟡" : "ℹ️";
      console.log(`\n  ${icon} [${rec.severity}] ${rec.issue}`);
      console.log(`     Action: ${rec.action}`);
    }
  }

  // Queue drain instructions if jobs are waiting
  if ((counts.waiting || 0) > 0 && !workerLive) {
    console.log(`\n  ─────────────────────────────────────────────────────`);
    console.log(`  Queue has ${counts.waiting} waiting job(s) but worker appears offline.`);
    console.log(`  To drain: start railway worker → it will pick up waiting jobs automatically.`);
    console.log(`  To clear instead: npx tsx scripts/diagnose-system.mjs --fix`);
  }
}

// ─── Run all ───────────────────────────────────────────────────
console.log(`\nOTTOFLOW SYSTEM DIAGNOSTICS — ${new Date().toISOString()}`);
if (FIX_MODE) console.log("⚠ FIX MODE ENABLED — will apply safe auto-fixes\n");

try {
  await inspectDb();
  await inspectQueue();
  await inspectRedisRaw();
  await reconcile();
  await recommendations();
} finally {
  await queue.close();
  await redis.quit();
  await db.end();
}

console.log(`\n${"═".repeat(60)}\nDiagnostics complete.\n`);
