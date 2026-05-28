"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  List, Star, Share2, Play, RefreshCw, Loader2,
  CheckCircle2, XCircle, Zap, Music2,
  Film, Send, Wand2, Clapperboard,
  Image, Video, Terminal, Eye, FolderOpen,
  Activity, TrendingUp, Layers, Hash, PenLine,
  Server, Database, Search, AlertCircle, Clock,
  BarChart2, ChevronDown, ChevronUp,
  DollarSign, Package, Gauge, X,
} from "lucide-react";


// ─── Types ────────────────────────────────────────────────────

type View   = "dashboard" | "create" | "renders" | "library" | "publishing" | "settings";
type Status = "idle" | "running" | "done" | "error";
type Tier   = "basic" | "advanced";

interface LogEntry { id: number; ts: string; agent: string; message: string; level: string; }
interface QueueRow { rowIndex: number; topic: string; style: string; status: string; avatarUrl?: string; }
interface SceneManifestEntry { id: string; beat: string; source: "veo" | "imagen3" | "procedural"; url?: string; fallbackReason?: string; }
interface DbJob { id: string; topic: string; template: string; status: string; error?: string; output_link?: string; duration_ms?: number; started_at?: string; progress?: number; asset_manifest?: SceneManifestEntry[]; }
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
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", lineHeight: 1 }}>Storyboard Studio</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>Create topics manually, batch-queue a list, or let AI generate cinematic angles from a niche</p>
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

// ── Cinematic quality scoring ─────────────────────────────────────────────────
const CINEMATIC_SCORE_WEIGHTS = { veo: 100, imagen3: 62, procedural: 15 } as const;

function computeCinematicScore(manifest: SceneManifestEntry[] | undefined) {
  if (!manifest?.length) return null;
  const n    = manifest.length;
  const veo  = manifest.filter(s => s.source === "veo").length;
  const img  = manifest.filter(s => s.source === "imagen3").length;
  const proc = n - veo - img;
  const score = Math.round((veo * CINEMATIC_SCORE_WEIGHTS.veo + img * CINEMATIC_SCORE_WEIGHTS.imagen3 + proc * CINEMATIC_SCORE_WEIGHTS.procedural) / n);
  const tier  = score >= 85 ? "premium" : score >= 60 ? "standard" : score >= 35 ? "degraded" : "synthetic";
  const label = tier === "premium"  ? "Premium Cinematic"  : tier === "standard" ? "Standard Cinematic"
              : tier === "degraded" ? "Degraded Cinematic" : "Synthetic Render";
  const color = tier === "premium"  ? "#a78bfa" : tier === "standard" ? "#34d399"
              : tier === "degraded" ? "#f59e0b" : "#f43f5e";
  return { score, tier, label, color, veo, img, proc, n };
}

