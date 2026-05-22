import type { PipelineConfig, PipelineContext, PipelineEvent, RenderVariant, HookStyle, Tier, StageLogger } from "./types";
import { emitEvent } from "./events";

export interface BuildContextInput {
  pipelineId:    string;
  traceId:       string;
  workerId:      string;
  topic:         string;
  style:         string;
  renderVariant: RenderVariant;
  hookStyle:     HookStyle;
  musicVibe?:    string;
  template?:     string;
  tier:          Tier;
  workDir:       string;
  artifacts:     Record<string, string>;
  config:        PipelineConfig;
  signal:        AbortSignal;
}

export function buildContext(input: BuildContextInput): PipelineContext {
  const logPrefix = `[pipeline:${input.pipelineId.slice(0, 8)}]`;

  const log: StageLogger = (msg: string) => {
    const line = `${logPrefix} ${msg}`;
    console.log(line);
    // Emit as a log event (fire-and-forget — never awaited in hot path)
    emitEvent({
      type:       "log",
      pipelineId: input.pipelineId,
      workerId:   input.workerId,
      message:    msg,
      ts:         new Date().toISOString(),
    }).catch(() => {});
  };

  const emit = async (event: PipelineEvent): Promise<void> => {
    await emitEvent(event).catch((err) =>
      console.warn(`${logPrefix} emit failed:`, err?.message)
    );
  };

  return {
    pipelineId:    input.pipelineId,
    traceId:       input.traceId,
    workerId:      input.workerId,
    topic:         input.topic,
    style:         input.style,
    renderVariant: input.renderVariant,
    hookStyle:     input.hookStyle,
    musicVibe:     input.musicVibe,
    template:      input.template,
    tier:          input.tier,
    workDir:       input.workDir,
    artifacts:     input.artifacts,
    config:        input.config,
    log,
    signal:        input.signal,
    emit,
  };
}
