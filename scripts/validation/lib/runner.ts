import * as fs   from "fs";
import * as path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Assertion {
  label:    string;
  passed:   boolean;
  actual?:  unknown;
  expected?: unknown;
}

export interface TestResult {
  name:       string;
  status:     "pass" | "fail" | "skip";
  durationMs: number;
  assertions: Assertion[];
  error?:     string;
  data:       Record<string, unknown>;
  skipReason?: string;
}

export interface ValidationReport {
  runId:       string;
  timestamp:   string;
  environment: string;
  nodeVersion: string;
  tests:       TestResult[];
  summary: {
    total:          number;
    passed:         number;
    failed:         number;
    skipped:        number;
    totalDurationMs: number;
  };
  regression?: RegressionReport;
}

export interface RegressionReport {
  baselineFile:       string;
  avgRenderDeltaPct:  number | null;
  memoryDeltaMb:      number | null;
  retryRateDelta:     number | null;
  warnings:           string[];
}

// ── TestRunner ────────────────────────────────────────────────────────────────

export class TestRunner {
  readonly results: TestResult[] = [];

  private _name:       string = "";
  private _start:      number = 0;
  private _assertions: Assertion[] = [];
  private _data:       Record<string, unknown> = {};
  private _failed:     boolean = false;

  begin(name: string): void {
    this._name       = name;
    this._start      = Date.now();
    this._assertions = [];
    this._data       = {};
    this._failed     = false;
    console.log(`\n  ┌ ${name}`);
  }

  assert(label: string, condition: boolean, actual?: unknown, expected?: unknown): void {
    const a: Assertion = { label, passed: condition, actual, expected };
    this._assertions.push(a);
    const icon = condition ? "  ✓" : "  ✗";
    const suffix = condition ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`;
    console.log(`  │ ${icon} ${label}${suffix}`);
    if (!condition) this._failed = true;
  }

  assertEqual<T>(label: string, actual: T, expected: T): void {
    this.assert(label, actual === expected, actual, expected);
  }

  assertLt(label: string, value: number, threshold: number): void {
    this.assert(`${label} < ${threshold}`, value < threshold, value, `< ${threshold}`);
  }

  assertGt(label: string, value: number, threshold: number): void {
    this.assert(`${label} > ${threshold}`, value > threshold, value, `> ${threshold}`);
  }

  assertNotNull(label: string, value: unknown): void {
    this.assert(`${label} is not null`, value != null, value, "non-null");
  }

  record(key: string, value: unknown): void {
    this._data[key] = value;
    console.log(`  │ ℹ ${key}: ${JSON.stringify(value)}`);
  }

  pass(): TestResult {
    const r: TestResult = {
      name:       this._name,
      status:     this._failed ? "fail" : "pass",
      durationMs: Date.now() - this._start,
      assertions: this._assertions,
      data:       this._data,
    };
    this.results.push(r);
    const icon = r.status === "pass" ? "✓ PASS" : "✗ FAIL";
    console.log(`  └ ${icon}  (${r.durationMs}ms)\n`);
    return r;
  }

  fail(err: unknown): TestResult {
    const msg = err instanceof Error ? err.message : String(err);
    const r: TestResult = {
      name:       this._name,
      status:     "fail",
      durationMs: Date.now() - this._start,
      assertions: this._assertions,
      error:      msg,
      data:       this._data,
    };
    this.results.push(r);
    console.log(`  │ ✗ EXCEPTION: ${msg}`);
    console.log(`  └ ✗ FAIL  (${r.durationMs}ms)\n`);
    return r;
  }

  skip(reason: string): TestResult {
    const r: TestResult = {
      name:       this._name,
      status:     "skip",
      durationMs: 0,
      assertions: [],
      data:       {},
      skipReason: reason,
    };
    this.results.push(r);
    console.log(`  │ – SKIP: ${reason}`);
    console.log(`  └ – SKIP\n`);
    return r;
  }

  printSummary(): void {
    const total   = this.results.length;
    const passed  = this.results.filter((r) => r.status === "pass").length;
    const failed  = this.results.filter((r) => r.status === "fail").length;
    const skipped = this.results.filter((r) => r.status === "skip").length;

    console.log("═".repeat(60));
    console.log(`  Validation Summary`);
    console.log(`  Total: ${total}  ✓ ${passed}  ✗ ${failed}  – ${skipped}`);
    console.log("─".repeat(60));

    for (const r of this.results) {
      const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "–";
      const ms   = r.durationMs ? `${r.durationMs}ms` : "";
      console.log(`  ${icon}  ${r.name.padEnd(40)} ${ms}`);
      if (r.status === "fail" && r.error) {
        console.log(`       ERROR: ${r.error}`);
      }
      const failedAssertions = r.assertions.filter((a) => !a.passed);
      for (const a of failedAssertions) {
        console.log(`       ✗ ${a.label}: got ${JSON.stringify(a.actual)}`);
      }
    }
    console.log("═".repeat(60));

    if (failed > 0) {
      console.log(`\n  ${failed} test(s) failed.\n`);
    } else {
      console.log(`\n  All tests passed.\n`);
    }
  }

  buildReport(baselineFile?: string): ValidationReport {
    const total   = this.results.length;
    const passed  = this.results.filter((r) => r.status === "pass").length;
    const failed  = this.results.filter((r) => r.status === "fail").length;
    const skipped = this.results.filter((r) => r.status === "skip").length;
    const totalMs = this.results.reduce((s, r) => s + r.durationMs, 0);

    const report: ValidationReport = {
      runId:       `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp:   new Date().toISOString(),
      environment: process.env.APP_URL ?? "http://localhost:3000",
      nodeVersion: process.version,
      tests:       this.results,
      summary:     { total, passed, failed, skipped, totalDurationMs: totalMs },
    };

