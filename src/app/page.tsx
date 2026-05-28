"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, List, Bot, Star, Share2,
  Play, RefreshCw, Loader2, ChevronRight, Plus,
  CheckCircle2, XCircle, Zap, Music2,
  Film, Send, FileSpreadsheet, Wand2, Clapperboard,
  Image, Tag, Video, Terminal, Eye, FolderOpen,
  Activity, TrendingUp, Layers, Hash, PenLine,
  Server, Database, Search, AlertCircle, Clock,
  BarChart2, ChevronDown, ChevronUp, Cpu, Globe,
  ArrowUpRight, Wifi, Filter, DollarSign, Package,
  Gauge, X, Power,
} from "lucide-react";
import { RemotionPreview, useVideoInfo } from "./components/RemotionPreview";

// ─── Types ────────────────────────────────────────────────────

type View   = "dashboard" | "create" | "renders" | "library" | "publishing" | "settings";
type Status = "idle" | "running" | "done" | "error";
type Tier   = "basic" | "advanced";

interface LogEntry { id: number; ts: string; agent: string; message: string; level: string; }
interface QueueRow { rowIndex: number; topic: string; style: string; status: string; avatarUrl?: string; }
interface DbJob { id: string; topic: string; template: string; status: string; error?: string; output_link?: string; duration_ms?: number; started_at?: string; progress?: number; }
interface Services { anthropic: boolean; gemini: boolean; elevenlabs: boolean; pexels: boolean; telegram: boolean; sheets: boolean; n8n: boolean; ffmpeg: boolean; remotion: boolean; branding: boolean; jamendo: boolean; }

// ─── Advanced App Types ───────────────────────────────────────

type AppView    = "mission" | "storyboard" | "pipeline" | "approvals" | "identity" | "health";

interface PipelineStage {
  pipeline_id: string;
  stage_name: string;
  status: string;
  attempt: number;
  started_at: string | null;
  completed_at: string | null;
  duration_s: number | null;
  error: string | null;
}

interface Pipeline {
  id: string;
  status: string;
  tier: string;
  topic: string;
  style: string;
  render_variant: string;
  hook_style: string;
  current_stage: string;
  progress_pct: number;
  error: string | null;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  worker_id: string | null;
  duration_s: number | null;
  retry_count: number;
  stages: PipelineStage[];
}

interface Worker {
  id: string;
  status: string;
  tier: string;
  concurrency: number;
  version: string;
  hostname: string;
  started_at: string;
  last_seen: string;
  heartbeat_age_s: number;
  uptime_s: number;
  memory_rss_mb: number | null;
  memory_heap_mb: number | null;
  renders_this_session: number | null;
  pipeline_id: string | null;
  pipeline_topic: string | null;
  current_stage: string | null;
  pipeline_progress: number | null;
}

interface QueueStats {
  db: { pending: number; running: number; done_today: number; failed_today: number; total: number; avg_duration_s: number | null } | null;
  bullmq: { waiting: number; active: number; delayed: number } | null;
}

interface AICosts {
  total_cost_usd: number;
  total_requests: number;
  cache_hit_rate: number;
  by_provider: Record<string, { cost_usd: number; requests: number }>;
}

// ─── Pipeline definition ──────────────────────────────────────


const ADVANCED_STAGES = [
  { id: "01-topic-validate",   label: "Validate",  Icon: CheckCircle2, desc: "Topic validation" },
  { id: "02-script-generate",  label: "Script",    Icon: Wand2,        desc: "AI script generation" },
  { id: "03-hook-generate",    label: "Hook",      Icon: Zap,          desc: "Hook generation" },
  { id: "04-scene-plan",       label: "Scenes",    Icon: Clapperboard, desc: "Scene planning" },
  { id: "05-asset-collect",    label: "Assets",    Icon: Image,        desc: "Asset collection" },
  { id: "06-voice-generate",   label: "Voice",     Icon: Activity,     desc: "ElevenLabs TTS" },
  { id: "07-caption-generate", label: "Captions",  Icon: Hash,         desc: "Caption generation" },
  { id: "08-scene-build",      label: "Build",     Icon: Layers,       desc: "Scene assembly" },
  { id: "10-remotion-render",  label: "Render",    Icon: Film,         desc: "Remotion render" },
  { id: "11-music-mix",        label: "Music",     Icon: Music2,       desc: "Music mix" },
  { id: "13-export",           label: "Export",    Icon: FolderOpen,   desc: "Final export" },
  { id: "14-upload",           label: "Upload",    Icon: Share2,       desc: "Cloud upload" },
  { id: "16-publish-queue",    label: "Publish",   Icon: Send,         desc: "Telegram approval" },
];

const NAV: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard",  label: "Dashboard",       Icon: LayoutDashboard },
  { id: "create",     label: "Create Video",    Icon: Plus },
  { id: "renders",    label: "Active Renders",  Icon: Film },
  { id: "library",    label: "Content Library", Icon: FolderOpen },
  { id: "publishing", label: "Publishing",      Icon: Share2 },
  { id: "settings",   label: "Settings",        Icon: Gauge },
];

// ─── Helpers ──────────────────────────────────────────────────

function displayTopic(topic: string) {
  return topic.replace(/ — /g, ": ").replace(/—/g, " ");
}

function slugOf(topic: string) {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function levelColor(level: string) {
  if (level === "error")   return "#f43f5e";
  if (level === "success") return "#10b981";
  if (level === "warning") return "#f59e0b";
  if (level === "agent")   return "#a78bfa";
  return "var(--text-secondary)";
}

function stripSlugPrefix(msg: string | undefined): string {
  return (msg ?? "").replace(/^\[[\w-]+\]\s*/, "");
}

function fmtDuration(s: number | null | undefined): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function fmtAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getStageColor(status: string): string {
  if (status === "done" || status === "skipped") return "#10b981";
  if (status === "running")  return "#6366f1";
  if (status === "failed")   return "#f43f5e";
  if (status === "cancelled") return "#f59e0b";
  return "rgba(255,255,255,0.12)";
}

function pipelineStatusColor(status: string): string {
  if (status === "done")      return "#10b981";
  if (status === "running")   return "#6366f1";
  if (status === "failed")    return "#f43f5e";
  if (status === "dead")      return "#7c3aed";
  if (status === "cancelled" || status === "timed_out") return "#f59e0b";
  if (status === "queued" || status === "pending") return "#f59e0b";
  return "rgba(255,255,255,0.3)";
}

// ─── Status Pill ──────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let bg = "rgba(255,255,255,0.05)", color = "var(--text-muted)", dot = "var(--border-strong)";
  if (s === "complete" || s === "done" || s === "uploaded") {
    bg = "rgba(16,185,129,0.12)"; color = "#10b981"; dot = "#10b981";
  } else if (s === "error") {
    bg = "rgba(244,63,94,0.12)"; color = "#f43f5e"; dot = "#f43f5e";
  } else if (["processing","rendering","exporting"].includes(s)) {
    bg = "rgba(99,102,241,0.12)"; color = "#a78bfa"; dot = "#a78bfa";
  } else if (s === "pending") {
    bg = "rgba(245,158,11,0.1)"; color = "#f59e0b"; dot = "#f59e0b";
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: bg, color, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

// ─── Page Title ───────────────────────────────────────────────

function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, color: "var(--text)", marginBottom: 4 }}>{title}</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>{sub}</p>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────

function Sidebar({ view, setView, pipeStatus, activeAgent, tier, setTier }: {
  view: View; setView: (v: View) => void;
  pipeStatus: Status; activeAgent: string;
  tier: Tier; setTier: (t: Tier) => void;
}) {
  const isRunning = pipeStatus === "running";
  const isDone    = pipeStatus === "done";
  const isError   = pipeStatus === "error";

  return (
    <aside style={{
      width: 220, minHeight: "100vh", flexShrink: 0,
      background: "linear-gradient(180deg, #0b0b18 0%, #08080f 100%)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      {/* Brand */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}>
            <Video size={18} color="#fff" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.4, color: "var(--text)" }}>Ottoflow</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1, fontWeight: 500 }}>Video Factory</div>
          </div>
        </div>

        {/* Pipeline status pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "7px 11px", borderRadius: 8,
          background: isRunning ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${isRunning ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
          transition: "all 0.3s",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
            background: isRunning ? "#10b981" : isDone ? "#10b981" : isError ? "#f43f5e" : "var(--border-strong)",
            boxShadow: isRunning ? "0 0 8px #10b981" : "none",
            animation: isRunning ? "pulse 1.5s infinite" : "none",
          }} />
          <span style={{ fontSize: 11, color: isRunning ? "var(--accent)" : "var(--text-secondary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isRunning ? (activeAgent || "Running…") : isDone ? "Pipeline done" : isError ? "Error" : "Idle"}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "12px 8px", flex: 1 }}>
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", padding: "0 8px 10px" }}>Menu</div>
        {NAV.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button key={id} onClick={() => setView(id)} style={{
              display: "flex", alignItems: "center", gap: 9,
              width: "100%", padding: "9px 10px", borderRadius: 8,
              border: "none", cursor: "pointer", textAlign: "left",
              fontSize: 13, fontWeight: active ? 600 : 400,
              fontFamily: "inherit", marginBottom: 2,
              transition: "all 0.15s ease",
              background: active ? "rgba(99,102,241,0.12)" : "transparent",
              color: active ? "#a78bfa" : "var(--text-secondary)",
              position: "relative",
              boxShadow: active ? "inset 0 0 0 1px rgba(99,102,241,0.2)" : "none",
            }}>
              {active && (
                <span style={{
                  position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                  width: 3, height: 18, borderRadius: "0 3px 3px 0",
                  background: "linear-gradient(180deg,#6366f1,#a78bfa)",
                }} />
              )}
              <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Tier Toggle */}
      <div style={{ padding: "12px 12px 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>Mode</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(["basic", "advanced"] as Tier[]).map(t => (
            <button key={t} onClick={() => setTier(t)} style={{
              width: "100%", padding: "8px 12px", borderRadius: 8,
              border: `1px solid ${tier === t ? (t === "advanced" ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.15)") : "var(--border)"}`,
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.15s",
              background: tier === t
                ? (t === "advanced" ? "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(167,139,250,0.15))" : "rgba(255,255,255,0.07)")
                : "transparent",
              color: tier === t ? (t === "advanced" ? "#a78bfa" : "var(--text)") : "var(--text-muted)",
              boxShadow: tier === t && t === "advanced" ? "0 0 12px rgba(99,102,241,0.2)" : "none",
            }}>
              <span style={{ fontSize: 14 }}>{t === "advanced" ? "⚡" : "◎"}</span>
              <div>
                <div>{t === "advanced" ? "Ops Dashboard" : "Studio"}</div>
                <div style={{ fontSize: 9, fontWeight: 500, color: "var(--text-muted)", marginTop: 1 }}>
                  {t === "advanced" ? "System monitoring" : "Create & publish"}
                </div>
              </div>
              {tier === t && <CheckCircle2 size={12} style={{ marginLeft: "auto", flexShrink: 0 }} color={t === "advanced" ? "#a78bfa" : "var(--text-muted)"} />}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px 16px", marginTop: 12 }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.8 }}>
          <div style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: 11 }}>joseph@ottoflow.ai</div>
          <div style={{ color: "var(--primary)", fontWeight: 700, fontSize: 11 }}>ottoflow.ai</div>
        </div>
      </div>
    </aside>
  );
}

// ─── Command Center ───────────────────────────────────────────

