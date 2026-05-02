"use client";

import React, { useState, useCallback, useRef, useMemo, Suspense } from "react";
import { Player } from "@remotion/player";
import { useSearchParams } from "next/navigation";
import { ProductDemoVideo } from "../../remotion/product-demo/ProductDemoVideo";
import { PD_FPS, PD_WIDTH, PD_HEIGHT, PD_SCENE_FRAMES } from "../../remotion/product-demo/types";
import type { ProductVideoData } from "../../remotion/types";

// ─── DEFAULT DATA ────────────────────────────────────────────
function buildDefaultData(slug: string, name: string): ProductVideoData {
  return {
    productSlug: slug || "new-product",
    brandColors: { primary: "#d97706", secondary: "#92400e", accent: "#f59e0b", background: "#0a0a0a", text: "#ffffff" },
    hook: { painPointQuestion: "Still searching for the perfect " + (name || "product") + "?" },
    productIntro: { productName: name || "My Product", tagline: "Premium quality " + (name || "product").toLowerCase() + " you'll love" },
    simulatedDemo: { inputPlaceholder: "Search...", typedText: name || "My Product", buttonText: "Shop Now", resultText: (name || "My Product") + " — Available Now!", resultSubtext: "#trending #viral #musthave" },
    imageShowcase: { images: [] },
    featureCallouts: { productImagePath: "", features: [
      { icon: "check", text: "Premium quality guaranteed" },
      { icon: "lightning", text: "Fast shipping available" },
      { icon: "star", text: "Top rated by customers" },
    ]},
    socialProofCta: { socialProofNumber: 10000, socialProofLabel: "happy customers", ctaUrl: "Link in bio" },
  };
}

// ─── COLOR PICKER ───────────────────────────────────────────
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 32, height: 32, padding: 0, borderRadius: 8, cursor: "pointer", border: "2px solid var(--border)", background: value }}
        />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-dim)" }}>{value}</div>
      </div>
    </div>
  );
}

// ─── IMAGE MANAGER ──────────────────────────────────────────
function ImageManager({ images, onImagesChange, slug }: {
  images: { path: string; headline: string }[];
  onImagesChange: (imgs: { path: string; headline: string }[]) => void;
  slug: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    formData.append("slug", slug);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.paths) {
        const headlines = ["Premium Quality", "Best Seller", "Top Rated", "Must Have", "Fan Favorite"];
        const newImages = data.paths.map((p: string, i: number) => ({
          path: p, headline: headlines[(images.length + i) % headlines.length],
        }));
        onImagesChange([...images, ...newImages]);
      }
    } catch (err) { console.error("Upload failed:", err); }
  }, [images, onImagesChange, slug]);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "2px dashed " + (dragOver ? "var(--primary)" : "var(--border)"),
          borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer",
          background: dragOver ? "var(--primary-light)" : "var(--bg-input)",
          transition: "all 0.15s", marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Drop images here or click to browse</div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {images.map((img, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "var(--bg-input)", border: "1px solid var(--border)" }}>
            <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--bg-hover)", overflow: "hidden", flexShrink: 0 }}>
              <img src={"/" + img.path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <input value={img.headline} onChange={(e) => { const u = [...images]; u[i] = { ...u[i], headline: e.target.value }; onImagesChange(u); }}
              style={{ flex: 1, fontSize: 12, padding: "5px 8px" }} placeholder="Headline..." />
            <button onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
              style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>x</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FEATURE EDITOR ─────────────────────────────────────────
function FeatureEditor({ features, onChange }: {
  features: { icon: string; text: string }[];
  onChange: (f: { icon: string; text: string }[]) => void;
}) {
  const icons = ["check", "lightning", "star", "shield", "zap", "heart"];
  return (
    <div>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <select value={f.icon} onChange={(e) => { const u = [...features]; u[i] = { ...u[i], icon: e.target.value }; onChange(u); }}
            style={{ width: 80, fontSize: 12, padding: "5px 6px" }}>
            {icons.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
          </select>
          <input value={f.text} onChange={(e) => { const u = [...features]; u[i] = { ...u[i], text: e.target.value }; onChange(u); }}
            style={{ flex: 1, fontSize: 12, padding: "5px 8px" }} />
          <button onClick={() => onChange(features.filter((_, j) => j !== i))}
            style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14 }}>x</button>
        </div>
      ))}
      {features.length < 5 && (
        <button onClick={() => onChange([...features, { icon: "check", text: "New feature" }])}
          className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>+ Add Feature</button>
      )}
    </div>
  );
}