    if (baselineFile) {
      report.regression = diffAgainstBaseline(report, baselineFile);
    }

    return report;
  }

  writeReport(outputPath: string, baselineFile?: string): string {
    const report = this.buildReport(baselineFile);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return outputPath;
  }
}

// ── Regression comparison ─────────────────────────────────────────────────────

function diffAgainstBaseline(current: ValidationReport, baselineFile: string): RegressionReport {
  const result: RegressionReport = {
    baselineFile,
    avgRenderDeltaPct: null,
    memoryDeltaMb:     null,
    retryRateDelta:    null,
    warnings:          [],
  };

  if (!fs.existsSync(baselineFile)) {
    result.warnings.push(`Baseline file not found: ${baselineFile}`);
    return result;
  }

  let baseline: ValidationReport;
  try {
    baseline = JSON.parse(fs.readFileSync(baselineFile, "utf-8"));
  } catch {
    result.warnings.push("Could not parse baseline file");
    return result;
  }

  // Compare baseline pipeline render duration
  const curBaseline  = current.tests.find((t) => t.name.includes("baseline"));
  const prevBaseline = baseline.tests?.find((t) => t.name.includes("baseline"));
  if (curBaseline?.data?.durationMs && prevBaseline?.data?.durationMs) {
    const cur  = curBaseline.data.durationMs  as number;
    const prev = prevBaseline.data.durationMs as number;
    result.avgRenderDeltaPct = Math.round(((cur - prev) / prev) * 100);
    if (result.avgRenderDeltaPct > 20) {
      result.warnings.push(`Render duration increased ${result.avgRenderDeltaPct}% vs baseline`);
    }
  }

  // Compare memory peak
  const curMem  = current.tests.find((t) => t.name.includes("memory"));
  const prevMem = baseline.tests?.find((t) => t.name.includes("memory"));
  if (curMem?.data?.peakRssMb && prevMem?.data?.peakRssMb) {
    result.memoryDeltaMb = (curMem.data.peakRssMb as number) - (prevMem.data.peakRssMb as number);
    if (result.memoryDeltaMb > 100) {
      result.warnings.push(`Memory peak increased ${result.memoryDeltaMb}MB vs baseline`);
    }
  }

  // Failure rate
  if (current.summary.failed > baseline.summary?.failed) {
    result.warnings.push(`More failures than baseline: ${current.summary.failed} vs ${baseline.summary.failed}`);
  }

  return result;
}
