// Pipeline abort controller helpers
//
// Two layers of cancellation:
//   1. Hard timeout: kills the entire pipeline after PIPELINE_HARD_TIMEOUT_MS (20m)
//   2. Stage timeout: kills a single stage after StageDefinition.timeoutMs
//
// Both are AbortSignals so stage functions can check ctx.signal.aborted
// or pass it directly to external calls (fetch, Remotion renderMedia, etc.)

export interface ManagedAbortController {
  controller: AbortController;
  cleanup:    () => void;
}

/** Create a self-aborting controller that fires after `timeoutMs`. */
export function createTimedAbortController(timeoutMs: number): ManagedAbortController {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  return {
    controller,
    cleanup: () => clearTimeout(timer),
  };
}

/** Create a controller that aborts when EITHER the parent signal fires OR the timeout expires. */
export function createLinkedAbortController(
  parentSignal: AbortSignal,
  timeoutMs:    number
): ManagedAbortController {
  const controller = new AbortController();

  const onParentAbort = () => controller.abort(parentSignal.reason);
  const timer = setTimeout(
    () => controller.abort(new Error(`Stage timed out after ${timeoutMs}ms`)),
    timeoutMs
  );

  // If parent is already aborted, fire immediately
  if (parentSignal.aborted) {
    controller.abort(parentSignal.reason);
    clearTimeout(timer);
    return { controller, cleanup: () => {} };
  }

  parentSignal.addEventListener("abort", onParentAbort, { once: true });

  return {
    controller,
    cleanup: () => {
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", onParentAbort);
    },
  };
}

/** Convenience alias for pipeline-level hard timeout. */
export const createPipelineAbortController = (timeoutMs: number) =>
  createTimedAbortController(timeoutMs);
