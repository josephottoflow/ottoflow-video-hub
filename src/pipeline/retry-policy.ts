import { createLinkedAbortController } from "./abort-controller";
import type { PipelineContext, RetryResult, StageDefinition } from "./types";

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS  = 30_000;

function backoffMs(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
}

interface RetryInput {
  stageName:  string;
  def:        StageDefinition;
  ctx:        PipelineContext;
  pipelineId: string;
  onRetry?:   (attempt: number, error: Error) => Promise<void>;
}

/**
 * Execute a stage with retry logic.
 *
 * - Each attempt gets its own timeout AbortController linked to the pipeline signal.
 * - Backoff doubles between attempts (capped at 30s).
 * - If the pipeline signal is aborted, retry loop exits immediately.
 */
export async function executeWithRetry({
  stageName,
  def,
  ctx,
  onRetry,
}: RetryInput): Promise<RetryResult> {
  const t0 = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= def.maxAttempts; attempt++) {
    if (ctx.signal.aborted) {
      return {
        success:    false,
        error:      "Pipeline cancelled",
        durationMs: Date.now() - t0,
        attempts:   attempt - 1,
      };
    }

    const { controller: stageAbort, cleanup } = createLinkedAbortController(ctx.signal, def.timeoutMs);

    // Build a context for this attempt with the stage-scoped abort signal
    const attemptCtx = { ...ctx, signal: stageAbort.signal };

    try {
      const result = await def.fn(attemptCtx);
      cleanup();
      return {
        success:    true,
        artifacts:  result.artifacts,
        metadata:   result.metadata,
        durationMs: Date.now() - t0,
        attempts:   attempt,
      };
    } catch (err) {
      cleanup();
      lastError = err instanceof Error ? err : new Error(String(err));
      ctx.log(`[${stageName}] attempt ${attempt}/${def.maxAttempts} failed: ${lastError.message}`);

      if (attempt < def.maxAttempts && !ctx.signal.aborted) {
        const delay = backoffMs(attempt);
        ctx.log(`[${stageName}] retrying in ${delay}ms...`);
        await onRetry?.(attempt, lastError);
        await sleep(delay, ctx.signal);
      }
    }
  }

  return {
    success:    false,
    error:      lastError?.message ?? "Unknown error",
    durationMs: Date.now() - t0,
    attempts:   def.maxAttempts,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (signal.aborted) { clearTimeout(timer); resolve(); return; }
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