// ─── TIMING SLIDERS ─────────────────────────────────────────
function TimingSliders({ timing, onTimingChange }: {
  timing: Record<string, number>;
  onTimingChange: (t: Record<string, number>) => void;
}) {
  const scenes = [
    { key: "scene1_hook", label: "Text Hook", min: 60, max: 150 },
    { key: "scene2_oldWay", label: "The Old Way", min: 90, max: 300 },
    { key: "scene3_reveal", label: "Product Reveal", min: 90, max: 240 },
    { key: "scene4_gallery", label: "Image Gallery", min: 120, max: 300 },
    { key: "scene5_features", label: "Features", min: 90, max: 240 },
    { key: "scene6_social", label: "Social Proof", min: 90, max: 240 },
    { key: "scene7_cta", label: "CTA", min: 60, max: 180 },
  ];
  const total = Object.values(timing).reduce((a, b) => a + b, 0);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Scene Timing</span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>{(total / 30).toFixed(1)}s ({total}f)</span>
      </div>
      {scenes.map((s, i) => (
        <div key={s.key} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
            <span style={{ color: "var(--text-secondary)" }}>{i + 1}. {s.label}</span>
            <span style={{ color: "var(--text-dim)", fontFamily: "monospace", fontSize: 11 }}>{(timing[s.key] / 30).toFixed(1)}s</span>
          </div>
          <input type="range" min={s.min} max={s.max} step={15} value={timing[s.key]}
            onChange={(e) => onTimingChange({ ...timing, [s.key]: Number(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--primary)" }} />
        </div>
      ))}
    </div>
  );
}

// ─── COLLAPSIBLE PANEL ──────────────────────────────────────
function Panel({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, marginBottom: 10, boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
    }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", userSelect: "none", padding: "12px 16px",
        borderBottom: open ? "1px solid var(--border)" : "none",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{title}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.15s" }}>
          <path d="M4 6l4 4 4-4" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}

// ─── INNER EDITOR (uses useSearchParams) ────────────────────
function EditorInner() {
  const searchParams = useSearchParams();
  const slug = searchParams?.get("slug") || "new-product";
  const nameParam = searchParams?.get("name") || "My Product";

  const [data, setData] = useState<ProductVideoData>(() => buildDefaultData(slug, nameParam));
  const [rendering, setRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [timing, setTiming] = useState<Record<string, number>>({ ...PD_SCENE_FRAMES });

  const totalFrames = useMemo(() => Object.values(timing).reduce((a, b) => a + b, 0), [timing]);

  React.useEffect(() => {
    fetch("/api/video-data/" + slug)
      .then((r) => (r.ok ? r.json() : null))
      .then((saved) => { if (saved) setData(saved); })
      .catch(() => {});
  }, [slug]);

  const updateField = useCallback((path: string, value: any) => {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const updateColor = useCallback((key: string, value: string) => {
    setData((prev) => ({ ...prev, brandColors: { ...prev.brandColors, [key]: value } }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/video-data/" + slug, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setRenderStatus("Saved successfully");
      setTimeout(() => setRenderStatus(null), 2000);
    } catch { setRenderStatus("Save failed"); }
    setSaving(false);
  };

  const handleRender = async () => {
    setRendering(true);
    setRenderStatus("Starting render...");
    try {
      const res = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, data, timing }) });
      const result = await res.json();
      if (result.success) {
        setRenderStatus("Done! " + (result.fileSizeBytes / 1048576).toFixed(1) + "MB");
      } else { setRenderStatus("Error: " + result.error); }
    } catch { setRenderStatus("Render failed"); }
    setRendering(false);
  };

  const isError = renderStatus && (renderStatus.includes("Error") || renderStatus.includes("failed"));
  const isSuccess = renderStatus && !isError;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)", position: "sticky", top: 0, zIndex: 50,
        boxShadow: "var(--shadow-sm)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ color: "var(--text-muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Back
          </a>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{data.productIntro.productName}</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)", background: "var(--bg-input)", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace" }}>{slug}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {renderStatus && (
            <span style={{
              fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
              background: isError ? "var(--red-light)" : "var(--green-light)",
              color: isError ? "var(--red)" : "var(--green)",
            }}>{renderStatus}</span>
          )}
          <button className="btn btn-ghost" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button className="btn btn-accent" onClick={handleRender} disabled={rendering}>
            {rendering ? "Rendering..." : "Render MP4"}
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "flex", height: "calc(100vh - 49px)", overflow: "hidden" }}>

        {/* LEFT — Preview */}
        <div style={{
          flex: "0 0 380px", display: "flex", flexDirection: "column", alignItems: "center",
          padding: "28px 20px", borderRight: "1px solid var(--border)", overflow: "auto",
          background: "var(--bg)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Preview</div>
          <div style={{
            width: 270, borderRadius: 16, overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
            background: "#000",
          }}>
            <Player
              component={ProductDemoVideo}
              inputProps={{ data }}
              durationInFrames={totalFrames}
              fps={PD_FPS}
              compositionWidth={PD_WIDTH}
              compositionHeight={PD_HEIGHT}
              style={{ width: 270, height: 480 }}
              controls
              loop
              autoPlay={false}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-dim)", textAlign: "center", fontFamily: "monospace" }}>
            {(totalFrames / PD_FPS).toFixed(1)}s &middot; {PD_WIDTH}x{PD_HEIGHT} &middot; {PD_FPS}fps
          </div>
        </div>

        {/* RIGHT — Edit Panels */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "var(--bg)" }}>

          <Panel title="Text Hook">
            <label>Pain Point Question</label>
            <input value={data.hook.painPointQuestion} onChange={(e) => updateField("hook.painPointQuestion", e.target.value)} />
          </Panel>

          <Panel title="Product Info">
            <label>Product Name</label>
            <input value={data.productIntro.productName} onChange={(e) => updateField("productIntro.productName", e.target.value)} style={{ marginBottom: 10 }} />
            <label>Tagline</label>
            <input value={data.productIntro.tagline} onChange={(e) => updateField("productIntro.tagline", e.target.value)} />
          </Panel>

          <Panel title="Image Gallery">
            <ImageManager images={data.imageShowcase.images} onImagesChange={(imgs) => updateField("imageShowcase.images", imgs)} slug={slug} />
          </Panel>

          <Panel title="Features">
            <label style={{ marginBottom: 6 }}>Hero Image Path</label>
            <input value={data.featureCallouts.productImagePath} onChange={(e) => updateField("featureCallouts.productImagePath", e.target.value)}
              placeholder="content/slug/images/hero.png" style={{ marginBottom: 10 }} />
            <label style={{ marginBottom: 6 }}>Feature List</label>
            <FeatureEditor features={data.featureCallouts.features} onChange={(f) => updateField("featureCallouts.features", f)} />
          </Panel>

          <Panel title="Social Proof & CTA">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label>Proof Number</label>
                <input type="number" value={data.socialProofCta.socialProofNumber} onChange={(e) => updateField("socialProofCta.socialProofNumber", Number(e.target.value))} />
              </div>
              <div>
                <label>Label</label>
                <input value={data.socialProofCta.socialProofLabel} onChange={(e) => updateField("socialProofCta.socialProofLabel", e.target.value)} />
              </div>
            </div>
            <label>CTA Text</label>
            <input value={data.socialProofCta.ctaUrl} onChange={(e) => updateField("socialProofCta.ctaUrl", e.target.value)} style={{ marginBottom: 10 }} />
            <label>Hashtags</label>
            <input value={data.simulatedDemo.resultSubtext} onChange={(e) => updateField("simulatedDemo.resultSubtext", e.target.value)} placeholder="#trending #viral #musthave" />
          </Panel>

          <Panel title="Brand Colors" defaultOpen={false}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <ColorInput label="Primary" value={data.brandColors.primary} onChange={(v) => updateColor("primary", v)} />
              <ColorInput label="Secondary" value={data.brandColors.secondary} onChange={(v) => updateColor("secondary", v)} />
              <ColorInput label="Accent" value={data.brandColors.accent} onChange={(v) => updateColor("accent", v)} />
              <ColorInput label="Background" value={data.brandColors.background} onChange={(v) => updateColor("background", v)} />
              <ColorInput label="Text" value={data.brandColors.text} onChange={(v) => updateColor("text", v)} />
            </div>
          </Panel>

          <Panel title="Scene Timing" defaultOpen={false}>
            <TimingSliders timing={timing} onTimingChange={setTiming} />
          </Panel>

        </div>
      </div>
    </div>
  );
}

// ─── MAIN EXPORT (wrapped in Suspense for useSearchParams) ──
export default function EditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "var(--text-muted)" }}>Loading editor...</div>}>
      <EditorInner />
    </Suspense>
  );
}