function CommandCenterView({ tier, setTier }: { tier: Tier; setTier: (t: Tier) => void }) {
  const [pipeStatus,   setPipeStatus]   = useState<Status>("idle");
  const [activeAgent,  setActiveAgent]  = useState("");
  const [doneAgents,   setDoneAgents]   = useState<Set<string>>(new Set());
  const [currentTopic, setCurrentTopic] = useState("");
  const [progress,     setProgress]     = useState(0);
  const [logs,         setLogs]         = useState<LogEntry[]>([]);
  const [running,       setRunning]       = useState(false);
  const [queue,         setQueue]         = useState<QueueRow[]>([]);
  const [previewSlug,   setPreviewSlug]   = useState<string | undefined>(undefined);
  const [renderingRows, setRenderingRows] = useState<Set<number>>(new Set());
  const [stuckCount,    setStuckCount]    = useState(0);
  const [activeJobs,    setActiveJobs]    = useState<DbJob[]>([]);
  const [workerOnline,     setWorkerOnline]     = useState<boolean | null>(null);
  const [workerRestarting, setWorkerRestarting] = useState(false);
  const [workerStarting,   setWorkerStarting]   = useState(false);
  const [showWorkerGuide,  setShowWorkerGuide]  = useState(false);
  const [installingStart,  setInstallingStart]  = useState(false);
  const [startupInstalled, setStartupInstalled] = useState(false);
  const [workerLogs,       setWorkerLogs]       = useState<string[]>([]);
  const [showWorkerLogs,   setShowWorkerLogs]   = useState(false);
  const [avgRenderMs,      setAvgRenderMs]      = useState<number | null>(null);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [stageStatuses,    setStageStatuses]    = useState<Record<string, string>>({});
  const logEndRef   = useRef<HTMLDivElement>(null);
  const logPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource("/api/pipeline-events");
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "init") {
            setPipeStatus(msg.status); setActiveAgent(msg.agent || "");
            setCurrentTopic(msg.topic || ""); setProgress(msg.progress || 0);
            setLogs(msg.logs || []);
          } else if (msg.type === "log") {
            setLogs((prev) => [...prev.slice(-199), msg.entry]);
            const incoming = msg.entry.agent as string;
            setActiveAgent((prev) => {
              if (prev && prev !== incoming) setDoneAgents((d) => new Set([...d, prev]));
              return incoming;
            });
          } else if (msg.type === "status") {
            if (msg.status) {
              setPipeStatus((prev) => {
                if (msg.status === "running" && prev !== "running") {
                  setDoneAgents(new Set());
                  toast.loading("Pipeline running…", { id: "pipeline" });
                } else if (msg.status === "done") {
                  toast.dismiss("pipeline"); toast.success("Pipeline complete!");
                } else if (msg.status === "error") {
                  toast.dismiss("pipeline"); toast.error("Pipeline error — check logs");
                }
                return msg.status;
              });
            }
            if (msg.currentTopic !== undefined) setCurrentTopic(msg.currentTopic);
            if (msg.progress     !== undefined) setProgress(msg.progress);
          }
        } catch {}
      };
      // Auto-reconnect after Vercel's 60s SSE limit cuts the connection
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3000); };
    };

    connect();
    return () => { es?.close(); clearTimeout(reconnectTimer); };
  }, []);

  // Advanced pipeline SSE — connects when tier=advanced and a pipeline is active
  useEffect(() => {
    if (tier !== "advanced" || !activePipelineId) return;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    const applyEvent = (ev: Record<string, unknown>) => {
      const type      = ev.type      as string;
      const stageName = ev.stageName as string | undefined;
      const progress  = ev.progress  as number | undefined;
      const message   = ev.message   as string | undefined;
      if (type === "stage_started" && stageName) {
        setStageStatuses(prev => ({ ...prev, [stageName]: "running" }));
        setActiveAgent(stageName);
        setPipeStatus("running");
      } else if (type === "stage_done" && stageName) {
        setStageStatuses(prev => ({ ...prev, [stageName]: "done" }));
        if (progress !== undefined) setProgress(progress);
      } else if (type === "stage_failed" && stageName) {
        setStageStatuses(prev => ({ ...prev, [stageName]: "failed" }));
      } else if (type === "stage_skipped" && stageName) {
        setStageStatuses(prev => ({ ...prev, [stageName]: "skipped" }));
      } else if (type === "log" && message) {
        setLogs(prev => [...prev.slice(-199), {
          id: Date.now(), ts: new Date().toISOString(),
          agent: stageName ?? "pipeline", message, level: "agent",
        }]);
      } else if (type === "pipeline_started") {
        setPipeStatus("running");
        toast.loading("Advanced pipeline running…", { id: "adv-pipeline" });
      } else if (type === "pipeline_done") {
        setPipeStatus("done");
        setStageStatuses(prev => {
          const u = { ...prev };
          Object.keys(u).forEach(k => { if (u[k] === "running") u[k] = "done"; });
          return u;
        });
        toast.dismiss("adv-pipeline"); toast.success("Advanced pipeline complete!");
      } else if (type === "pipeline_failed") {
        setPipeStatus("error");
        toast.dismiss("adv-pipeline"); toast.error("Pipeline failed — check logs");
      } else if (type === "progress" && progress !== undefined) {
        setProgress(progress);
      }
    };
    const connect = () => {
      es = new EventSource(`/api/advanced/events?p=${activePipelineId}&workers=1`);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as Record<string, unknown>;
          if (msg.type === "snapshot" && Array.isArray(msg.pipelines)) {
            const pipe = (msg.pipelines as { id: string; status: string; progress_pct?: number }[])
              .find(p => p.id === activePipelineId);
            if (pipe) {
              if      (pipe.status === "running") setPipeStatus("running");
              else if (pipe.status === "done")    setPipeStatus("done");
              else if (pipe.status === "failed")  setPipeStatus("error");
              if (pipe.progress_pct !== undefined) setProgress(pipe.progress_pct);
            }
          } else if (msg.type === "event_replay" && Array.isArray(msg.events)) {
            setStageStatuses({});
            (msg.events as Record<string, unknown>[]).forEach(applyEvent);
          } else {
            applyEvent(msg);
          }
        } catch { /* malformed message */ }
      };
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3_000); };
    };
    connect();
    return () => { es?.close(); clearTimeout(reconnectTimer); };
  }, [tier, activePipelineId]);

  useEffect(() => {
    const el = logPanelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const fetchQueue = useCallback(async () => {
    const r = await fetch("/api/queue").catch(() => null);
    if (!r?.ok) return;
    const d = await r.json();
    setQueue(d.rows || []);
    const done = (d.rows || []).find((row: QueueRow) => ["Done","Complete"].includes(row.status));
    if (done) setPreviewSlug(slugOf(done.topic));
  }, []);

  useEffect(() => { fetchQueue(); const t = setInterval(fetchQueue, 8000); return () => clearInterval(t); }, [fetchQueue]);

  useEffect(() => {
    const check = async () => {
      const r = await fetch("/api/jobs?stuck=true").catch(() => null);
      if (r?.ok) { const d = await r.json(); setStuckCount(d.count ?? 0); }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  // Poll worker status every 8s.
  // Priority: local agent (PID-level truth) → API (BullMQ + DB heartbeat + processing job).
  useEffect(() => {
    const check = async () => {
      // 1. Ask local agent — it tracks the PID and knows about crash/restart windows
      const agent = await fetch("http://localhost:7654/worker-status").catch(() => null);
      if (agent?.ok) {
        const d = await agent.json().catch(() => ({}));
        const alive      = d.workerAlive      === true;
        const restarting = d.workerRestarting === true;
        setWorkerOnline(alive);
        setWorkerRestarting(restarting);
        if (!alive && !restarting) {
          const lr = await fetch("http://localhost:7654/logs").catch(() => null);
          if (lr?.ok) { const ld = await lr.json().catch(() => ({})); setWorkerLogs(Array.isArray(ld.lines) ? ld.lines : []); }
        }
        return;
      }
      // 2. Agent not reachable — use API which checks BullMQ + DB heartbeat + processing job
      const r = await fetch("/api/worker-status").catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setWorkerOnline(d.online);
        setWorkerRestarting(false);
      } else {
        setWorkerOnline(false);
        setWorkerRestarting(false);
      }
    };
    check();
    const t = setInterval(check, 8_000);
    return () => clearInterval(t);
  }, []);

  // If DB shows an active processing job, the worker is definitely running — override any stale status.
  useEffect(() => {
    if (activeJobs.some(j => j.status === "processing")) {
      setWorkerOnline(true);
      setWorkerRestarting(false);
    }
  }, [activeJobs]);

  // Poll DB jobs every 5s — shows real render status independent of SSE
  useEffect(() => {
    const poll = async () => {
      const r = await fetch("/api/jobs?limit=10").catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      const jobs: DbJob[] = d.jobs ?? [];
      const active = jobs.filter(j => ["pending","processing"].includes(j.status));
      setActiveJobs(active);
      // If DB shows processing but SSE shows idle, sync the status pill
      if (active.length > 0) {
        setPipeStatus(prev => prev === "idle" ? "running" : prev);
        if (active[0]) setCurrentTopic(prev => prev || active[0].topic);
      }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  // Fetch avg render time from /api/status once on mount
  useEffect(() => {
    fetch("/api/status").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.avg_render_time_ms) setAvgRenderMs(d.avg_render_time_ms);
    }).catch(() => {});
  }, []);

  const runPipeline = async () => {
    setRunning(true); setLogs([]); setDoneAgents(new Set()); setStageStatuses({});
    if (tier === "advanced") {
      const res = await fetch("/api/pipeline/v2", { method: "POST" }).catch(() => null);
      if (res?.ok) {
        const d = await res.json() as { queued: number };
        if (d.queued > 0) toast.loading(`V2: ${d.queued} job(s) queued`, { id: "adv-pipeline" });
        else toast.error("No pending V2 rows to queue");
      } else {
        toast.error("Failed to queue V2 pipeline");
      }
    } else {
      await fetch("/api/pipeline", { method: "POST" }).catch(() => null);
    }
    setRunning(false); fetchQueue();
  };

  const renderRow = async (row: QueueRow) => {
    setRenderingRows(prev => new Set([...prev, row.rowIndex]));
    setStageStatuses({});
    toast.loading(`Rendering: ${displayTopic(row.topic)}`, { id: `r-${row.rowIndex}` });
    if (tier === "advanced") {
      const res = await fetch("/api/pipeline/v2", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: row.rowIndex }),
      }).catch(() => null);
      setRenderingRows(prev => { const s = new Set(prev); s.delete(row.rowIndex); return s; });
      if (res?.ok) {
        toast.success(`Queued V2: ${displayTopic(row.topic)}`, { id: `r-${row.rowIndex}` });
      } else {
        toast.error(`Failed: ${displayTopic(row.topic)}`, { id: `r-${row.rowIndex}` });
      }
    } else {
      const res = await fetch("/api/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: row.rowIndex }),
      }).catch(() => null);
      setRenderingRows(prev => { const s = new Set(prev); s.delete(row.rowIndex); return s; });
      if (res?.ok) toast.success(`Queued: ${displayTopic(row.topic)}`, { id: `r-${row.rowIndex}` });
      else         toast.error(`Failed: ${displayTopic(row.topic)}`, { id: `r-${row.rowIndex}` });
    }
    fetchQueue();
  };

  const installStartup = async () => {
    setInstallingStart(true);
    // First make sure the agent is running
    const ping = await fetch("http://localhost:7654/ping").catch(() => null);
    if (!ping?.ok) {
      toast.error("Agent not running — double-click start-agent.bat first, then try again.");
      setInstallingStart(false);
      return;
    }
    const r = await fetch("http://localhost:7654/install-startup").catch(() => null);
    if (r?.ok) {
      setStartupInstalled(true);
      toast.success("Installed! Worker will now start automatically on every PC boot.");
    } else {
      toast.error("Install failed — check that start-agent.bat is running.");
    }
    setInstallingStart(false);
  };

  const killJobs = async () => {
    const r = await fetch("/api/jobs/reset", { method: "POST" }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      toast.success(`Killed ${d.killed} job(s) — queue cleared`);
      setActiveJobs([]);
      setPipeStatus("idle");
    } else {
      toast.error("Failed to kill jobs — check DB connection");
    }
  };

  const killSingleJob = async (jobId: string) => {
    const r = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) {
      setActiveJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success("Job killed");
    } else {
      toast.error("Failed to kill job");
    }
  };

  const startWorker = async () => {
    setWorkerStarting(true);

    // 1. Try local agent (works from Vercel — browser calls localhost directly)
    const agent = await fetch("http://localhost:7654/start", { method: "GET" })
      .catch(() => null);

    if (agent?.ok) {
      toast.success("Worker starting… ready in ~5 seconds");
      setTimeout(async () => {
        const s = await fetch("/api/worker-status").catch(() => null);
        if (s?.ok) { const sd = await s.json(); setWorkerOnline(sd.online); }
        setWorkerStarting(false);
      }, 6000);
      return;
    }

    // 2. Try server-side spawn (works when accessing localhost:3000 directly)
    const r = await fetch("/api/start-worker", { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => ({})) ?? {};

    if (d.ok) {
      toast.success("Worker starting… ready in ~5 seconds");
      setTimeout(async () => {
        const s = await fetch("/api/worker-status").catch(() => null);
        if (s?.ok) { const sd = await s.json(); setWorkerOnline(sd.online); }
        setWorkerStarting(false);
      }, 6000);
    } else {
      // 3. Agent not running — show setup guide
      setShowWorkerGuide(true);
      setWorkerStarting(false);
    }
  };

  const agents = ADVANCED_STAGES;

  const stats = {
    total:   queue.length,
    pending: queue.filter(r => ["Pending", "Queued"].includes(r.status)).length,
    active:  queue.filter(r => ["Processing","Rendering","Exporting"].includes(r.status)).length,
    done:    queue.filter(r => ["Done","Complete"].includes(r.status)).length,
    error:   queue.filter(r => r.status === "Error").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* ── WORKER SETUP GUIDE MODAL ── */}
      {showWorkerGuide && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setShowWorkerGuide(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0f0f1e", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 14, padding: 28, maxWidth: 520, width: "100%",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Start the Render Worker</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>The worker runs on your local machine and connects to the cloud queue automatically.</div>
              </div>
              <button onClick={() => setShowWorkerGuide(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>

            {/* Option 1 — Agent (recommended) */}
            <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 6 }}>⭐ One-time setup — then the button works forever</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>Double-click <strong style={{ color: "var(--text)" }}>start-agent.bat</strong> in your project folder. The worker starts automatically and the button above will control it from anywhere.</div>
              <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.9 }}>
                📁 <code style={{ color: "#a78bfa" }}>D:\tiktok-product-video-factory\</code><br/>
                &nbsp;&nbsp;&nbsp;→ double-click <strong style={{ color: "#10b981" }}>start-agent.bat</strong><br/>
                &nbsp;&nbsp;&nbsp;→ minimize the window that opens (don&apos;t close it)
              </div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(16,185,129,0.06)", borderRadius: 7, border: "1px solid rgba(16,185,129,0.15)", fontSize: 11, color: "var(--text-muted)" }}>
                💡 <strong style={{ color: "var(--text-secondary)" }}>Auto-start on every boot:</strong> Right-click <code>start-agent.bat</code> → Create Shortcut → press <kbd style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>Win+R</kbd> → type <code>shell:startup</code> → drag shortcut there.
              </div>
            </div>

            {/* Option 2 — Manual */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>No setup — run manually each time</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Double-click <strong style={{ color: "var(--text)" }}>start-worker.bat</strong> in the same folder. Keep the window open while rendering.</div>
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              Once running, the <span style={{ color: "#10b981", fontWeight: 600 }}>● Worker Online</span> bar appears and the button works from anywhere.
            </div>
          </div>
        </div>
      )}

      {/* ── TOP BAR: title + stats + run button ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "rgba(7,7,17,0.95)", backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: pipeStatus === "running" ? "#10b981" : pipeStatus === "error" ? "#f43f5e" : pipeStatus === "done" ? "#10b981" : "#333",
            boxShadow: pipeStatus === "running" ? "0 0 10px #10b981" : "none",
            animation: pipeStatus === "running" ? "pulse 1.5s infinite" : "none",
          }} />
          <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.8px", textTransform: "uppercase", color: pipeStatus === "running" ? "var(--accent)" : "var(--text-muted)" }}>
            {pipeStatus === "running" ? "RUNNING" : pipeStatus === "done" ? "COMPLETE" : pipeStatus === "error" ? "ERROR" : "COMMAND CENTER"}
          </span>
          {currentTopic && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 9px", background: "var(--bg-elevated)", borderRadius: 5, border: "1px solid var(--border)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayTopic(currentTopic)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            { label: "Total",   val: String(stats.total),   color: "var(--text-secondary)" },
            { label: "Pending", val: String(stats.pending), color: "#f59e0b" },
            { label: "Active",  val: String(stats.active),  color: "#a78bfa" },
            { label: "Done",    val: String(stats.done),    color: "#10b981" },
            { label: "Error",   val: String(stats.error),   color: "#f43f5e" },
            ...(avgRenderMs ? [{ label: "Avg", val: `~${Math.round(avgRenderMs / 60000)}m`, color: "var(--text-muted)" }] : []),
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color }}>{val}</span>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</span>
            </div>
          ))}
          <div style={{ padding: "3px 10px", borderRadius: 6, background: tier === "advanced" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${tier === "advanced" ? "rgba(99,102,241,0.3)" : "var(--border)"}`, fontSize: 10, fontWeight: 700, color: tier === "advanced" ? "#a78bfa" : "var(--text-muted)" }}>
            {tier === "advanced" ? "⚡ Advanced" : "◎ Basic"}
          </div>
          <button
            onClick={killJobs}
            title="Kill all stuck/processing jobs and reset to idle"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 7, cursor: "pointer",
              border: "1px solid rgba(244,63,94,0.35)",
              background: activeJobs.length > 0 ? "rgba(244,63,94,0.12)" : "rgba(255,255,255,0.03)",
              color: activeJobs.length > 0 ? "#f43f5e" : "var(--text-muted)",
              fontSize: 11, fontWeight: 700, fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            <XCircle size={12} /> Reset Jobs
          </button>
          <button className="btn btn-primary btn-sm" onClick={runPipeline} disabled={running} style={{ gap: 5 }}>
            {running
              ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
              : <><Play size={12} fill="currentColor" /> Run Pipeline</>}
          </button>
        </div>
      </div>

      {/* ── WORKER RESTARTING BANNER ── */}
      {workerOnline === false && workerRestarting && (
        <div style={{ padding: "10px 20px", flexShrink: 0, background: "rgba(99,102,241,0.07)", borderBottom: "1px solid rgba(99,102,241,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "#818cf8" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Worker Restarting</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— Crashed and coming back up. Ready in ~5 seconds.</span>
          </div>
        </div>
      )}

      {/* ── WORKER STATUS BANNER ── */}
      {workerOnline === false && !workerRestarting && (
        <div style={{
          padding: "10px 20px", flexShrink: 0,
          background: "rgba(245,158,11,0.07)",
          borderBottom: "1px solid rgba(245,158,11,0.18)",
        }}>
          {/* Row 1: status + buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>Worker Offline</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— Renders will queue but won&apos;t process until the worker starts.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {/* Download button — detects OS */}
              <button
                onClick={() => {
                  const isMac = /mac|darwin|iphone|ipad/i.test(navigator.userAgent);
                  let content: string, filename: string;
                  if (isMac) {
                    content  = `#!/bin/bash\nDIR="$(cd "$(dirname "$0")" && pwd)"\ncd "$DIR"\necho "Starting Ottoflow Agent..."\nnode local-agent.js\n`;
                    filename = "start-agent.command";
                  } else {
                    content  = `@echo off\r\ntitle Ottoflow Agent\r\ncd /d "%~dp0"\r\necho Starting Ottoflow Agent...\r\nnode local-agent.js\r\n`;
                    filename = "start-agent.bat";
                  }
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([content], { type: "application/octet-stream" }));
                  a.download = filename;
                  a.click();
                }}
                style={{
                  padding: "6px 13px", borderRadius: 7,
                  border: "1px solid rgba(245,158,11,0.4)",
                  background: "rgba(245,158,11,0.12)", color: "#f59e0b",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                }}
              >
                ⬇ Download Setup File
              </button>
              {/* Start button (if agent already running) */}
              <button
                onClick={startWorker}
                disabled={workerStarting}
                style={{
                  padding: "6px 13px", borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)", color: "var(--text-muted)",
                  fontSize: 11, fontWeight: 700, cursor: workerStarting ? "not-allowed" : "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                  opacity: workerStarting ? 0.6 : 1,
                }}
              >
                {workerStarting
                  ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Starting…</>
                  : <><Play size={11} fill="currentColor" /> Start Worker</>}
              </button>
              {workerLogs.length > 0 && (
                <button
                  onClick={() => setShowWorkerLogs(v => !v)}
                  style={{
                    padding: "6px 13px", borderRadius: 7,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)", color: "var(--text-muted)",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <Terminal size={11} /> {showWorkerLogs ? "Hide Logs" : "View Logs"}
                </button>
              )}
            </div>
          </div>
          {/* Worker log panel */}
          {showWorkerLogs && workerLogs.length > 0 && (
            <div style={{
              marginTop: 8, padding: "8px 10px", borderRadius: 7,
              background: "rgba(0,0,0,0.5)", border: "1px solid rgba(245,158,11,0.15)",
              maxHeight: 160, overflowY: "auto",
            }}>
              {workerLogs.map((line, i) => (
                <div key={i} style={{
                  fontSize: 10, fontFamily: "monospace", color: line.includes("err") ? "#f43f5e" : "#94a3b8",
                  lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
                }}>{line}</div>
              ))}
            </div>
          )}
          {/* Row 2: OS-aware 2-step note */}
          <div style={{
            marginTop: 8, padding: "8px 12px", borderRadius: 7,
            background: "rgba(0,0,0,0.25)", border: "1px solid rgba(245,158,11,0.12)",
          }}>
            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, marginBottom: 5 }}>
              First time only — 2 steps:
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {/* Windows */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 3 }}>🪟 Windows</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  ① Download → save <code style={{ color: "#f59e0b" }}>start-agent.bat</code> to your project folder → double-click it<br/>
                  ② Green bar appears → click <strong>Install Auto-Start</strong> → done forever ✓
                </div>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
              {/* Mac */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 3 }}>🍎 Mac</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  ① Download → save <code style={{ color: "#f59e0b" }}>start-agent.command</code> to your project folder → double-click it → click <strong>Workers</strong><br/>
                  ② Green bar appears → click <strong>Install Auto-Start</strong> → done forever ✓
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {workerOnline === true && (
        <div style={{
          padding: "5px 20px", flexShrink: 0,
          background: "rgba(16,185,129,0.05)",
          borderBottom: "1px solid rgba(16,185,129,0.12)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#10b981", letterSpacing: "0.4px" }}>WORKER ONLINE — Ready to render</span>
          </div>
          {!startupInstalled ? (
            <button
              onClick={installStartup}
              disabled={installingStart}
              title="Install agent to Windows startup so worker starts automatically on every boot"
              style={{
                padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                border: "1px solid rgba(16,185,129,0.3)",
                background: "rgba(16,185,129,0.08)", color: "#10b981",
                fontSize: 10, fontWeight: 700, cursor: installingStart ? "not-allowed" : "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4,
                opacity: installingStart ? 0.6 : 1,
              }}
            >
              {installingStart
                ? <><Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> Installing…</>
                : <>⚡ Install Auto-Start</>}
            </button>
          ) : (
            <span style={{ fontSize: 10, color: "#10b981", opacity: 0.7 }}>✓ Auto-starts on boot</span>
          )}
        </div>
      )}

      {/* ── PIPELINE STRIP ── */}
      <div style={{
        padding: "10px 20px", flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,10,20,0.9)",
        overflowX: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", minWidth: "max-content", gap: 0 }}>
          {agents.map((agent, i) => {
            const stageSt  = tier === "advanced" ? (stageStatuses[agent.id] ?? "pending") : undefined;
            const isActive = tier === "advanced"
              ? stageSt === "running"
              : (pipeStatus === "running" && activeAgent === agent.id);
            const isDone   = tier === "advanced"
              ? (stageSt === "done" || stageSt === "skipped")
              : (doneAgents.has(agent.id) || pipeStatus === "done");
            const isFailed = tier === "advanced" && stageSt === "failed";
            const { Icon } = agent;
            return (
              <React.Fragment key={`${agent.id}-${i}`}>
                <motion.div
                  animate={isActive ? { scale: 1.04 } : { scale: 1 }}
                  transition={{ duration: 0.2 }}
                  title={agent.desc}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "6px 10px", borderRadius: 9, cursor: "default",
                    background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                    border: `1px solid ${isActive ? "rgba(99,102,241,0.4)" : "transparent"}`,
                    boxShadow: isActive ? "0 0 16px rgba(99,102,241,0.2)" : "none",
                    transition: "all 0.2s ease", minWidth: 64,
                  }}
                >
                  {/* Icon circle */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive
                      ? "linear-gradient(135deg,#6366f1,#a78bfa)"
                      : isFailed ? "rgba(244,63,94,0.15)" : isDone ? "rgba(16,185,129,0.15)" : "var(--bg-elevated)",
                    border: `1px solid ${isActive ? "rgba(99,102,241,0.5)" : isFailed ? "rgba(244,63,94,0.3)" : isDone ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                    boxShadow: isActive ? "0 0 12px rgba(99,102,241,0.4)" : "none",
                    transition: "all 0.25s ease",
                    position: "relative",
                  }}>
                    {isFailed
                      ? <XCircle size={14} color="#f43f5e" strokeWidth={2.5} />
                      : isDone && !isActive
                      ? <CheckCircle2 size={14} color="#10b981" strokeWidth={2.5} />
                      : <Icon size={14} color={isActive ? "#fff" : "var(--text-muted)"} strokeWidth={isActive ? 2.5 : 1.8} />}
                    {isActive && (
                      <motion.span
                        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid rgba(99,102,241,0.5)" }}
                      />
                    )}
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: 9, fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--accent)" : isFailed ? "#f43f5e" : isDone ? "var(--green)" : "var(--text-muted)",
                    textAlign: "center", letterSpacing: "0.2px", lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}>
                    {agent.label}
                  </span>
                </motion.div>

                {/* Connector arrow */}
                {i < agents.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0, padding: "0 2px" }}>
                    <div style={{
                      width: 20, height: 1,
                      background: isDone ? "var(--green)" : isActive ? "var(--primary)" : "var(--border)",
                      transition: "background 0.3s",
                    }} />
                    <ChevronRight size={10} color={isDone ? "var(--green)" : isActive ? "var(--primary)" : "var(--border)"} strokeWidth={2} style={{ marginLeft: -4, flexShrink: 0 }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── MAIN 2-COL: preview+queue | log ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* LEFT: progress + preview + queue */}
        <div style={{ overflowY: "auto", padding: "16px 16px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Progress bar */}
          <AnimatePresence>
            {pipeStatus === "running" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.25)", padding: "10px 14px" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                    {activeAgent || "Processing…"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{progress}%</span>
                </div>
                <div style={{ height: 3, background: "var(--bg-elevated)", borderRadius: 3, overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#6366f1,#22d3ee)", boxShadow: "0 0 8px rgba(99,102,241,0.5)" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active DB jobs — shows real render progress even if SSE is reconnecting */}
          {activeJobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {activeJobs.map(job => {
                const startedAt = job.started_at ? (() => { const d = new Date(job.started_at!); return isNaN(d.getTime()) ? null : d; })() : null;
                const minAgo    = startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 60000) : 0;
                const isStuck   = job.status === "processing" && minAgo >= 10;
                const color     = isStuck ? "#f43f5e" : "#a78bfa";
                const bg        = isStuck ? "rgba(244,63,94,0.08)"   : "rgba(99,102,241,0.08)";
                const border    = isStuck ? "rgba(244,63,94,0.25)"   : "rgba(99,102,241,0.2)";
                return (
                  <div key={job.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderRadius: 9, background: bg, border: `1px solid ${border}` }}>
                    <Loader2 size={12} style={{ animation: "spin 1s linear infinite", color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isStuck ? "⚠ Stuck:" : job.status === "processing" ? "Rendering:" : "Queued:"} {displayTopic(job.topic)}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
                      {startedAt ? `${minAgo}m ago` : job.template}
                    </span>
                    <button
                      onClick={() => killSingleJob(job.id)}
                      title="Kill this render only"
                      style={{
                        padding: "2px 9px", borderRadius: 5, flexShrink: 0,
                        border: "1px solid rgba(244,63,94,0.35)",
                        background: "rgba(244,63,94,0.1)", color: "#f43f5e",
                        fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Kill
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stuck jobs warning (>15 min — DB-confirmed) */}
          {stuckCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderRadius: 9, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)" }}>
              <span style={{ fontSize: 12, color: "#f43f5e", fontWeight: 600 }}>
                {stuckCount} job{stuckCount > 1 ? "s" : ""} stuck &gt;15 min
              </span>
              <button
                onClick={killJobs}
                style={{
                  padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(244,63,94,0.4)",
                  background: "rgba(244,63,94,0.12)", color: "#f43f5e",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Reset Now
              </button>
            </div>
          )}

          {/* 2-col: preview + queue */}
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, flex: 1 }}>
            {/* Preview */}
            <div className="card" style={{ padding: 0, overflow: "hidden", alignSelf: "start" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f43f5e" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.8px", textTransform: "uppercase", marginLeft: 6 }}>Preview</span>
              </div>
              <div style={{ padding: 10 }}>
                <RemotionPreview slug={previewSlug} />
                {previewSlug && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.4 }}>
                    {displayTopic(previewSlug.replace(/-/g, " "))}
                  </div>
                )}
              </div>
            </div>

            {/* Queue overview */}
            <div className="card" style={{ padding: 0, overflow: "hidden", alignSelf: "start" }}>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>Queue Overview</span>
                <button className="btn btn-ghost btn-sm" onClick={fetchQueue} style={{ gap: 4, padding: "3px 8px", fontSize: 10 }}>
                  <RefreshCw size={10} /> Refresh
                </button>
              </div>
              {(() => {
                if (queue.length === 0) {
                  return <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>No content in queue</div>;
                }

                // Merge DB job status into queue rows so "processing" jobs show immediately
                // even before Google Sheets column is updated by the orchestrator
                const dbStatusByTopic = Object.fromEntries(
                  activeJobs.map(j => [j.topic.toLowerCase().trim(), j.status])
                );
                const mergedQueue = queue.map(r => {
                  const dbStatus = dbStatusByTopic[r.topic.toLowerCase().trim()];
                  if (dbStatus === "processing") return { ...r, status: "Processing" };
                  return r;
                });

                const activeRows  = mergedQueue.filter(r => ["Processing","Rendering","Exporting"].includes(r.status));
                const pendingRows = mergedQueue.filter(r => ["Pending", "Queued"].includes(r.status));
                const errorRows   = mergedQueue.filter(r => r.status === "Error");
                const doneRows    = mergedQueue.filter(r => ["Done","Complete"].includes(r.status)).sort((a, b) => b.rowIndex - a.rowIndex);

                const groups: { label: string; icon: string; rows: QueueRow[]; dim?: boolean }[] = [
                  { label: "Active",  icon: "🔄", rows: activeRows  },
                  { label: "Pending", icon: "⏳", rows: pendingRows },
                  { label: "Error",   icon: "❌", rows: errorRows   },
                  { label: "Done",    icon: "✅", rows: doneRows, dim: true },
                ].filter(g => g.rows.length > 0);

                const iconBtn: React.CSSProperties = {
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: 6,
                  border: "1px solid var(--border)", background: "var(--bg-elevated)",
                  color: "var(--text-muted)", cursor: "pointer", flexShrink: 0,
                  textDecoration: "none", transition: "color 0.15s, border-color 0.15s",
                };

                const renderRow_ = (row: QueueRow) => {
                  const isRendering  = renderingRows.has(row.rowIndex);
                  const isProcessing = row.status === "Processing";
                  const isDone       = ["Done","Complete"].includes(row.status);
                  const slug        = slugOf(row.topic);
                  return (
                    <div key={row.rowIndex} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: "1px solid var(--border)", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {displayTopic(row.topic)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                        <StatusPill status={row.status} />
                        {isDone ? (
                          <>
                            {/* Watch video */}
                            <a
                              href={`/api/video/${slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Watch / stream video"
                              style={iconBtn}
                            >
                              <Eye size={11} />
                            </a>
                            {/* Open output folder (local only) */}
                            <button
                              title="Open output folder (local dev)"
                              onClick={async () => {
                                const r = await fetch(`/api/open-folder/${slug}`, { method: "POST" }).catch(() => null);
                                if (!r?.ok) toast.error("Folder not found — run worker locally to generate outputs");
                              }}
                              style={{ ...iconBtn, cursor: "pointer", fontFamily: "inherit" }}
                            >
                              <FolderOpen size={11} />
                            </button>
                          </>
                        ) : isProcessing ? (
                          <button
                            onClick={() => {
                              const activeJob = activeJobs.find(j => j.topic.toLowerCase().trim() === row.topic.toLowerCase().trim());
                              if (activeJob) killSingleJob(activeJob.id);
                              else killJobs();
                            }}
                            title="Kill this render"
                            style={{
                              display: "flex", alignItems: "center", gap: 3,
                              padding: "3px 8px", borderRadius: 6,
                              border: "1px solid rgba(244,63,94,0.35)",
                              background: "rgba(244,63,94,0.1)", color: "#f43f5e",
                              cursor: "pointer", fontSize: 10, fontWeight: 700,
                              fontFamily: "inherit", whiteSpace: "nowrap",
                            }}
                          >
                            <XCircle size={9} /> Kill
                          </button>
                        ) : (
                          <button
                            onClick={() => renderRow(row)}
                            disabled={isRendering}
                            style={{
                              display: "flex", alignItems: "center", gap: 3,
                              padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)",
                              background: isRendering ? "var(--bg)" : "var(--primary-light)",
                              color: isRendering ? "var(--text-muted)" : "var(--accent)",
                              cursor: isRendering ? "not-allowed" : "pointer",
                              fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isRendering
                              ? <><Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> …</>
                              : <><Play size={9} fill="currentColor" /> Render</>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{ maxHeight: 420, overflowY: "auto" }}>
                    {groups.map(({ label, icon, rows, dim }) => (
                      <div key={label}>
                        {/* Section header */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "5px 12px 4px",
                          background: "rgba(255,255,255,0.02)",
                          borderBottom: "1px solid var(--border)",
                          position: "sticky", top: 0, zIndex: 1,
                        }}>
                          <span style={{ fontSize: 10 }}>{icon}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: dim ? "var(--text-muted)" : "var(--text-secondary)" }}>
                            {label}
                          </span>
                          <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 2 }}>({rows.length})</span>
                          {label === "Done" && <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: "auto" }}>newest first</span>}
                        </div>
                        {rows.map(renderRow_)}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT: Live log */}
        <div style={{ borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "#050510", minHeight: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
              {pipeStatus === "running" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 1.5s infinite" }} />}
              <Activity size={10} /> Live Output
            </span>
            <button onClick={() => { setLogs([]); fetch("/api/pipeline-events", { method: "DELETE" }).catch(() => {}); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 9, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.5px" }}>CLEAR</button>
          </div>
          <div ref={logPanelRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 0", fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 10.5 }}>
            {logs.length === 0 ? (
              <div style={{ padding: "32px 16px", color: "var(--text-muted)", textAlign: "center", lineHeight: 2 }}>
                <Terminal size={22} style={{ opacity: 0.15, display: "block", margin: "0 auto 8px" }} />
                Run pipeline to see live output
              </div>
            ) : logs.map((entry, idx) => {
              const tsDate = entry.ts ? new Date(entry.ts) : null;
              const tsStr  = tsDate && !isNaN(tsDate.getTime())
                ? tsDate.toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "";
              return (
                <div key={entry.id ?? `${entry.ts}-${idx}`} style={{ padding: "2px 12px 3px", borderLeft: `2px solid ${levelColor(entry.level ?? "")}30`, marginBottom: 1 }}>
                  <div style={{ display: "flex", gap: 5, marginBottom: 1 }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {tsStr}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#6366f1", flexShrink: 0, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.agent ?? ""}
                    </span>
                  </div>
                  <div style={{ color: levelColor(entry.level ?? ""), wordBreak: "break-word", lineHeight: 1.55 }}>
                    {stripSlugPrefix(entry.message)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Video Preview Modal ──────────────────────────────────────

function VideoPreviewModal({ slug, topic, onClose }: { slug: string; topic: string; onClose: () => void }) {
  const { url, viewUrl, source, loading } = useVideoInfo(slug);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border-strong)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 360, width: "100%", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", lineHeight: 1.4 }}>{topic}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{slug}</div>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", cursor: "pointer", padding: "5px 12px", fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
            <XCircle size={12} /> Close
          </button>
        </div>
        <div style={{ width: "100%", maxWidth: 260 }}>
          <RemotionPreview slug={slug} />
        </div>
        {!loading && url && (
          source === "local"
            ? (
              <a href={url} download={`${slug}.mp4`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--primary-light)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                ↓ Download MP4
              </a>
            ) : (
              <a href={viewUrl ?? url ?? "#"} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--primary-light)", color: "var(--accent)", border: "1px solid rgba(99,102,241,0.25)", textDecoration: "none" }}>
                ↗ Open in Drive
              </a>
            )
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Queue View ───────────────────────────────────────────────

function QueueView({ tier }: { tier: Tier }) {
  const [rows,         setRows]         = useState<QueueRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("All");
  const [renderingIdx, setRenderingIdx] = useState<Set<number>>(new Set());
  const [renderedIdx,  setRenderedIdx]  = useState<Set<number>>(new Set());
  const [previewRow,   setPreviewRow]   = useState<QueueRow | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [addTopic,     setAddTopic]     = useState("");
  const [addStyle,     setAddStyle]     = useState("Educational");
  const [addSaving,    setAddSaving]    = useState(false);

  const fetchRows = useCallback(async () => {
    const url = tier === "advanced" ? "/api/queue?sheet=v2" : "/api/queue";
    const r = await fetch(url).catch(() => null);
    if (r?.ok) { const d = await r.json(); setRows(d.rows || []); }
    setLoading(false);
  }, [tier]);

  useEffect(() => { fetchRows(); const t = setInterval(fetchRows, 8000); return () => clearInterval(t); }, [fetchRows]);

  useEffect(() => {
    const done = new Set(rows.filter(r => ["Done","Complete"].includes(r.status)).map(r => r.rowIndex));
    if (done.size > 0) setRenderedIdx(prev => new Set([...prev, ...done]));
  }, [rows]);

  const renderSingle = async (row: QueueRow) => {
    setRenderingIdx(prev => new Set([...prev, row.rowIndex]));
    const tid = `render-${row.rowIndex}`;
    toast.loading(`Rendering: ${displayTopic(row.topic)}`, { id: tid });
    let res;
    if (tier === "advanced") {
      res = await fetch("/api/pipeline/v2", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: row.rowIndex }),
      }).catch(() => null);
    } else {
      res = await fetch("/api/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: row.rowIndex }),
      }).catch(() => null);
    }
    setRenderingIdx(prev => { const s = new Set(prev); s.delete(row.rowIndex); return s; });
    if (res?.ok) {
      setRenderedIdx(prev => new Set([...prev, row.rowIndex]));
      toast.success(`Queued: ${displayTopic(row.topic)}`, { id: tid });
    } else {
      toast.error(`Failed: ${displayTopic(row.topic)}`, { id: tid });
    }
    fetchRows();
  };

  const saveNewTopic = async () => {
    if (!addTopic.trim()) { toast.error("Topic cannot be empty"); return; }
    setAddSaving(true);
    const res = await fetch("/api/queue/add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: addTopic.trim(), style: addStyle }),
    }).catch(() => null);
    setAddSaving(false);
    if (res?.ok) {
      toast.success(`Added: ${addTopic.trim()}`);
      setAddTopic(""); setAddOpen(false); fetchRows();
    } else {
      toast.error("Failed to add — check Sheets connection");
    }
  };

  const statuses = ["All", "Pending", "Processing", "Rendering", "Complete", "Error"];
  const filtered = filter === "All" ? rows : rows.filter(r => r.status === filter);

  return (
    <div style={{ padding: "28px 32px" }}>
      <AnimatePresence>
        {previewRow && (
          <VideoPreviewModal slug={slugOf(previewRow.topic)} topic={previewRow.topic} onClose={() => setPreviewRow(null)} />
        )}
        {addOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAddOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: 480, boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={16} color="var(--accent)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Add New Topic</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Saved to Google Sheets as Pending</div>
                </div>
              </div>
              <hr className="glow-divider" />
              <div style={{ marginBottom: 14 }}>
                <label>Topic</label>
                <input
                  autoFocus value={addTopic}
                  onChange={e => setAddTopic(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveNewTopic()}
                  placeholder="e.g. The OODA Loop — how to make faster decisions"
                />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label>Style</label>
                <select value={addStyle} onChange={e => setAddStyle(e.target.value)}>
                  {["Educational","Motivational","Case Study","Lifestyle","Startup-focused","Luxury","Neon"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setAddOpen(false)} className="btn btn-ghost">Cancel</button>
                <button onClick={saveNewTopic} disabled={addSaving || !addTopic.trim()} className="btn btn-primary">
                  {addSaving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Plus size={13} /> Add to Queue</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.6, color: "var(--text)", marginBottom: 4 }}>Content Queue</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {tier === "advanced" ? "Video Gen — Advanced V2 pipeline (Veo 3.1 Lite)" : "Sheet1 — Basic pipeline (Pexels backgrounds)"}
          </p>
        </div>
        <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: tier === "advanced" ? "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(167,139,250,0.2))" : "var(--bg-elevated)", color: tier === "advanced" ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${tier === "advanced" ? "rgba(99,102,241,0.3)" : "var(--border)"}` }}>
          {tier === "advanced" ? "⚡ Advanced" : "Basic"}
        </span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {statuses.map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "5px 13px", borderRadius: 20, border: "1px solid var(--border)",
                cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                background: filter === s ? "var(--primary)" : "transparent",
                color: filter === s ? "#fff" : "var(--text-muted)",
                transition: "all 0.12s",
              }}>{s}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)} style={{ gap: 4 }}>
              <Plus size={12} /> Add Topic
            </button>
            <button className="btn btn-ghost btn-sm" onClick={fetchRows} style={{ gap: 4 }}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>

        <div style={{ padding: "8px 0" }}>
          {loading ? (
            <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              <List size={32} style={{ opacity: 0.15, display: "block", margin: "0 auto 10px" }} />
              {rows.length === 0 ? "No content found. Add rows to your Google Sheet." : `No ${filter.toLowerCase()} items.`}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 140px 110px 250px", padding: "6px 20px", marginBottom: 2 }}>
                {["", "Topic", "Style", "Status", "Actions"].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{h}</div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px 8px" }}>
                {filtered.map((row) => {
                  const isRendering = renderingIdx.has(row.rowIndex);
                  const canPreview  = renderedIdx.has(row.rowIndex) || ["Done","Complete"].includes(row.status);
                  return (
                    <motion.div
                      key={row.rowIndex}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      style={{ display: "grid", gridTemplateColumns: "32px 1fr 140px 110px 250px", padding: "10px 12px", borderRadius: 9, background: "var(--bg-elevated)", border: "1px solid var(--border)", alignItems: "center" }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "var(--bg)", border: "1px solid var(--border)", flexShrink: 0 }}>
                        {row.avatarUrl
                          ? <img src={row.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text-muted)" }}>?</div>
                        }
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
                        {displayTopic(row.topic)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.style}</div>
                      <StatusPill status={row.status} />
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => renderSingle(row)} disabled={isRendering} className="btn btn-sm" style={{ background: isRendering ? "var(--bg-elevated)" : "var(--primary-light)", color: isRendering ? "var(--text-muted)" : "var(--accent)", border: "1px solid var(--border)", gap: 4, cursor: isRendering ? "not-allowed" : "pointer" }}>
                          {isRendering ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Rendering</> : <><Play size={11} fill="currentColor" /> Render</>}
                        </button>
                        {canPreview && (
                          <>
                            <button onClick={() => setPreviewRow(row)} className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
                              <Eye size={11} /> Preview
                            </button>
                            <button onClick={() => fetch(`/api/open-folder/${slugOf(row.topic)}`, { method: "POST" })} className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
                              <FolderOpen size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div style={{ padding: "8px 20px", fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
                {filtered.length} of {rows.length} · auto-refresh 8s
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Agents View ──────────────────────────────────────────────

const ALL_AGENTS = [
  { name: "Gemini Script",   desc: "Gemini 2.0 Flash — script + scene prompts (V2 Advanced)",      svc: "gemini",     fb: "Anthropic fallback", Icon: Wand2,          v2: true  },
  { name: "ElevenLabs TTS",  desc: "eleven_v3 — text-to-speech voiceover with emotion (V2)",       svc: "elevenlabs", fb: "Skipped",            Icon: Activity,       v2: true  },
  { name: "Veo 3.1 Lite",    desc: "Google AI text-to-video per scene, 9:16 portrait (V2)",        svc: "gemini",     fb: "Imagen3 fallback",   Icon: Video,          v2: true  },
  { name: "Script Writer",   desc: "Hook + script generation via Claude AI (Basic)",                svc: "anthropic",  fb: "Template fallback",  Icon: Wand2                    },
  { name: "Design Agent",    desc: "Visual theme, mood and color palette selection",                svc: "anthropic",  fb: "Default theme",      Icon: Layers                   },
  { name: "Storyboard",      desc: "Shot sequence, narrative arc and visual plan",                  svc: "anthropic",  fb: "Default storyboard", Icon: Clapperboard             },
  { name: "Music Director",  desc: "Scrapes Pixabay Music — picks track by topic/mood",            svc: "jamendo",    fb: "Skipped",            Icon: Music2                   },
  { name: "Pexels Client",   desc: "HD background photos and videos by topic (Basic)",              svc: "pexels",     fb: "Static backgrounds", Icon: Image                    },
  { name: "Branding Agent",  desc: "Ottoflow palette, CTAs and hashtag injection",                  svc: "branding",   fb: null,                 Icon: Tag                      },
  { name: "Render Agent",    desc: "Remotion CLI → MP4 render",                                     svc: "remotion",   fb: null,                 Icon: Clapperboard             },
  { name: "FFmpeg Agent",    desc: "Color grade, loudnorm, music mix, TikTok compress",             svc: "ffmpeg",     fb: "Raw render used",    Icon: Film                     },
  { name: "Telegram Bot",    desc: "Delivers final video with approval buttons",                    svc: "telegram",   fb: null,                 Icon: Send                     },
  { name: "Sheets Client",   desc: "Google Sheets queue: read → process → write back",              svc: "sheets",     fb: null,                 Icon: FileSpreadsheet          },
];

const SVC_LABELS: Record<string, string> = {
  gemini: "Gemini AI", elevenlabs: "ElevenLabs", anthropic: "Claude AI",
  pexels: "Pexels", telegram: "Telegram", sheets: "Sheets",
  n8n: "n8n", ffmpeg: "FFmpeg", remotion: "Remotion",
};

function AgentsView() {
  const [svc, setSvc] = useState<Services | null>(null);
  useEffect(() => { fetch("/api/status").then(r => r.ok ? r.json() : null).then(d => { if (d) setSvc(d); }).catch(() => {}); }, []);

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageTitle title="Agents" sub="All pipeline agents — live connection status" />

      {/* Service status bar */}
      <div className="card" style={{ marginBottom: 24, display: "flex", gap: 0, padding: 0, overflow: "hidden" }}>
        {(Object.keys(SVC_LABELS) as (keyof Services)[]).map((k, i) => (
          <div key={k} style={{ flex: 1, padding: "14px 16px", borderRight: i < Object.keys(SVC_LABELS).length - 1 ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              {SVC_LABELS[k]}
            </div>
            {svc ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: svc[k] ? "var(--green)" : "var(--red)", flexShrink: 0, boxShadow: svc[k] ? "0 0 6px var(--green-glow)" : "none" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: svc[k] ? "var(--green)" : "var(--red)" }}>
                  {svc[k] ? "Live" : "Not set"}
                </span>
              </div>
            ) : (
              <div style={{ height: 18, width: 60 }} className="skeleton" />
            )}
          </div>
        ))}
      </div>

      {/* Agent grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {ALL_AGENTS.map((a) => {
          const on = svc ? svc[a.svc as keyof Services] : null;
          const { Icon } = a;
          return (
            <motion.div
              key={a.name}
              whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
              transition={{ duration: 0.15 }}
              className="card" style={{ padding: 18, cursor: "default" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  background: on === true ? "rgba(99,102,241,0.12)" : on === false ? "rgba(244,63,94,0.08)" : "var(--bg-elevated)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${on === true ? "rgba(99,102,241,0.25)" : "var(--border)"}`,
                }}>
                  <Icon size={18} color={on === true ? "var(--accent)" : on === false ? "var(--text-muted)" : "var(--text-muted)"} strokeWidth={1.8} />
                </div>
                {svc && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: svc[a.svc as keyof Services] ? "rgba(16,185,129,0.1)" : a.fb ? "rgba(245,158,11,0.1)" : "rgba(244,63,94,0.1)", color: svc[a.svc as keyof Services] ? "var(--green)" : a.fb ? "var(--yellow)" : "var(--red)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                    {svc[a.svc as keyof Services] ? "Live" : a.fb ?? "Offline"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{a.name}</span>
                {(a as { v2?: boolean }).v2 && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#a78bfa", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.5px" }}>V2</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.65 }}>{a.desc}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Social View ──────────────────────────────────────────────

function SocialView() {
  const features = ["Caption Generator", "Hashtag AI", "Post Scheduler", "Platform Preview", "Analytics Dashboard"];
  return (
    <div style={{ padding: "28px 32px" }}>
      <PageTitle title="Social Media" sub="AI captions, hashtags, and cross-platform scheduling" />
      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "72px 24px", textAlign: "center" }}>
        <motion.div
          animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 24, background: "var(--primary-light)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Share2 size={32} color="var(--accent)" strokeWidth={1.5} />
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, letterSpacing: -0.4 }}>Coming Soon</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 400, lineHeight: 1.8 }}>
          Auto-generate TikTok, Instagram, and YouTube captions with branded hashtags. Schedule posts across all platforms directly from Ottoflow.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 32, flexWrap: "wrap", justifyContent: "center" }}>
          {features.map(f => (
            <div key={f} style={{ padding: "6px 14px", borderRadius: 20, background: "var(--bg-elevated)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Review View ──────────────────────────────────────────────

interface ReviewCheck { agent: string; rule: string; pass: boolean; detail: string; }
interface ReviewData  { slug: string; checks: ReviewCheck[]; pass: number; total: number; stills: string[]; stillsReady: boolean; error?: string; }

function ReviewCard({ row }: { row: QueueRow }) {
  const slug = slugOf(row.topic);
  const [data,      setData]      = useState<ReviewData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [rendering, setRendering] = useState(false);
  const [fetchErr,  setFetchErr]  = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/review/${slug}`).catch(() => null);
    if (!r)               { setFetchErr("Network error");    setLoading(false); return; }
    if (r.status === 404) { setFetchErr("Not rendered yet"); setLoading(false); return; }
    const d = await r.json();
    setData(d); setFetchErr(null); setLoading(false);
  }, [slug]);

  useEffect(() => { fetchReview(); }, [fetchReview]);

  const runStillCheck = async () => {
    setRendering(true);
    const r = await fetch(`/api/review/${slug}`, { method: "POST" }).catch(() => null);
    if (r?.ok) { const d = await r.json(); setData(d); }
    else        { setFetchErr("Still render failed — check server logs"); }
    setRendering(false);
  };

  const score = data ? data.pass / data.total : 0;
  const scoreColor = !data ? "" : score === 1 ? "var(--green)" : score > 0.7 ? "var(--yellow)" : "var(--red)";
  const scoreBg    = !data ? "" : score === 1 ? "var(--green-light)" : score > 0.7 ? "var(--yellow-light)" : "var(--red-light)";

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.topic}</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>{slug}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {data && <div style={{ padding: "4px 10px", borderRadius: 6, background: scoreBg, color: scoreColor, fontSize: 12, fontWeight: 700 }}>{data.pass}/{data.total}</div>}
          <StatusPill status={row.status} />
        </div>
      </div>

      {loading && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>Checking compliance…</div>}
      {fetchErr && !loading && <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, textAlign: "center", marginBottom: 10 }}>{fetchErr}</div>}

      {data && !loading && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
            {data.checks.map((c, i) => (
              <div key={`check-${i}-${c.rule}`} title={`${c.agent} — ${c.detail}`} style={{ padding: "3px 9px", borderRadius: 20, background: c.pass ? "var(--green-light)" : "var(--red-light)", color: c.pass ? "var(--green)" : "var(--red)", fontSize: 10, fontWeight: 700, cursor: "default", display: "flex", alignItems: "center", gap: 4 }}>
                {c.pass ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                {c.rule.replace(" present","").replace(" applied","").replace(" fetched","").replace(" set","").trim()}
              </div>
            ))}
          </div>
          {data.stillsReady && data.stills.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4, marginBottom: 12 }}>
              {data.stills.map((src, i) => {
                const label = src.split("scene-")[1]?.replace(".jpg","") ?? String(i);
                return (
                  <div key={`still-${i}-${src}`} style={{ position: "relative" }}>
                    <div style={{ aspectRatio: "9/16", borderRadius: 5, overflow: "hidden", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                      <img src={src} alt={`Scene ${label}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                    <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "rgba(255,255,255,0.8)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={runStillCheck} disabled={rendering} className="btn" style={{ width: "100%", justifyContent: "center", background: rendering ? "var(--bg-elevated)" : "var(--primary-light)", color: rendering ? "var(--text-muted)" : "var(--accent)", border: "1px solid var(--border)", cursor: rendering ? "not-allowed" : "pointer" }}>
            {rendering ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Rendering stills…</> : data.stillsReady ? <><RefreshCw size={13} /> Re-render stills</> : <><Play size={13} fill="currentColor" /> Run Still Check</>}
          </button>
        </>
      )}
    </div>
  );
}

function ReviewView() {
  const [rows,    setRows]    = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState(false);
  const [filter,  setFilter]  = useState<"all" | "complete" | "pending">("all");

  useEffect(() => {
    fetch("/api/queue")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setRows(d.rows || []); setLoading(false); })
      .catch(() => { setFetchErr(true); setLoading(false); });
  }, []);

  const displayed = rows.filter(row => {
    if (filter === "complete") return ["Done","Complete"].includes(row.status);
    if (filter === "pending")  return row.status === "Pending";
    return true;
  });

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageTitle title="Quality Review" sub="Agent compliance checks + scene stills for every video" />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        {(["all","complete","pending"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid var(--border)", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", background: filter === f ? "var(--primary)" : "transparent", color: filter === f ? "#fff" : "var(--text-muted)", transition: "all 0.12s" }}>
            {f === "all" ? "All" : f === "complete" ? "Complete" : "Pending"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{rows.length} items · hover badges for details</span>
      </div>
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      ) : fetchErr ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--error, #ef4444)", fontSize: 13 }}>
          <Star size={32} style={{ opacity: 0.15, display: "block", margin: "0 auto 10px" }} />
          Could not load queue — check your database connection.
        </div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: 13 }}>
          <Star size={32} style={{ opacity: 0.15, display: "block", margin: "0 auto 10px" }} />
          No items to review.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {displayed.map(row => <ReviewCard key={row.rowIndex} row={row} />)}
        </div>
      )}
    </div>
  );
}

// ─── Own Topic ────────────────────────────────────────────────

const MUSIC_VIBES = ["Auto", "Energetic", "Chill", "Cinematic", "Motivational", "Corporate"];

const OWN_TOPIC_TEMPLATES = [
  { id: "listicle",    label: "Top N List",   Icon: List,         desc: "Numbered tips & rankings — highest shareability" },
  { id: "stats-story", label: "Stats Story",  Icon: TrendingUp,   desc: "Bold data-driven narrative with big numbers" },
  { id: "tutorial",    label: "Tutorial",     Icon: Layers,       desc: "Step-by-step how-to — great for education" },
  { id: "myth-buster", label: "Myth Buster",  Icon: XCircle,      desc: "Fact vs fiction — debunk and educate" },
  { id: "quote-card",  label: "Quote Card",   Icon: Star,         desc: "Viral quote with branded full-screen visual" },
  { id: "cinematic",   label: "Cinematic",    Icon: Clapperboard, desc: "Premium branded cinematic look" },
];

const OWN_TOPIC_STYLES = ["Educational", "Motivational", "Case Study", "Lifestyle", "Startup-focused", "Luxury", "Neon"];
const OWN_TOPIC_VOICES = ["Female energetic", "Female calm", "Male energetic", "Male calm"];

interface TopicSuggestion { topic: string; style: string; angle: string; hookPreview: string; }
type TopicTab = "single" | "batch" | "ai";

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: "7px 18px", borderRadius: 20, border: `1px solid ${active ? "rgba(99,102,241,0.5)" : "var(--border)"}`,
  cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
  background: active ? "rgba(99,102,241,0.12)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-muted)", transition: "all 0.12s",
});

