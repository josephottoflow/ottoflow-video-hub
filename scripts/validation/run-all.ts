#!/usr/bin/env tsx
/**
 * Validation suite runner.
 *
 * Usage:
 *   npx tsx scripts/validation/run-all.ts [--quick] [--only=<test-num>] [--baseline=<path>]
 *
 * Flags:
 *   --quick                Skip long-running tests (07, 08, TTL wait in 01)
 *   --only=02,06           Run only the listed test numbers (comma-separated)
 *   --baseline=<path>      Path to a prior validation-report.json for regression diff
 *   --out=<path>           Output path for the report (default: validation-report-<ts>.json)
 *
 * Environment:
 *   APP_URL                Base URL of the deployed app (required)
 *   DATABASE_URL           Neon Postgres connection string (required)
 *   SKIP_CRASH_TEST=true   Skip test 08 (default: skipped unless SKIP_CRASH_TEST=false)
 *   RUN_REDIS_TEST=true    Enable test 09 (default: skipped)
 *   MEMORY_TEST_BATCHES=2  Number of 2-render batches for test 07 (default: 2)
 */
import "dotenv/config";
import * as path from "path";
import { TestRunner } from "./lib/runner";

// ── Parse flags ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

const isQuick    = argv.includes("--quick");
const onlyArg    = argv.find((a) => a.startsWith("--only="));
const onlyNums   = onlyArg ? new Set(onlyArg.split("=")[1].split(",").map((s) => s.trim())) : null;
const baselineArg = argv.find((a) => a.startsWith("--baseline="))?.split("=")[1];
const outArg      = argv.find((a) => a.startsWith("--out="))?.split("=")[1];

if (isQuick) process.env.QUICK_MODE = "true";

// ── Validate environment ──────────────────────────────────────────────────────

const APP_URL      = process.env.APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!APP_URL) {
  console.error("ERROR: APP_URL is not set. Set it in .env or export it.");
  console.error("       Example: APP_URL=https://your-app.up.railway.app");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Set it in .env or export it.");
  process.exit(1);
}

// ── Test registry ─────────────────────────────────────────────────────────────

const ALL_TESTS = [
  { num: "01", name: "health-probe",       module: "./tests/01-health-probe" },
  { num: "02", name: "baseline-pipeline",  module: "./tests/02-baseline-pipeline" },
  { num: "03", name: "concurrent",         module: "./tests/03-concurrent-pipelines" },
  { num: "04", name: "cancellation",       module: "./tests/04-cancellation" },
  { num: "05", name: "replay",             module: "./tests/05-replay" },
  { num: "06", name: "sse-validation",     module: "./tests/06-sse-validation" },
  { num: "07", name: "memory-stability",   module: "./tests/07-memory-stability" },
  { num: "08", name: "worker-crash",       module: "./tests/08-worker-crash" },
  { num: "09", name: "redis-reconnect",    module: "./tests/09-redis-reconnect" },
] as const;

// Quick mode: skip tests 07, 08, and the TTL wait in 01
const QUICK_SKIP = new Set(isQuick ? ["07", "08"] : []);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═".repeat(60));
  console.log("  Ottoflow Platform Validation Suite");
  console.log(`  Target: ${APP_URL}`);
  console.log(`  Mode:   ${isQuick ? "quick" : "full"}${onlyNums ? ` (tests: ${[...onlyNums].join(", ")})` : ""}`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  const runner = new TestRunner();

  for (const test of ALL_TESTS) {
    // Skip filter
    if (onlyNums && !onlyNums.has(test.num) && !onlyNums.has(test.name)) continue;
    if (QUICK_SKIP.has(test.num)) {
      runner.begin(test.num + " — " + test.name);
      runner.skip("--quick mode: skipped");
      continue;
    }

    let mod: { run: (t: TestRunner) => Promise<void> };
    try {
      mod = await import(test.module);
    } catch (err) {
      runner.begin(test.num + " — " + test.name);
      runner.fail(err);
      continue;
    }

    try {
      await mod.run(runner);
    } catch (err) {
      // Ensure test is closed if the module threw outside runner control
      if (runner.results.length === 0 || runner.results[runner.results.length - 1].name !== test.name) {
        runner.begin(test.num + " — " + test.name);
        runner.fail(err);
      }
    }
  }

  // ── Output ────────────────────────────────────────────────────────────────

  runner.printSummary();

  const reportPath = outArg ?? path.join(
    process.cwd(),
    `validation-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`
  );

  const written = runner.writeReport(reportPath, baselineArg);
  console.log(`  Report written: ${written}`);

  // Print regression warnings if baseline was provided
  const report = runner.buildReport(baselineArg);
  if (report.regression?.warnings.length) {
    console.log("\n  ⚠ REGRESSION WARNINGS:");
    for (const w of report.regression.warnings) {
      console.log(`    - ${w}`);
    }
    console.log();
  }
  if (report.regression && !report.regression.warnings.length) {
    console.log("  ✓ No regressions detected vs baseline.\n");
  }

  const failed = runner.results.filter((r) => r.status === "fail").length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