function PipelineRow({ pipeline, isExpanded, onToggle, liveStageStatuses, onRefresh, job }: {
  pipeline: Pipeline;
  isExpanded: boolean;
  onToggle: () => void;
  liveStageStatuses?: Record<string, string>;
  onRefresh?: () => void;
  job?: DbJob;
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

        {/* Cinematic quality score badge */}
        {(() => {
          const qs = computeCinematicScore(job?.asset_manifest);
          if (!qs) return null;
          return (
            <span title={`${qs.label} · ${qs.veo}/${qs.n} Veo · ${qs.img}/${qs.n} Imagen3`} style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5, flexShrink: 0,
              background: `${qs.color}14`, color: qs.color, border: `1px solid ${qs.color}30`,
              letterSpacing: "0.3px",
            }}>
              {qs.score}% {qs.tier === "premium" ? "Premium" : qs.tier === "standard" ? "Standard" : qs.tier === "degraded" ? "Degraded" : "Synthetic"}
            </span>
          );
        })()}

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

          {/* Scene Asset Manifest */}
          {job?.asset_manifest && job.asset_manifest.length > 0 && (() => {
            const qs = computeCinematicScore(job.asset_manifest);
            const SOURCE_COLORS: Record<string, string> = { veo: "#a78bfa", imagen3: "#34d399", procedural: "#f59e0b" };
            const SOURCE_LABELS: Record<string, string> = { veo: "VEO", imagen3: "IMG", procedural: "SYN" };
            return (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Scene Asset Manifest
                  </div>
                  {qs && (
                    <div style={{ fontSize: 9, color: qs.color, fontWeight: 700 }}>
                      {qs.veo}V · {qs.img}I · {qs.proc}P · {qs.score}% cinematic
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {job.asset_manifest.map((scene, idx) => {
                    const sc = SOURCE_COLORS[scene.source] ?? "rgba(255,255,255,0.3)";
                    const sl = SOURCE_LABELS[scene.source] ?? scene.source.toUpperCase();
                    return (
                      <div key={scene.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", flexShrink: 0, marginTop: 1 }}>
                          S{idx + 1}
                        </span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${sc}14`, color: sc, border: `1px solid ${sc}30`, flexShrink: 0 }}>
                          {sl}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {scene.beat}
                        </span>
                        {scene.fallbackReason && (
                          <span style={{ fontSize: 8, color: "#f59e0b", fontStyle: "italic", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={scene.fallbackReason}>
                            {scene.fallbackReason}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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
  const [dbJobs,            setDbJobs]            = useState<DbJob[]>([]);
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

  // Fetch pipelines (10s) — auto-wire activePipelineId to most recent running pipeline
  const fetchPipelines = useCallback(async () => {
    const statusParam = pipeFilter !== "all" ? `&status=${pipeFilter}` : "";
    const r = await fetch(`/api/advanced/pipelines?limit=25${statusParam}`).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      const list: Pipeline[] = d.pipelines || [];
      setPipelines(list);
      const running = list.find(p => p.status === "running" || p.status === "queued");
      if (running) setActivePipelineId(prev => prev ?? running.id);
    }
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

  // Fetch completed jobs for manifest/quality data (10s)
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/jobs?limit=50").catch(() => null);
      if (r?.ok) { const d = await r.json(); setDbJobs(d.jobs || []); }
    };
    load(); const t = setInterval(load, 10_000); return () => clearInterval(t);
  }, []);


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
              <div style={{ fontSize: 9, color: "#6366f1", fontWeight: 700, letterSpacing: "0.5px" }}>V2 Cinematic</div>
            </div>
          </div>

          {/* Pipeline status pill — derived from polled DB state */}
          {(() => {
            const runningPipeline = pipelines.find(p => p.status === "running");
            const isRunning = !!runningPipeline;
            const queuedCount = pipelines.filter(p => p.status === "queued" || p.status === "pending").length;
            return (
              <div style={{
                display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 8,
                background: isRunning ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isRunning ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: isRunning ? "#10b981" : queuedCount > 0 ? "#f59e0b" : "rgba(255,255,255,0.15)",
                  boxShadow: isRunning ? "0 0 6px #10b981" : "none",
                  animation: isRunning ? "pulse 1.5s infinite" : "none",
                }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: isRunning ? "#a78bfa" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isRunning
                    ? `${runningPipeline.progress_pct}% · ${runningPipeline.current_stage?.replace(/^\d+-/, "") ?? "running"}`
                    : queuedCount > 0 ? `${queuedCount} queued` : "Idle"}
                </span>
              </div>
            );
          })()}
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
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: workerOnline ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.12)", color: workerOnline ? "#10b981" : "#f43f5e" }}>
                    {workerOnline ? onlineWorkerCount : "!"}
                  </span>
                )}
                {id === "pipeline" && (() => {
                  const running = pipelines.filter(p => p.status === "running").length;
                  const queued = pipelines.filter(p => p.status === "queued").length;
                  if (running > 0) return (
                    <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(99,102,241,0.15)", color: "#a78bfa", animation: "pulse 1.5s infinite" }}>
                      {running} live
                    </span>
                  );
                  if (queued > 0) return (
                    <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                      {queued}
                    </span>
                  );
                  return null;
                })()}
                {id === "approvals" && (() => {
                  const pending = dbJobs.filter(j => j.status === "done").length;
                  if (pending === 0) return null;
                  return (
                    <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                      {pending}
                    </span>
                  );
                })()}
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

            {/* Worker offline alert */}
            {onlineWorkerCount === 0 && workers !== null && (
              <div style={{ marginBottom: 20, padding: "10px 16px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={14} color="#f59e0b" strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Railway worker offline — renders paused. Start the worker service on Railway to resume.</span>
              </div>
            )}

            {/* Header + quick-queue CTA */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Mission Control</h1>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Production overview · Live pipeline health</p>
              </div>
              <button onClick={() => setSection("storyboard")} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 9,
                border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,#6366f1,#a78bfa)", color: "#fff",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}>
                <PenLine size={13} /> New Storyboard
              </button>
            </div>

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12, marginBottom: 28 }}>
              <StatCard label="Queue Depth" value={bqStats?.waiting ?? dbStats?.pending ?? "—"} color="#f59e0b" icon={Clock} sub={bqStats?.delayed ? `+${bqStats.delayed} delayed` : undefined} />
              <StatCard label="Rendering" value={bqStats?.active ?? dbStats?.running ?? "—"} color="#6366f1" icon={Activity} />
              <StatCard label="Done Today" value={dbStats?.done_today ?? "—"} color="#10b981" icon={CheckCircle2} />
              <StatCard label="Failed Today" value={dbStats?.failed_today ?? "—"} color={Number(dbStats?.failed_today) > 0 ? "#f43f5e" : "rgba(255,255,255,0.15)"} icon={AlertCircle} />
              <StatCard label="Workers" value={onlineWorkerCount} color={onlineWorkerCount > 0 ? "#10b981" : "rgba(255,255,255,0.15)"} icon={Server} sub={`${workers.length} registered`} />
              <StatCard label="Avg Render Time" value={fmtDuration(dbStats?.avg_duration_s ?? null)} color="rgba(255,255,255,0.4)" icon={Gauge} />
            </div>

            {/* Cinematic quality snapshot */}
            {dbJobs.length > 0 && (() => {
              const scoredJobs = dbJobs.filter(j => j.asset_manifest?.length).slice(0, 10);
              if (scoredJobs.length === 0) return null;
              const scores = scoredJobs.map(j => computeCinematicScore(j.asset_manifest)).filter(Boolean) as NonNullable<ReturnType<typeof computeCinematicScore>>[];
              if (scores.length === 0) return null;
              const avgScore = Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
              const veoCount = scores.reduce((a, b) => a + b.veo, 0);
              const totalScenes = scores.reduce((a, b) => a + b.n, 0);
              const pctVeo = totalScenes > 0 ? Math.round(veoCount / totalScenes * 100) : 0;
              const tierColor = avgScore >= 85 ? "#a78bfa" : avgScore >= 60 ? "#34d399" : avgScore >= 35 ? "#f59e0b" : "#f43f5e";
              return (
                <div style={{ marginBottom: 28, padding: "16px 20px", borderRadius: 12, background: `${tierColor}08`, border: `1px solid ${tierColor}20`, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Render Quality · Last {scores.length} renders</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: tierColor, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>{avgScore}%</div>
                    <div style={{ fontSize: 10, color: tierColor, fontWeight: 600, marginTop: 2 }}>{avgScore >= 85 ? "Premium Cinematic" : avgScore >= 60 ? "Standard Cinematic" : avgScore >= 35 ? "Degraded" : "Synthetic"}</div>
                  </div>
                  <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 3 }}>Veo Coverage</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa", fontVariantNumeric: "tabular-nums" }}>{pctVeo}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 3 }}>Total Scenes</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>{totalScenes}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Recent renders */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>Recent Renders</div>
                {pipelines.length > 6 && (
                  <button onClick={() => setSection("pipeline")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    View all {pipelines.length} →
                  </button>
                )}
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                {pipelines.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                    <Film size={28} style={{ opacity: 0.12, display: "block", margin: "0 auto 10px" }} />
                    No pipelines yet · queue a topic from Storyboard Studio
                  </div>
                ) : pipelines.slice(0, 6).map(p => (
                  <PipelineRow key={p.id} pipeline={p} isExpanded={expandedPipeline === p.id}
                    onToggle={() => setExpandedPipeline(prev => prev === p.id ? null : p.id)}
                    liveStageStatuses={p.id === activePipelineId ? stageStatuses : undefined}
                    onRefresh={fetchPipelines}
                    job={dbJobs.find(j => j.topic === p.topic && j.status === "done")} />
                ))}
              </div>
            </div>

            {/* Worker fleet */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px" }}>Worker Fleet</div>
                {workers.length > 3 && (
                  <button onClick={() => setSection("health")} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    +{workers.length - 3} more →
                  </button>
                )}
              </div>
              {workers.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  <Server size={20} style={{ opacity: 0.15, display: "block", margin: "0 auto 8px" }} />
                  No workers online
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                  {workers.slice(0, 3).map(w => <WorkerCard key={w.id} worker={w} />)}
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
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Render Pipeline</h1>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{pipelines.length} runs · cinematic observability</p>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {["all","running","done","failed","queued"].map(f => (
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
                <button onClick={fetchPipelines} title="Refresh" style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center" }}>
                  <RefreshCw size={11} />
                </button>
              </div>
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
                    job={dbJobs.find(j => j.topic === p.topic && j.status === "done")}
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
          <OwnTopicView onGenerate={() => { fetchPipelines(); }} tier="advanced" />
        )}

        {/* ── APPROVALS ── */}
        {section === "approvals" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Approvals</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Completed renders · Review output before distribution</p>
            </div>
            {dbJobs.filter(j => j.status === "done").length === 0 ? (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>
                <CheckCircle2 size={32} style={{ opacity: 0.12, display: "block", margin: "0 auto 14px" }} />
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, color: "var(--text-secondary)" }}>No completed renders yet</div>
                <div style={{ fontSize: 12 }}>Renders appear here once the pipeline completes</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dbJobs.filter(j => j.status === "done").map(job => {
                  const qs = computeCinematicScore(job.asset_manifest);
                  return (
                    <div key={job.id} style={{
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
                          {displayTopic(job.topic)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>Complete</span>
                          {job.duration_ms && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· {fmtDuration(Math.round(job.duration_ms / 1000))}</span>}
                          {qs && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: `${qs.color}14`, color: qs.color, border: `1px solid ${qs.color}28` }}>
                              {qs.score}% {qs.label}
                            </span>
                          )}
                          {job.started_at && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· {fmtAgo(job.started_at)}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {job.output_link && (
                          <a href={job.output_link} target="_blank" rel="noopener noreferrer" style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 7,
                            fontSize: 11, fontWeight: 700, textDecoration: "none",
                            background: "rgba(99,102,241,0.12)", color: "#a78bfa", border: "1px solid rgba(99,102,241,0.25)",
                          }}>
                            <Eye size={12} /> Preview
                          </a>
                        )}
                        {job.output_link && (
                          <a href={job.output_link} download target="_blank" rel="noopener noreferrer" style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 7,
                            fontSize: 11, fontWeight: 700, textDecoration: "none",
                            background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)",
                          }}>
                            <Send size={12} /> Approve
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CREATIVE IDENTITY ── */}
        {section === "identity" && (
          <div style={{ padding: "28px 32px" }}>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 4 }}>Creative Identity</h1>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Cinematic systems locked for all V2 renders</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {([
                { label: "Voice Engine", value: "ElevenLabs v3", sub: "eleven_v3 · emotion-aware TTS", color: "#a78bfa", icon: Activity },
                { label: "Default Voice", value: "Female Energetic", sub: "Warm, confident, creator-native", color: "#a78bfa", icon: Activity },
                { label: "Asset Source", value: "Veo 3.0 → Imagen3 → Procedural", sub: "Waterfall fallback chain", color: "#34d399", icon: Video },
                { label: "Scene Format", value: "5-scene · 15 seconds", sub: "TikTok-native 9:16 portrait", color: "#6366f1", icon: Film },
                { label: "Script AI", value: "Gemini 2.5 Flash", sub: "Primary · Claude Sonnet fallback", color: "#f59e0b", icon: Wand2 },
                { label: "Story Arcs", value: "4 Variants", sub: "Problem-first · Stat-first · Story-arc · Myth-bust", color: "#f59e0b", icon: PenLine },
                { label: "Hook Styles", value: "6 Styles", sub: "Question · Bold · Conflict · Promise · Shock · Story", color: "#f59e0b", icon: Zap },
                { label: "Caption Engine", value: "Auto-generated", sub: "Word-level sync · Cinematic timing", color: "#34d399", icon: Hash },
                { label: "Music Mix", value: "Voiceover + Music", sub: "Voice at 100% · Music at 12% amix", color: "#6366f1", icon: Music2 },
                { label: "Export Format", value: "MP4 · H.264", sub: "TikTok-optimized · loudnorm mastered", color: "#6366f1", icon: FolderOpen },
                { label: "Approval Chain", value: "Telegram Delivery", sub: "Auto-delivered after render completes", color: "#10b981", icon: Send },
                { label: "Anti-Repeat Guard", value: "Active", sub: "DB-checked · no same template twice", color: "#10b981", icon: CheckCircle2 },
              ] as { label: string; value: string; sub: string; color: string; icon: React.ElementType }[]).map(({ label, value, sub, color, icon: Icon }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 20px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,${color},${color}44)`, borderRadius: "12px 0 0 12px" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingLeft: 8 }}>
                    <Icon size={10} color="rgba(255,255,255,0.22)" strokeWidth={2} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", paddingLeft: 8, marginBottom: 3 }}>{value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", paddingLeft: 8, lineHeight: 1.4 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
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
