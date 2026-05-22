// Pipeline Engine — shared type contracts

export type PipelineStatus = "pending" | "queued" | "running" | "done" | "failed" | "cancelled" | "timed_out";
export type StageStatus    = "pending" | "running" | "done" | "failed" | "skipped" | "cancelled";
export type WorkerStatus   = "online" | "draining" | "offline" | "crashed";
export type Tier           = "basic" | "advanced";
export type RenderVariant  = "problem-first" | "stat-first" | "story-arc" | "myth-bust";
export type HookStyle      = "question" | "bold-statement" | "conflict" | "promise" | "shock" | "story";

// ── Pipeline config (stored as JSONB in pipelines.config) ─────────────────────

export interface PipelineConfig {
  tier:            Tier;
  version?:        "v1" | "v2";
  dbJobId?:        string;   // links to legacy jobs table
  skipLipsync?:    boolean;
  skipUpscale?:    boolean;
  skipAnalytics?:  boolean;
  skipPublish?:    boolean;
}

// ── Context passed to every stage function ────────────────────────────────────

export type StageLogger = (msg: string) => void;

export interface PipelineContext {
  // Identity
  pipelineId:    string;
  traceId:       string;
  workerId:      string;
  // Content
  topic:         string;
  style:         string;
  renderVariant: RenderVariant;
  hookStyle:     HookStyle;
  musicVibe?:    string;
  template?:     string;
  // Execution
  tier:          Tier;
  workDir:       string;             // /tmp/pipelines/{pipelineId}/
  artifacts:     Record<string, string>; // key → value (path or URL)
  config:        PipelineConfig;
  // Comms
  log:           StageLogger;
  signal:        AbortSignal;        // combined hard-timeout + cancellation
  emit:          (event: PipelineEvent) => Promise<void>;
}

// ── Stage contracts ───────────────────────────────────────────────────────────

export interface StageResult {
  artifacts?: Record<string, string>;
  metadata?:  Record<string, unknown>;
}

export type StageFn = (ctx: PipelineContext) => Promise<StageResult>;

export interface StageDefinition {
  fn:          StageFn;
  timeoutMs:   number;
  maxAttempts: number;
  critical:    boolean;   // if false, failure is logged but pipeline continues
  canSkip:     boolean;   // can be skipped via config
  tiers:       Tier[];    // which tiers run this stage
  description: string;
}

// ── Events (emitted to Redis pub/sub + written to pipeline_events) ────────────

export type PipelineEventType =
  | "pipeline_created"
  | "pipeline_queued"
  | "pipeline_started"
  | "pipeline_done"
  | "pipeline_failed"
  | "pipeline_cancelled"
  | "stage_started"
  | "stage_done"
  | "stage_failed"
  | "stage_skipped"
  | "stage_retry"
  | "progress"
  | "log"
  | "worker_heartbeat"
  | "queue_stats";

export interface PipelineEvent {
  type:        PipelineEventType;
  pipelineId:  string;
  workerId?:   string;
  stageName?:  string;
  progress?:   number;
  message?:    string;
  error?:      string;
  artifacts?:  Record<string, string>;
  metadata?:   Record<string, unknown>;
  ts:          string;   // ISO timestamp
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export interface RetryResult {
  success:     boolean;
  artifacts?:  Record<string, string>;
  metadata?:   Record<string, unknown>;
  error?:      string;
  durationMs:  number;
  attempts:    number;
}