const stylePillStyle = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px", borderRadius: 20, border: "1px solid var(--border)",
  cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
  background: active ? "var(--primary)" : "transparent",
  color: active ? "#fff" : "var(--text-muted)", transition: "all 0.12s",
});

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: "100%", padding: "13px 24px", borderRadius: 11, border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  background: disabled ? "var(--bg-elevated)" : "linear-gradient(135deg,#6366f1 0%,#a78bfa 100%)",
  color: disabled ? "var(--text-muted)" : "#fff",
  fontFamily: "inherit", fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  boxShadow: disabled ? "none" : "0 4px 20px rgba(99,102,241,0.4)", transition: "all 0.2s",
});

function OwnTopicView({ onGenerate, tier = "basic" }: { onGenerate: () => void; tier?: Tier }) {
  const [activeTab, setActiveTab] = useState<TopicTab>("single");

  // Single tab
  const [topic,      setTopic]      = useState("");
  const [style,      setStyle]      = useState("Educational");
  const [template,   setTemplate]   = useState("listicle");
  const [generating, setGenerating] = useState(false);
  const [musicVibe,   setMusicVibe]   = useState("Auto");
  const [scheduledAt, setScheduledAt] = useState("");   // ISO datetime-local string

  // Batch tab
  const [batchText,    setBatchText]    = useState("");
  const [batchStyle,   setBatchStyle]   = useState("Educational");
  const [batchVoice,   setBatchVoice]   = useState("Female energetic");
  const [batchVibe,    setBatchVibe]    = useState("Auto");
  const [batchLoading, setBatchLoading] = useState(false);

  // AI tab
  const [niche,            setNiche]            = useState("");
  const [aiCount,          setAiCount]          = useState(15);
  const [aiLoading,        setAiLoading]        = useState(false);
  const [suggestions,      setSuggestions]      = useState<TopicSuggestion[]>([]);
  const [selected,         setSelected]         = useState<Set<number>>(new Set());
  const [variantOverrides, setVariantOverrides] = useState<Record<number, string>>({});
  const [aiVibe,           setAiVibe]           = useState("Auto");
  const [queuing,          setQueuing]          = useState(false);

  // Restore niche from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ottoflow-niche") : null;
    if (saved) setNiche(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined" && niche) localStorage.setItem("ottoflow-niche", niche);
  }, [niche]);

  const handleSingle = async () => {
    const t = topic.trim();
    if (!t) { toast.error("Enter a topic first"); return; }
    setGenerating(true);
    try {
      const vibeParam  = musicVibe !== "Auto" ? musicVibe : undefined;
      const schedParam = scheduledAt ? new Date(scheduledAt).getTime() : undefined;
      const schedLabel = scheduledAt ? ` at ${new Date(scheduledAt).toLocaleString()}` : "";
      if (tier === "advanced") {
        const res = await fetch("/api/topics", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: [t], style, version: "v2", autoQueue: true, musicVibe: vibeParam, scheduledAt: schedParam }),
        });
        if (!res.ok) throw new Error("Failed to queue V2 topic");
        toast.success(`Queued V2: "${t}"${schedLabel} — watch progress in Command Center`);
      } else {
        const addRes = await fetch("/api/queue/add", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: t, style }),
        });
        if (!addRes.ok) throw new Error("Failed to add topic to sheet");
        const { rowIndex } = await addRes.json();
        const renderRes = await fetch("/api/pipeline", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIndex, template, musicVibe: vibeParam, scheduledAt: schedParam }),
        });
        if (!renderRes.ok) throw new Error("Failed to queue render job");
        toast.success(`Queued: "${t}" — watch progress in Command Center`);
      }
      setTopic(""); onGenerate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const handleBatch = async () => {
    const rawLines = batchText.split("\n").map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) { toast.error("Enter at least one topic"); return; }
    const lines = [...new Set(rawLines)];
    const dupeCount = rawLines.length - lines.length;
    if (dupeCount > 0) toast.info(`${dupeCount} duplicate(s) removed`);
    setBatchLoading(true);
    const vibeParam = batchVibe !== "Auto" ? batchVibe : undefined;
    try {
      const res = await fetch("/api/topics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: lines, style: batchStyle, voice: batchVoice, autoQueue: true, version: tier === "advanced" ? "v2" : "v1", musicVibe: vibeParam }),
      });
      if (!res.ok) throw new Error("Failed to queue topics");
      const data = await res.json();
      toast.success(`Queued ${data.queued} topic(s) — watch in Command Center`);
      setBatchText("");
      onGenerate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!niche.trim()) { toast.error("Enter a niche first"); return; }
    setAiLoading(true); setSuggestions([]); setSelected(new Set());
    try {
      const res = await fetch("/api/topics/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: niche.trim(), count: aiCount }),
      });
      if (!res.ok) throw new Error("Failed to generate topics");
      const data = await res.json();
      const list: TopicSuggestion[] = data.suggestions || [];
      setSuggestions(list);
      setSelected(new Set(list.map((_, i) => i)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  };

  const handleQueueSelected = async () => {
    const picks = [...selected].map(i => ({ idx: i, s: suggestions[i] })).filter(x => x.s);
    if (picks.length === 0) { toast.error("Select at least one topic"); return; }
    setQueuing(true);
    const vibeParam = aiVibe !== "Auto" ? aiVibe : undefined;
    const hasOverrides = picks.some(({ idx }) => variantOverrides[idx]);
    try {
      if (hasOverrides) {
        // Send individually so each can carry its own renderVariant
        let queued = 0;
        for (const { idx, s } of picks) {
          const rv = variantOverrides[idx] || undefined;
          const res = await fetch("/api/topics", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topics: [s.topic], style: s.style || "Educational", autoQueue: true, version: tier === "advanced" ? "v2" : "v1", musicVibe: vibeParam, renderVariant: rv }),
          });
          if (res.ok) { const d = await res.json(); queued += d.queued ?? 0; }
        }
        toast.success(`Queued ${queued} topic(s) — watch in Command Center`);
      } else {
        const res = await fetch("/api/topics", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: picks.map(({ s }) => s.topic), style: picks[0]?.s.style || "Educational", autoQueue: true, version: tier === "advanced" ? "v2" : "v1", musicVibe: vibeParam }),
        });
        if (!res.ok) throw new Error("Failed to queue topics");
        const data = await res.json();
        toast.success(`Queued ${data.queued} topic(s) — watch in Command Center`);
      }
      setSuggestions([]); setSelected(new Set()); setVariantOverrides({});
      onGenerate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setQueuing(false);
    }
  };

  const toggleAll = () => {
    if (selected.size === suggestions.length) setSelected(new Set());
    else setSelected(new Set(suggestions.map((_, i) => i)));
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%", resize: "vertical", background: "var(--bg-elevated)",
    border: "1px solid var(--border)", borderRadius: 9, color: "var(--text)",
    fontFamily: "inherit", fontSize: 13, padding: "11px 14px", outline: "none",
    transition: "border-color 0.15s", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(99,102,241,0.4)" }}>
          <PenLine size={18} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", lineHeight: 1 }}>Topics</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Add topics manually, in batch, or let AI generate angles from a niche</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={tabBtnStyle(activeTab === "single")} onClick={() => setActiveTab("single")}>Single Topic</button>
        <button style={tabBtnStyle(activeTab === "batch")}  onClick={() => setActiveTab("batch")}>Add Batch</button>
        <button style={tabBtnStyle(activeTab === "ai")}     onClick={() => setActiveTab("ai")}>AI Generate</button>
      </div>

      {/* ── Single Topic ── */}
      {activeTab === "single" && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Topic / Prompt</label>
            <textarea
              value={topic} onChange={e => setTopic(e.target.value)} rows={3}
              placeholder="e.g. The OODA Loop — how to make faster decisions than your competitors"
              style={textareaStyle}
              onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
              onBlur={e  => (e.target.style.borderColor = "var(--border)")}
            />
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Style</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {OWN_TOPIC_STYLES.map(s => <button key={s} onClick={() => setStyle(s)} style={stylePillStyle(style === s)}>{s}</button>)}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Music Vibe</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {MUSIC_VIBES.map(v => <button key={v} onClick={() => setMusicVibe(v)} style={stylePillStyle(musicVibe === v)}>{v}</button>)}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                Schedule <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— leave empty to run immediately</span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: 12, fontFamily: "inherit", colorScheme: "dark" }}
                />
                {scheduledAt && (
                  <button onClick={() => setScheduledAt("")} style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8, padding: "7px 12px", color: "#f43f5e", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Clear
                  </button>
                )}
              </div>
              {scheduledAt && (
                <div style={{ marginTop: 5, fontSize: 11, color: "#f59e0b" }}>
                  Renders at {new Date(scheduledAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {tier === "advanced" ? (
            <div className="card" style={{ padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Video size={16} color="#fff" strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>⚡ Advanced Pipeline — Veo 3.1 Lite + ElevenLabs</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>AI-generated video clips. Template is auto-selected (v2-ugc). Script and scene prompts via Gemini.</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>Template</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {OWN_TOPIC_TEMPLATES.map(({ id, label, Icon, desc }) => {
                  const sel = template === id;
                  return (
                    <motion.button key={id} onClick={() => setTemplate(id)} whileHover={{ y: -2 }} transition={{ duration: 0.12 }}
                      style={{ background: sel ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)", border: `1px solid ${sel ? "rgba(99,102,241,0.45)" : "var(--border)"}`, borderRadius: 11, padding: "14px 14px 12px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxShadow: sel ? "0 0 0 1px rgba(99,102,241,0.2), 0 4px 16px rgba(99,102,241,0.15)" : "none", transition: "border-color 0.15s, background 0.15s" }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "linear-gradient(135deg,#6366f1,#a78bfa)" : "var(--bg)", border: `1px solid ${sel ? "transparent" : "var(--border)"}`, transition: "all 0.15s" }}>
                        <Icon size={15} color={sel ? "#fff" : "var(--text-muted)"} strokeWidth={sel ? 2.5 : 1.8} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: sel ? "var(--accent)" : "var(--text)", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.55 }}>{desc}</div>
                      {sel && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={10} color="var(--accent)" /><span style={{ fontSize: 9, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.4px" }}>SELECTED</span></div>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={handleSingle} disabled={generating || !topic.trim()} style={primaryBtn(generating || !topic.trim())}>
            {generating ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Adding to queue…</> : <><Play size={14} fill="currentColor" /> Generate Video</>}
          </button>
          <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.7 }}>
            Each render uses a random narrative variant and hook style for non-redundant output.
          </p>
        </>
      )}

      {/* ── Batch Add ── */}
      {activeTab === "batch" && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
              Topics <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>— one per line</span>
            </label>
            <textarea
              value={batchText} onChange={e => setBatchText(e.target.value)} rows={8}
              placeholder={"Why Six Sigma fails in week 1\nThe automation tool that replaced my $5k/month VA\nHow OKRs actually work in 2026"}
              style={textareaStyle}
              onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
              onBlur={e  => (e.target.style.borderColor = "var(--border)")}
            />
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
              {batchText.split("\n").map(l => l.trim()).filter(Boolean).length} topic(s) ready
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Style</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {OWN_TOPIC_STYLES.map(s => <button key={s} onClick={() => setBatchStyle(s)} style={stylePillStyle(batchStyle === s)}>{s}</button>)}
                </div>
              </div>
              <div style={{ minWidth: 180 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Voice</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {OWN_TOPIC_VOICES.map(v => <button key={v} onClick={() => setBatchVoice(v)} style={stylePillStyle(batchVoice === v)}>{v}</button>)}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Music Vibe</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {MUSIC_VIBES.map(v => <button key={v} onClick={() => setBatchVibe(v)} style={stylePillStyle(batchVibe === v)}>{v}</button>)}
              </div>
            </div>
          </div>

          <button onClick={handleBatch} disabled={batchLoading || !batchText.trim()} style={primaryBtn(batchLoading || !batchText.trim())}>
            {batchLoading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Queuing…</> : <><Play size={14} fill="currentColor" /> Add &amp; Queue All</>}
          </button>
          <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.7 }}>
            Each topic gets a unique template, narrative variant, and hook style — no repeated output.
          </p>
        </>
      )}

      {/* ── AI Generate ── */}
      {activeTab === "ai" && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>Niche</label>
            <input
              type="text" value={niche} onChange={e => setNiche(e.target.value)}
              placeholder="e.g. AI automation for small businesses"
              onKeyDown={e => e.key === "Enter" && handleAiGenerate()}
              style={{ ...textareaStyle, height: 42, resize: undefined }}
              onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
              onBlur={e  => (e.target.style.borderColor = "var(--border)")}
            />
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Count</label>
              {[10, 15, 20].map(n => (
                <button key={n} onClick={() => setAiCount(n)} style={{ ...stylePillStyle(aiCount === n), padding: "4px 12px" }}>{n}</button>
              ))}
            </div>
          </div>

          <button onClick={handleAiGenerate} disabled={aiLoading || !niche.trim()} style={{ ...primaryBtn(aiLoading || !niche.trim()), marginBottom: 20 }}>
            {aiLoading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating ideas…</> : <><Wand2 size={14} /> Generate Ideas</>}
          </button>

          {suggestions.length > 0 && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Music Vibe</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {MUSIC_VIBES.map(v => <button key={v} onClick={() => setAiVibe(v)} style={stylePillStyle(aiVibe === v)}>{v}</button>)}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{suggestions.length} suggestions</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={toggleAll} style={{ ...tabBtnStyle(false), fontSize: 11, padding: "5px 12px" }}>
                    {selected.size === suggestions.length ? "Deselect all" : "Select all"}
                  </button>
                  <button onClick={handleQueueSelected} disabled={queuing || selected.size === 0} style={{ ...primaryBtn(queuing || selected.size === 0), width: "auto", padding: "7px 18px", fontSize: 12 }}>
                    {queuing ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Queuing…</> : <><Play size={12} fill="currentColor" /> Queue Selected ({selected.size})</>}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {suggestions.map((s, i) => {
                  const isSelected = selected.has(i);
                  return (
                    <motion.div key={i} whileHover={{ x: 2 }} transition={{ duration: 0.1 }}
                      onClick={() => setSelected(prev => { const n = new Set(prev); isSelected ? n.delete(i) : n.add(i); return n; })}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${isSelected ? "rgba(99,102,241,0.4)" : "var(--border)"}`, background: isSelected ? "rgba(99,102,241,0.06)" : "var(--bg-elevated)", transition: "all 0.12s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`, background: isSelected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.12s" }}>
                        {isSelected && <CheckCircle2 size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3, lineHeight: 1.4 }}>{s.topic}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{s.hookPreview}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>{s.style}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>{s.angle}</span>
                        </div>
                        <select
                          value={variantOverrides[i] ?? ""}
                          onChange={e => setVariantOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                          style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 6px", cursor: "pointer", outline: "none" }}
                        >
                          <option value="">Story arc: Random</option>
                          <option value="problem-first">Problem-first</option>
                          <option value="stat-first">Stat-first</option>
                          <option value="story-arc">Story arc</option>
                          <option value="myth-bust">Myth-bust</option>
                        </select>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Advanced App ─────────────────────────────────────────────

const APP_NAV: { id: AppView; label: string; Icon: React.ElementType; desc: string }[] = [
  { id: "mission",    label: "Mission Control",   Icon: Gauge,        desc: "Active renders & system status" },
  { id: "storyboard", label: "Storyboard Studio", Icon: PenLine,      desc: "Create & queue content" },
  { id: "pipeline",   label: "Render Pipeline",   Icon: Film,         desc: "Run history, stages & logs" },
  { id: "approvals",  label: "Approvals",         Icon: CheckCircle2, desc: "Review completed renders" },
  { id: "identity",   label: "Creative Identity", Icon: Wand2,        desc: "Voice, style & persona defaults" },
  { id: "health",     label: "System Health",     Icon: Server,       desc: "Workers, costs & infrastructure" },
];

function StatCard({ label, value, sub, color = "#6366f1", icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ElementType;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.055)",
      borderRadius: 12, padding: "16px 20px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, ${color}, ${color}55)`,
        borderRadius: "12px 0 0 12px",
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9, paddingLeft: 7 }}>
        {Icon && <Icon size={10} color="rgba(255,255,255,0.22)" strokeWidth={2} />}
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.9px" }}>{label}</span>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 800, color, lineHeight: 1,
        letterSpacing: -1, fontVariantNumeric: "tabular-nums", paddingLeft: 7,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 5, paddingLeft: 7 }}>{sub}</div>}
    </div>
  );
}

function StageDots({ stages, stageStatuses, compact = true }: {
  stages?: PipelineStage[];
  stageStatuses?: Record<string, string>;
  compact?: boolean;
}) {
  const items = ADVANCED_STAGES.map(s => {
    const dbStage    = stages?.find(d => d.stage_name === s.id);
    const liveStatus = stageStatuses?.[s.id];
    const status     = liveStatus ?? dbStage?.status ?? "pending";
    return { ...s, status, dbStage };
  });

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {items.map(item => (
          <div
            key={item.id}
            title={`${item.label}: ${item.status}`}
            style={{
              width: 5, height: 14, borderRadius: 2, flexShrink: 0,
              background: getStageColor(item.status),
              boxShadow: item.status === "running" ? `0 0 7px ${getStageColor(item.status)}` : "none",
              animation: item.status === "running" ? "pulse 1.5s infinite" : "none",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", minWidth: "max-content" }}>
        {items.map((item, i) => {
          const { Icon } = item;
          const isActive = item.status === "running";
          const isDone   = item.status === "done" || item.status === "skipped";
          const isFailed = item.status === "failed";
          const dur      = item.dbStage?.duration_s;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 52 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", position: "relative", flexShrink: 0,
                  background: isActive ? "linear-gradient(135deg,#6366f1,#a78bfa)" : isFailed ? "rgba(244,63,94,0.12)" : isDone ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isActive ? "#6366f1" : isFailed ? "rgba(244,63,94,0.3)" : isDone ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isFailed
                    ? <XCircle size={13} color="#f43f5e" />
                    : isDone
                      ? <CheckCircle2 size={13} color="#10b981" />
                      : <Icon size={13} color={isActive ? "#fff" : "rgba(255,255,255,0.3)"} strokeWidth={isActive ? 2.5 : 1.8} />
                  }
                  {isActive && (
                    <motion.span
                      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "2px solid rgba(99,102,241,0.45)" }}
                    />
                  )}
                </div>
                <span style={{ fontSize: 8, textAlign: "center", whiteSpace: "nowrap", fontWeight: isActive || isDone ? 700 : 500, color: isActive ? "#a78bfa" : isFailed ? "#f43f5e" : isDone ? "#10b981" : "rgba(255,255,255,0.2)" }}>
                  {item.label}
                </span>
                {dur != null && (
                  <span style={{ fontSize: 7, color: "rgba(255,255,255,0.18)", fontFamily: "monospace", marginTop: -2 }}>
                    {fmtDuration(dur)}
                  </span>
                )}
              </div>
              {i < items.length - 1 && (
                <div style={{ width: 8, height: 1.5, marginTop: 14, flexShrink: 0, background: isDone ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PipelineRow({ pipeline, isExpanded, onToggle, liveStageStatuses, onRefresh }: {
  pipeline: Pipeline;
  isExpanded: boolean;
  onToggle: () => void;
  liveStageStatuses?: Record<string, string>;
  onRefresh?: () => void;
}) {
  const [actioning, setActioning] = useState(false);
  const stColor = pipelineStatusColor(pipeline.status);
  const stageStatuses = pipeline.status === "running" ? liveStageStatuses : undefined;
  const canCancel = pipeline.status === "queued" || pipeline.status === "running" || pipeline.status === "pending";
  const canRetry  = ["failed", "cancelled", "timed_out", "dead"].includes(pipeline.status);

  async function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Cancel pipeline: ${pipeline.topic.slice(0, 60)}?`)) return;
    setActioning(true);
    try {
      const res = await fetch(`/api/advanced/pipeline/${pipeline.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) toast.error(data.error ?? "Cancel failed");
      else { toast.success(data.message ?? "Cancelled"); onRefresh?.(); }
    } catch { toast.error("Network error"); }
    finally { setActioning(false); }
  }

  async function handleRetry(e: React.MouseEvent) {
    e.stopPropagation();
    setActioning(true);
    try {
      const res = await fetch(`/api/advanced/pipeline/${pipeline.id}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) toast.error(data.error ?? "Retry failed");
      else { toast.success(`Re-queued (#${data.retryCount})`); onRefresh?.(); }
    } catch { toast.error("Network error"); }
    finally { setActioning(false); }
  }

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", position: "relative" }}>
      {/* Left status accent */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: stColor, opacity: 0.65, borderRadius: "0 0 0 0" }} />

      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: "13px 16px 13px 20px",
          cursor: "pointer", transition: "background 0.12s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.018)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* Topic + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
            {displayTopic(pipeline.topic)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${stColor}18`, color: stColor, border: `1px solid ${stColor}35`, textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0 }}>
              {pipeline.status}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{pipeline.style}</span>
            {pipeline.render_variant && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· {pipeline.render_variant}</span>}
            {pipeline.current_stage && pipeline.status === "running" && <span style={{ fontSize: 10, color: "#a78bfa" }}>· {pipeline.current_stage}</span>}
            {pipeline.retry_count > 0 && <span style={{ fontSize: 10, color: "#f59e0b" }}>· retry #{pipeline.retry_count}</span>}
          </div>
        </div>

        {/* Stage dots */}
        <StageDots stages={pipeline.stages} stageStatuses={stageStatuses} compact />

        {/* Tier badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
          background: pipeline.tier === "advanced" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
          color: pipeline.tier === "advanced" ? "#a78bfa" : "var(--text-muted)",
          border: `1px solid ${pipeline.tier === "advanced" ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)"}`,
          textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0,
        }}>
          {pipeline.tier}
        </span>

        {/* Duration + time */}
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right", flexShrink: 0, minWidth: 70, fontFamily: "monospace" }}>
          <div>{fmtDuration(pipeline.duration_s)}</div>
          <div>{fmtAgo(pipeline.queued_at)}</div>
        </div>

        {/* Progress if running */}
        {pipeline.status === "running" && (
          <div style={{ width: 48, flexShrink: 0 }}>
            <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pipeline.progress_pct}%`, background: "linear-gradient(90deg,#6366f1,#22d3ee)", borderRadius: 3, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "right", marginTop: 2 }}>{pipeline.progress_pct}%</div>
          </div>
        )}

        {/* Action buttons — cancel or retry */}
        {(canCancel || canRetry) && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={actioning}
                title="Cancel pipeline"
                style={{ padding: "3px 7px", borderRadius: 5, border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.08)", color: "#f43f5e", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
              >
                <X size={9} strokeWidth={2.5} />{actioning ? "…" : "Stop"}
              </button>
            )}
            {canRetry && (
              <button
                onClick={handleRetry}
                disabled={actioning}
                title="Retry from beginning"
                style={{ padding: "3px 7px", borderRadius: 5, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
              >
                <RefreshCw size={9} strokeWidth={2.5} />{actioning ? "…" : "Retry"}
              </button>
            )}
          </div>
        )}

        {/* Chevron */}
        {isExpanded ? <ChevronUp size={13} color="var(--text-muted)" strokeWidth={2} /> : <ChevronDown size={13} color="var(--text-muted)" strokeWidth={2} />}
      </div>

      {/* Expanded stage detail */}
      {isExpanded && (
        <div style={{ padding: "4px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {pipeline.error && (
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", fontSize: 11, color: "#f43f5e", marginBottom: 12, fontFamily: "monospace" }}>
              {pipeline.error}
            </div>
          )}
          <StageDots stages={pipeline.stages} stageStatuses={stageStatuses} compact={false} />
          {pipeline.stages.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 3 }}>
              {pipeline.stages.filter(s => s.status !== "pending").map(stage => (
                <div key={stage.stage_name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "var(--text-muted)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: getStageColor(stage.status), flexShrink: 0 }} />
                  <span style={{ minWidth: 160, fontFamily: "monospace", color: "var(--text-secondary)" }}>{stage.stage_name}</span>
                  <span style={{ color: getStageColor(stage.status), fontWeight: 700, minWidth: 55 }}>{stage.status}</span>
                  <span style={{ fontFamily: "monospace" }}>{fmtDuration(stage.duration_s)}</span>
                  {stage.error && <span style={{ color: "#f43f5e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stage.error}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Per-stage retry picker */}
          {canRetry && pipeline.stages.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Retry from stage</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {pipeline.stages.map(s => (
                  <button
                    key={s.stage_name}
                    disabled={actioning}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setActioning(true);
                      try {
                        const res = await fetch(`/api/advanced/pipeline/${pipeline.id}/retry`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ fromStage: s.stage_name }),
                        });
                        const data = await res.json();
                        if (!res.ok) toast.error(data.error ?? "Retry failed");
                        else { toast.success(`Retry from ${s.stage_name} (#${data.retryCount})`); onRefresh?.(); }
                      } catch { toast.error("Network error"); }
                      finally { setActioning(false); }
                    }}
                    style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 9, fontFamily: "monospace",
                      border: `1px solid ${getStageColor(s.status)}44`,
                      background: `${getStageColor(s.status)}11`,
                      color: getStageColor(s.status), cursor: "pointer", fontWeight: 600,
                    }}
                  >
                    {s.stage_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  const isOnline   = worker.status === "online";
  const isDraining = worker.status === "draining";
  const statusColor = isOnline ? "#10b981" : isDraining ? "#f59e0b" : "rgba(255,255,255,0.15)";

  const rss = worker.memory_rss_mb;
  const memPct   = rss != null ? Math.min(rss / 12, 100) : 0;
  const memColor = rss == null ? "rgba(255,255,255,0.25)"
    : rss > 900 ? "#f43f5e"
    : rss > 600 ? "#f59e0b"
    : "#10b981";

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${isOnline ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Status top bar */}
      <div style={{ height: 2, background: statusColor, opacity: isOnline ? 1 : 0.4 }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: isOnline ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${isOnline ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.07)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Server size={14} color={isOnline ? "#10b981" : "rgba(255,255,255,0.2)"} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {worker.hostname || worker.id.slice(0, 12)}
            </div>
            <div style={{ fontSize: 9, color: statusColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginTop: 2 }}>
              {worker.status} · {worker.tier} · v{worker.version}
            </div>
          </div>
        </div>

        {/* 3-col stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {([
            { label: "Uptime",    value: fmtDuration(worker.uptime_s),          color: "var(--text-secondary)" },
            { label: "Heartbeat", value: `${worker.heartbeat_age_s}s`,           color: worker.heartbeat_age_s > 30 ? "#f59e0b" : "var(--text-secondary)" },
            { label: "Renders",   value: String(worker.renders_this_session ?? 0), color: "var(--text-secondary)" },
          ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Memory gauge */}
        {rss != null && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Memory RSS
              </span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: memColor, fontWeight: 700 }}>{rss} MB · {Math.round(memPct)}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${memPct}%`,
                background: rss > 900 ? "#f43f5e" : rss > 600 ? "#f59e0b" : "linear-gradient(90deg,#10b981,#22d3ee)",
                borderRadius: 4, transition: "width 1s",
              }} />
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.18)", marginTop: 3 }}>
              heap {worker.memory_heap_mb ?? "—"} MB · ceiling ~1200 MB
            </div>
          </div>
        )}

        {/* Current job */}
        {worker.pipeline_topic && (
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.13)" }}>
            <div style={{ fontSize: 8, color: "#a78bfa", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 3 }}>Current Job</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayTopic(worker.pipeline_topic)}
            </div>
            {worker.current_stage && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, fontFamily: "monospace" }}>{worker.current_stage}</div>
            )}
            {worker.pipeline_progress !== null && (
              <div style={{ marginTop: 7, height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${worker.pipeline_progress}%`, background: "linear-gradient(90deg,#6366f1,#22d3ee)", transition: "width 0.5s" }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedApp() {
  const [section,           setSection]           = useState<AppView>("mission");
  const [pipeTab,           setPipeTab]           = useState<"runs" | "logs">("runs");
  const [healthTab,         setHealthTab]         = useState<"workers" | "costs">("workers");
  const [pipelines,         setPipelines]         = useState<Pipeline[]>([]);
  const [workers,           setWorkers]           = useState<Worker[]>([]);
  const [queueStats,        setQueueStats]        = useState<QueueStats | null>(null);
  const [aiCosts,           setAiCosts]           = useState<AICosts | null>(null);
  const [queue,             setQueue]             = useState<QueueRow[]>([]);
  const [activePipelineId,  setActivePipelineId]  = useState<string | null>(null);
  const [stageStatuses,     setStageStatuses]     = useState<Record<string, string>>({});
  const [logs,              setLogs]              = useState<LogEntry[]>([]);
  const [pipeStatus,        setPipeStatus]        = useState<Status>("idle");
  const [workerOnline,      setWorkerOnline]      = useState<boolean | null>(null);
  const [logSearch,         setLogSearch]         = useState("");
  const [logLevel,          setLogLevel]          = useState("all");
  const [pipeFilter,        setPipeFilter]        = useState("all");
  const [expandedPipeline,  setExpandedPipeline]  = useState<string | null>(null);
  const [health,            setHealth]            = useState<{ db: boolean; redis: boolean; env: boolean } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Global SSE — reconnects when activePipelineId changes
  useEffect(() => {
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const applyEvent = (ev: Record<string, unknown>) => {
      const type      = ev.type      as string;
      const stageName = ev.stageName as string | undefined;
      const progress  = ev.progress  as number | undefined;
      const message   = ev.message   as string | undefined;

      if (type === "stage_started" && stageName) {
        setStageStatuses(p => ({ ...p, [stageName]: "running" }));
        setPipeStatus("running");
      } else if (type === "stage_done" && stageName) {
        setStageStatuses(p => ({ ...p, [stageName]: "done" }));
        if (progress !== undefined) {/* pipeline list refresh covers this */ }
      } else if (type === "stage_failed" && stageName) {
        setStageStatuses(p => ({ ...p, [stageName]: "failed" }));
      } else if (type === "stage_skipped" && stageName) {
        setStageStatuses(p => ({ ...p, [stageName]: "skipped" }));
      } else if (type === "log" && message) {
        setLogs(p => [...p.slice(-699), { id: Date.now(), ts: new Date().toISOString(), agent: stageName ?? "pipeline", message, level: (ev.level as string) ?? "agent" }]);
      } else if (type === "pipeline_started") {
        setPipeStatus("running");
        toast.loading("Pipeline running…", { id: "adv-pipe" });
      } else if (type === "pipeline_done") {
        setPipeStatus("done");
        toast.dismiss("adv-pipe"); toast.success("Pipeline complete!");
      } else if (type === "pipeline_failed") {
        setPipeStatus("error");
        toast.dismiss("adv-pipe"); toast.error("Pipeline failed");
      } else if (type === "workers_snapshot" && Array.isArray(ev.workers)) {
        const ws = ev.workers as Worker[];
        setWorkers(ws);
        setWorkerOnline(ws.some(w => w.status === "online"));
      }
    };

    const connect = () => {
      const params = new URLSearchParams({ workers: "1" });
      if (activePipelineId) params.set("p", activePipelineId);
      es = new EventSource(`/api/advanced/events?${params}`);
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as Record<string, unknown>;
          if (msg.type === "snapshot" && Array.isArray(msg.pipelines)) {
            const pipe = (msg.pipelines as { id: string; status: string; progress_pct?: number }[]).find(p => p.id === activePipelineId);
            if (pipe) {
              if (pipe.status === "running") setPipeStatus("running");
              else if (pipe.status === "done") setPipeStatus("done");
              else if (pipe.status === "failed") setPipeStatus("error");
            }
          } else if (msg.type === "event_replay" && Array.isArray(msg.events)) {
            setStageStatuses({});
            (msg.events as Record<string, unknown>[]).forEach(applyEvent);
          } else {
            applyEvent(msg);
          }
        } catch { /* malformed */ }
      };
      es.onerror = () => { es.close(); reconnectTimer = setTimeout(connect, 3_000); };
    };

    connect();
    return () => { es?.close(); clearTimeout(reconnectTimer); };
  }, [activePipelineId]);

  // Fetch pipelines (10s)
  const fetchPipelines = useCallback(async () => {
    const statusParam = pipeFilter !== "all" ? `&status=${pipeFilter}` : "";
    const r = await fetch(`/api/advanced/pipelines?limit=25${statusParam}`).catch(() => null);
    if (r?.ok) { const d = await r.json(); setPipelines(d.pipelines || []); }
  }, [pipeFilter]);
  useEffect(() => { fetchPipelines(); const t = setInterval(fetchPipelines, 10_000); return () => clearInterval(t); }, [fetchPipelines]);

  // Fetch queue-stats (10s)
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/advanced/queue-stats").catch(() => null);
      if (r?.ok) { const d = await r.json(); setQueueStats(d); }
    };
    load(); const t = setInterval(load, 10_000); return () => clearInterval(t);
  }, []);

  // Fetch AI costs (60s)
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/ai-costs").catch(() => null);
      if (r?.ok) { const d = await r.json(); setAiCosts(d); }
    };
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t);
  }, []);

  // Fetch sheet queue (8s)
  const fetchQueue = useCallback(async () => {
    const r = await fetch("/api/queue").catch(() => null);
    if (r?.ok) { const d = await r.json(); setQueue(d.rows || []); }
  }, []);
  useEffect(() => { fetchQueue(); const t = setInterval(fetchQueue, 8_000); return () => clearInterval(t); }, [fetchQueue]);

  // Fetch workers (8s)
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/advanced/workers").catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setWorkers(d.workers || []);
        setWorkerOnline((d.workers as Worker[])?.some(w => w.status === "online") ?? null);
      }
    };
    load(); const t = setInterval(load, 8_000); return () => clearInterval(t);
  }, []);

  // Scroll logs to bottom
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // Health check (60s)
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/advanced/health").catch(() => null);
      if (r) {
        const d = await r.json().catch(() => null);
        if (d?.checks) {
          setHealth({
            db:    d.checks.db?.ok    === true,
            redis: d.checks.redis?.ok === true,
            env:   d.checks.env?.ok   === true,
          });
        }
      }
    };
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t);
  }, []);

  const renderRow = async (row: QueueRow) => {
    const tid = `adv-${row.rowIndex}`;
    toast.loading(`Queuing: ${displayTopic(row.topic)}`, { id: tid });
    const res = await fetch("/api/advanced/pipeline", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: row.topic, style: row.style, rowIndex: row.rowIndex }),
    }).catch(() => null);
    if (res?.ok) {
      const d = await res.json() as { pipelineId: string };
      setActivePipelineId(d.pipelineId);
      setStageStatuses({});
      toast.success(`Queued: ${displayTopic(row.topic)}`, { id: tid });
      fetchPipelines();
    } else {
      toast.error(`Failed: ${displayTopic(row.topic)}`, { id: tid });
    }
  };

  const runQueue = async () => {
    const pending = queue.filter(r => ["Pending", "Queued"].includes(r.status));
    if (pending.length === 0) { toast.error("No pending rows in queue"); return; }
    let first: string | null = null;
    for (const row of pending) {
      const res = await fetch("/api/advanced/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: row.topic, style: row.style, rowIndex: row.rowIndex }),
      }).catch(() => null);
      if (res?.ok) {
        const d = await res.json() as { pipelineId: string };
        if (!first) { first = d.pipelineId; setActivePipelineId(d.pipelineId); setStageStatuses({}); }
      }
    }
    if (first) { toast.success(`${pending.length} job(s) queued`); fetchPipelines(); }
  };

  // ── Computed stats ──
  const dbStats  = queueStats?.db;
  const bqStats  = queueStats?.bullmq;
  const onlineWorkerCount = workers.filter(w => w.status === "online").length;

  // ── Filtered logs ──
  const filteredLogs = logs.filter(e => {
    if (logLevel !== "all" && e.level !== logLevel) return false;
    if (logSearch) {
      const q = logSearch.toLowerCase();
      return e.message.toLowerCase().includes(q) || (e.agent ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  // ── Layout ──
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#070711", fontFamily: "inherit" }}>

      {/* Sidebar */}
      <aside style={{
        width: 210, flexShrink: 0, minHeight: "100vh",
        background: "linear-gradient(180deg, #0b0b18 0%, #08080f 100%)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        {/* Brand */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg,#6366f1,#4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(99,102,241,0.4)",
            }}>
              <Video size={15} color="#fff" strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", letterSpacing: -0.4 }}>Ottoflow</div>
              <div style={{ fontSize: 9, color: "#6366f1", fontWeight: 700, letterSpacing: "0.5px" }}>⚡ ADVANCED</div>
            </div>
          </div>

          {/* Pipeline status pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 8,
            background: pipeStatus === "running" ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${pipeStatus === "running" ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: pipeStatus === "running" ? "#10b981" : pipeStatus === "done" ? "#10b981" : pipeStatus === "error" ? "#f43f5e" : "rgba(255,255,255,0.15)",
              boxShadow: pipeStatus === "running" ? "0 0 6px #10b981" : "none",
              animation: pipeStatus === "running" ? "pulse 1.5s infinite" : "none",
            }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: pipeStatus === "running" ? "#a78bfa" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {pipeStatus === "running" ? "Pipeline running" : pipeStatus === "done" ? "Pipeline done" : pipeStatus === "error" ? "Error" : "Idle"}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {APP_NAV.map(({ id, label, Icon: NavIcon }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)} style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "8px 10px", borderRadius: 7,
                border: "none", cursor: "pointer", textAlign: "left",
                fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: "inherit", marginBottom: 2,
                background: active ? "rgba(99,102,241,0.12)" : "transparent",
                color: active ? "#a78bfa" : "var(--text-muted)",
                transition: "all 0.12s",
                position: "relative",
                boxShadow: active ? "inset 0 0 0 1px rgba(99,102,241,0.2)" : "none",
              }}>
                {active && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 16, borderRadius: "0 3px 3px 0", background: "linear-gradient(180deg,#6366f1,#a78bfa)" }} />}
                <NavIcon size={14} strokeWidth={active ? 2.2 : 1.8} />
                {label}
                {id === "health" && (
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: workerOnline ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", color: workerOnline ? "#10b981" : "var(--text-muted)" }}>
                    {onlineWorkerCount}
                  </span>
                )}
                {id === "pipeline" && logs.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(99,102,241,0.12)", color: "#a78bfa" }}>
                    {logs.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Infrastructure health strip */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 7 }}>
            Infra Health
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {([
              { label: "DB",    ok: health?.db    },
              { label: "Redis", ok: health?.redis },
              { label: "Env",   ok: health?.env   },
            ] as { label: string; ok: boolean | undefined }[]).map(({ label, ok }) => (
              <div key={label} title={`${label}: ${ok == null ? "checking..." : ok ? "ok" : "error"}`} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "3px 7px",
                borderRadius: 5, fontSize: 9, fontWeight: 700,
                background: ok == null ? "rgba(255,255,255,0.04)" : ok ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
                border: `1px solid ${ok == null ? "rgba(255,255,255,0.07)" : ok ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.25)"}`,
                color: ok == null ? "rgba(255,255,255,0.25)" : ok ? "#10b981" : "#f43f5e",
              }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            <div style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: 10 }}>joseph@ottoflow.ai</div>
            <div style={{ color: "#6366f1", fontWeight: 700, fontSize: 10, marginTop: 2 }}>ottoflow.ai</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: (section === "pipeline" && pipeTab === "logs") ? "hidden" : "auto" }}>

        {/* ── MISSION CONTROL ── */}
        {section === "mission" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>System Overview</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Real-time pipeline health · Last 24 hours</p>
            </div>

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
              <StatCard label="Queue Waiting" value={bqStats?.waiting ?? dbStats?.pending ?? "—"} color="#f59e0b" icon={Clock} />
              <StatCard label="Active Runs" value={bqStats?.active ?? dbStats?.running ?? "—"} color="#6366f1" icon={Activity} sub={`+${bqStats?.delayed ?? 0} delayed`} />
              <StatCard label="Done Today" value={dbStats?.done_today ?? "—"} color="#10b981" icon={CheckCircle2} />
              <StatCard label="Failed Today" value={dbStats?.failed_today ?? "—"} color={Number(dbStats?.failed_today) > 0 ? "#f43f5e" : "var(--text-muted)"} icon={AlertCircle} />
              <StatCard label="Workers Online" value={onlineWorkerCount} color={onlineWorkerCount > 0 ? "#10b981" : "var(--text-muted)"} icon={Server} sub={`${workers.length} total`} />
              <StatCard label="Avg Duration" value={fmtDuration(dbStats?.avg_duration_s ?? null)} color="var(--text-secondary)" icon={Gauge} />
            </div>

            {/* Center: pipeline list + live log stream */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12 }}>Recent Pipelines</div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                  {pipelines.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                      <Film size={24} style={{ opacity: 0.15, display: "block", margin: "0 auto 8px" }} />
                      No pipelines yet
                    </div>
                  ) : pipelines.slice(0, 8).map(p => (
                    <PipelineRow key={p.id} pipeline={p} isExpanded={expandedPipeline === p.id}
                      onToggle={() => setExpandedPipeline(prev => prev === p.id ? null : p.id)}
                      liveStageStatuses={p.id === activePipelineId ? stageStatuses : undefined}
                      onRefresh={fetchPipelines} />
                  ))}
                </div>
                {pipelines.length > 8 && (
                  <button onClick={() => setSection("pipeline")} style={{ marginTop: 10, fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    View all {pipelines.length} pipelines →
                  </button>
                )}
              </div>

              {/* Live log stream */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12 }}>Live Log Stream</div>
                <div style={{
                  flex: 1, background: "#050510", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
                  fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 10,
                  overflowY: "auto", maxHeight: 380, padding: "8px 0",
                }}>
                  {logs.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "rgba(255,255,255,0.15)" }}>
                      <Terminal size={20} style={{ display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
                      <div style={{ fontSize: 11 }}>Streams when a pipeline runs</div>
                    </div>
                  ) : logs.slice(-60).map((entry, idx) => {
                    const tsDate = entry.ts ? new Date(entry.ts) : null;
                    const tsStr  = tsDate && !isNaN(tsDate.getTime())
                      ? tsDate.toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
                      : "";
                    return (
                      <div key={entry.id ?? `${entry.ts}-${idx}`} style={{ display: "flex", gap: 6, padding: "2px 10px", borderLeft: `2px solid ${levelColor(entry.level ?? "")}22` }}>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{tsStr}</span>
                        <span style={{ color: levelColor(entry.level ?? ""), wordBreak: "break-word", lineHeight: 1.5, flex: 1, fontSize: 10 }}>{stripSlugPrefix(entry.message)}</span>
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
                <button onClick={() => { setSection("pipeline"); setPipeTab("logs"); }} style={{ marginTop: 8, fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, textAlign: "left" }}>
                  Open full log terminal →
                </button>
              </div>
            </div>

            {/* Worker fleet — horizontal strip */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12 }}>Worker Fleet</div>
              {workers.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  <Server size={20} style={{ opacity: 0.15, display: "block", margin: "0 auto 8px" }} />
                  No workers online
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  {workers.slice(0, 4).map(w => <WorkerCard key={w.id} worker={w} />)}
                  {workers.length > 4 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <button onClick={() => setSection("health")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        +{workers.length - 4} more workers →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PIPELINE — TAB BAR ── */}
        {section === "pipeline" && (
          <div style={{ padding: "12px 32px 0", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            {(["runs", "logs"] as const).map(t => (
              <button key={t} onClick={() => setPipeTab(t)} style={{
                padding: "7px 16px", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent",
                color: pipeTab === t ? "#a78bfa" : "var(--text-muted)",
                borderBottom: pipeTab === t ? "2px solid #6366f1" : "2px solid transparent",
                transition: "all 0.12s", marginBottom: -1,
              }}>
                {t === "runs" ? "Pipeline Runs" : "Live Logs"}
              </button>
            ))}
          </div>
        )}

        {/* ── RENDER PIPELINE — RUNS ── */}
        {section === "pipeline" && pipeTab === "runs" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Pipeline Runs</h1>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{pipelines.length} runs · sorted by queue time</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["all","running","done","failed","cancelled","dead","queued"].map(f => (
                  <button key={f} onClick={() => setPipeFilter(f)} style={{
                    padding: "5px 13px", borderRadius: 20, border: `1px solid ${pipeFilter === f ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                    background: pipeFilter === f ? "rgba(99,102,241,0.12)" : "transparent",
                    color: pipeFilter === f ? "#a78bfa" : "var(--text-muted)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                    textTransform: "capitalize",
                  }}>
                    {f}
                  </button>
                ))}
                <button onClick={fetchPipelines} style={{ padding: "5px 11px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>

            {/* Run queue button */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button onClick={runQueue} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8,
                border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,#6366f1,#a78bfa)", color: "#fff",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}>
                <Play size={12} fill="currentColor" /> Run {queue.filter(r => ["Pending","Queued"].includes(r.status)).length} Pending
              </button>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
              {pipelines.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  <Film size={32} style={{ opacity: 0.12, display: "block", margin: "0 auto 12px" }} />
                  No pipelines found
                  {pipeFilter !== "all" && <div style={{ marginTop: 8, fontSize: 11 }}>Try clearing the filter</div>}
                </div>
              ) : (
                pipelines.map(p => (
                  <PipelineRow key={p.id} pipeline={p}
                    isExpanded={expandedPipeline === p.id}
                    onToggle={() => setExpandedPipeline(prev => prev === p.id ? null : p.id)}
                    liveStageStatuses={p.id === activePipelineId ? stageStatuses : undefined}
                    onRefresh={fetchPipelines}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── HEALTH — TAB BAR ── */}
        {section === "health" && (
          <div style={{ padding: "12px 32px 0", display: "flex", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            {(["workers", "costs"] as const).map(t => (
              <button key={t} onClick={() => setHealthTab(t)} style={{
                padding: "7px 16px", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent",
                color: healthTab === t ? "#a78bfa" : "var(--text-muted)",
                borderBottom: healthTab === t ? "2px solid #6366f1" : "2px solid transparent",
                transition: "all 0.12s", marginBottom: -1,
              }}>
                {t === "workers" ? "Worker Fleet" : "AI Costs"}
              </button>
            ))}
          </div>
        )}

        {/* ── HEALTH — WORKERS ── */}
        {section === "health" && healthTab === "workers" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Worker Fleet</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {onlineWorkerCount} online · {workers.length} total · heartbeat &lt; 30s = healthy
              </p>
            </div>
            {workers.length === 0 ? (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "64px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                <Server size={40} style={{ opacity: 0.12, display: "block", margin: "0 auto 16px" }} />
                <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>No workers online</div>
                <div style={{ fontSize: 11 }}>Workers auto-register on startup — deploy a worker service to join the fleet</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {workers.map(w => <WorkerCard key={w.id} worker={w} />)}
              </div>
            )}
          </div>
        )}

        {/* ── RENDER PIPELINE — LOGS ── */}
        {section === "pipeline" && pipeTab === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
            {/* Log toolbar */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0b0b18", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0, flexShrink: 0 }}>Live Logs</h2>
              <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
                <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text" value={logSearch} onChange={e => setLogSearch(e.target.value)}
                  placeholder="Search messages or agents…"
                  style={{ width: "100%", padding: "7px 10px 7px 28px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "var(--text)", fontSize: 11, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {["all","error","agent","info"].map(l => (
                  <button key={l} onClick={() => setLogLevel(l)} style={{
                    padding: "5px 11px", borderRadius: 20, border: `1px solid ${logLevel === l ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"}`,
                    background: logLevel === l ? "rgba(99,102,241,0.12)" : "transparent",
                    color: logLevel === l ? "#a78bfa" : "var(--text-muted)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
                  }}>
                    {l}
                  </button>
                ))}
              </div>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{filteredLogs.length} entries</span>
              <button onClick={() => setLogs([])} style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "var(--text-muted)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Clear
              </button>
            </div>

            {/* Log stream */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#040410", fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 11, padding: "6px 0" }}>
              {filteredLogs.length === 0 ? (
                <div style={{ padding: "64px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                  <Terminal size={28} style={{ opacity: 0.12, display: "block", margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 12 }}>No log entries {logSearch || logLevel !== "all" ? "matching filter" : "yet"}</div>
                  <div style={{ fontSize: 10, marginTop: 6 }}>Logs stream in real-time when a pipeline runs</div>
                </div>
              ) : filteredLogs.map((entry, idx) => {
                const tsDate = entry.ts ? new Date(entry.ts) : null;
                const tsStr  = tsDate && !isNaN(tsDate.getTime())
                  ? tsDate.toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "";
                const lvl    = entry.level ?? "info";
                const lc     = levelColor(lvl);
                const lvlLabel = lvl === "agent" ? "RUN" : lvl.toUpperCase().slice(0, 3);
                return (
                  <div key={entry.id ?? `${entry.ts}-${idx}`} style={{ display: "flex", alignItems: "baseline", gap: 0, padding: "1px 0", transition: "background 0.08s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.018)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0, fontVariantNumeric: "tabular-nums", paddingLeft: 16, paddingRight: 10, minWidth: 64 }}>{tsStr}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, flexShrink: 0, width: 26, textAlign: "center", letterSpacing: "0.3px",
                      color: lc, opacity: 0.85,
                    }}>{lvlLabel}</span>
                    <span style={{ fontSize: 9, color: "#6366f1", flexShrink: 0, minWidth: 96, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8, paddingLeft: 4 }}>{entry.agent ?? ""}</span>
                    <span style={{ color: lc === "var(--text-secondary)" ? "rgba(255,255,255,0.55)" : lc, wordBreak: "break-word", lineHeight: 1.6, flex: 1, paddingRight: 16 }}>{stripSlugPrefix(entry.message)}</span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ── HEALTH — COSTS ── */}
        {section === "health" && healthTab === "costs" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>AI Cost Analytics</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Usage by provider · Cache efficiency · Cost per render</p>
            </div>

            {aiCosts === null ? (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "64px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                <BarChart2 size={36} style={{ opacity: 0.12, display: "block", margin: "0 auto 14px" }} />
                <div style={{ fontWeight: 700, marginBottom: 6 }}>No cost data available</div>
                <div style={{ fontSize: 11 }}>Cost tracking is enabled once pipelines complete with AI stages</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
                  <StatCard label="Total Spend" value={`$${aiCosts.total_cost_usd?.toFixed(4) ?? "0"}`} color="#10b981" icon={DollarSign} />
                  <StatCard label="Total Requests" value={aiCosts.total_requests ?? 0} icon={Activity} />
                  <StatCard label="Cache Hit Rate" value={`${Math.round((aiCosts.cache_hit_rate ?? 0) * 100)}%`} color={(aiCosts.cache_hit_rate ?? 0) > 0.5 ? "#10b981" : "#f59e0b"} icon={Database} sub="higher = cheaper" />
                  <StatCard label="Cost / Render" value={aiCosts.total_requests > 0 ? `$${(aiCosts.total_cost_usd / Math.max(1, (dbStats?.done_today ?? 1))).toFixed(4)}` : "—"} icon={Package} />
                </div>

                {aiCosts.by_provider && Object.keys(aiCosts.by_provider).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 12 }}>By Provider</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(aiCosts.by_provider).map(([provider, data]) => (
                        <div key={provider} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", minWidth: 100 }}>{provider}</span>
                          <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{data.requests} requests</span>
                          <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: "#10b981", marginLeft: "auto" }}>${data.cost_usd?.toFixed(6)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STORYBOARD STUDIO ── */}
        {section === "storyboard" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <OwnTopicView onGenerate={() => { setSection("pipeline"); fetchPipelines(); }} tier="advanced" />
          </div>
        )}

        {/* ── APPROVALS ── */}
        {section === "approvals" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Approvals</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Review completed renders before distribution</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>
              <CheckCircle2 size={32} style={{ opacity: 0.12, display: "block", margin: "0 auto 14px" }} />
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, color: "var(--text-secondary)" }}>Phase 5 — Coming Soon</div>
              <div style={{ fontSize: 12 }}>Approve or reject renders before Telegram delivery</div>
            </div>
          </div>
        )}

        {/* ── CREATIVE IDENTITY ── */}
        {section === "identity" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Creative Identity</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Persistent voice, style, and persona defaults for all renders</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>
              <Wand2 size={32} style={{ opacity: 0.12, display: "block", margin: "0 auto 14px" }} />
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, color: "var(--text-secondary)" }}>Phase 6 — Coming Soon</div>
              <div style={{ fontSize: 12 }}>Configure creator persona, voice presets, caption style, and visual identity defaults</div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Active Renders View ──────────────────────────────────────

function ActiveRendersView() {
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    const r = await fetch("/api/jobs?limit=30").catch(() => null);
    if (r?.ok) { const d = await r.json(); setJobs(d.jobs || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchJobs(); const t = setInterval(fetchJobs, 5000); return () => clearInterval(t); }, [fetchJobs]);

  const active  = jobs.filter(j => j.status === "processing" || j.status === "pending");
  const recent  = jobs.filter(j => j.status === "done" || j.status === "error").slice(0, 15);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <PageTitle title="Active Renders" sub="Live render status — updates every 5 seconds" />

      {/* Active jobs */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>In Progress</div>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
          </div>
        ) : active.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "36px 24px", color: "var(--text-muted)", fontSize: 13 }}>
            <Film size={28} style={{ opacity: 0.15, display: "block", margin: "0 auto 10px" }} />
            No active renders — queue a video from Create Video or Content Library
          </div>
        ) : active.map(job => (
          <div key={job.id} className="card" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "#a78bfa", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayTopic(job.topic)}</div>
              <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#6366f1,#a78bfa)", width: `${job.progress ?? 0}%`, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{job.progress ?? 0}%</span>
              </div>
            </div>
            <StatusPill status={job.status} />
            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{job.template}</span>
          </div>
        ))}
      </div>

      {/* Recent */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Recent</div>
        {recent.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No completed renders yet.</div>
        ) : recent.map(job => {
          const dur = job.duration_ms ? `${Math.round(job.duration_ms / 1000)}s` : "—";
          return (
            <div key={job.id} className="card" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
              {job.status === "done"
                ? <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />
                : <XCircle size={14} color="#f43f5e" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayTopic(job.topic)}</div>
                {job.status === "error" && job.error && (
                  <div style={{ fontSize: 10, color: "#f43f5e", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.error.slice(0, 100)}</div>
                )}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{dur}</span>
              {job.output_link && (
                <a href={job.output_link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  <ArrowUpRight size={12} /> View
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Publishing View ──────────────────────────────────────────

function PublishingView() {
  const [rows,    setRows]    = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<"all" | "complete" | "pending">("all");

  useEffect(() => {
    fetch("/api/queue")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(d.rows || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const displayed = rows.filter(row => {
    if (filter === "complete") return ["Done","Complete"].includes(row.status);
    if (filter === "pending")  return row.status === "Pending";
    return true;
  });

  return (
    <div style={{ padding: "28px 32px" }}>
      <PageTitle title="Publishing" sub="Review completed videos and schedule for distribution" />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        {(["all","complete","pending"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid var(--border)", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit", background: filter === f ? "var(--primary)" : "transparent", color: filter === f ? "#fff" : "var(--text-muted)", transition: "all 0.12s" }}>
            {f === "all" ? "All" : f === "complete" ? "Ready" : "Pending"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{rows.length} videos</span>
      </div>

      {/* Social scheduling — coming soon */}
      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 14, padding: "14px 20px" }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--primary-light)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Share2 size={16} color="var(--accent)" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Auto-Publish</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>TikTok, Instagram &amp; YouTube scheduling — coming soon</div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--accent)", background: "var(--primary-light)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 5, padding: "3px 9px" }}>SOON</span>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)", fontSize: 13 }}>
          <Share2 size={32} style={{ opacity: 0.15, display: "block", margin: "0 auto 10px" }} />
          No videos to publish yet — render something first.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {displayed.map(row => <ReviewCard key={row.rowIndex} row={row} />)}
        </div>
      )}
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────

function SettingsView() {
  const [svc, setSvc] = useState<Services | null>(null);
  useEffect(() => {
    fetch("/api/status").then(r => r.ok ? r.json() : null).then(d => { if (d) setSvc(d); }).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 800 }}>
      <PageTitle title="Settings" sub="Provider connections and pipeline configuration" />

      {/* Service connections */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Provider Connections</div>
      <div className="card" style={{ marginBottom: 28, display: "flex", gap: 0, padding: 0, overflow: "hidden" }}>
        {(Object.keys(SVC_LABELS) as (keyof Services)[]).map((k, i) => (
          <div key={k} style={{ flex: 1, padding: "14px 16px", borderRight: i < Object.keys(SVC_LABELS).length - 1 ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{SVC_LABELS[k]}</div>
            {svc ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: svc[k] ? "var(--green)" : "var(--red)", flexShrink: 0, boxShadow: svc[k] ? "0 0 6px var(--green-glow)" : "none" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: svc[k] ? "var(--green)" : "var(--red)" }}>{svc[k] ? "Live" : "Not set"}</span>
              </div>
            ) : (
              <div style={{ height: 18, width: 60 }} className="skeleton" />
            )}
          </div>
        ))}
      </div>

      {/* Agent grid */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12 }}>Pipeline Agents</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {ALL_AGENTS.map((a) => {
          const on = svc ? svc[a.svc as keyof Services] : null;
          const { Icon } = a;
          return (
            <div key={a.name} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: on === true ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on === true ? "rgba(99,102,241,0.25)" : "var(--border)"}` }}>
                  <Icon size={16} color={on === true ? "var(--accent)" : "var(--text-muted)"} strokeWidth={1.8} />
                </div>
                {svc && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: svc[a.svc as keyof Services] ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)", color: svc[a.svc as keyof Services] ? "var(--green)" : "var(--red)" }}>
                    {svc[a.svc as keyof Services] ? "Live" : a.fb ?? "Offline"}
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)", marginBottom: 3 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Basic App ────────────────────────────────────────────────

function BasicApp({ onSwitchToAdvanced }: { onSwitchToAdvanced: () => void }) {
  const [view,        setView]        = useState<View>("dashboard");
  const [tier,        setTier]        = useState<Tier>("basic");
  const [pipeStatus,  setPipeStatus]  = useState<Status>("idle");
  const [activeAgent, setActiveAgent] = useState("");

  useEffect(() => {
    const es = new EventSource("/api/pipeline-events");
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "init" || msg.type === "status") { if (msg.status) setPipeStatus(msg.status); }
        if (msg.type === "log") setActiveAgent(msg.entry.agent);
      } catch {}
    };
    return () => es.close();
  }, []);

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ style: { background: "var(--bg-card)", border: "1px solid var(--border-strong)", color: "var(--text)", fontFamily: "inherit", fontSize: 13 } }} richColors />
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar view={view} setView={setView} pipeStatus={pipeStatus} activeAgent={activeAgent} tier={tier} setTier={t => {
          setTier(t);
          if (t === "advanced") onSwitchToAdvanced();
        }} />
        <main style={{ flex: 1, minWidth: 0, overflowY: view === "dashboard" ? "hidden" : "auto", height: view === "dashboard" ? "100vh" : undefined, display: "flex", flexDirection: "column", position: "relative", background: "var(--bg)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{ flex: 1, display: "flex", flexDirection: "column", height: view === "dashboard" ? "100vh" : undefined }}
            >
              {view === "dashboard"  && <CommandCenterView tier={tier} setTier={setTier} />}
              {view === "create"     && <OwnTopicView onGenerate={() => setView("dashboard")} tier={tier} />}
              {view === "renders"    && <ActiveRendersView />}
              {view === "library"    && <QueueView tier={tier} />}
              {view === "publishing" && <PublishingView />}
              {view === "settings"   && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <Toaster position="bottom-right" toastOptions={{ style: { background: "var(--bg-card)", border: "1px solid var(--border-strong)", color: "var(--text)", fontFamily: "inherit", fontSize: 13 } }} richColors />
      <AdvancedApp />
    </>
  );
}
