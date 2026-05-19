"use client";

import React, { useState, useEffect } from "react";

interface RemotionPreviewProps {
  slug?: string;
}

interface VideoInfo {
  source: "local" | "drive" | null;
  url: string | null;
  viewUrl?: string | null; // Drive /view link (for "Open in Drive" button)
}

export function RemotionPreview({ slug }: RemotionPreviewProps) {
  const [info,     setInfo]     = useState<VideoInfo>({ source: null, url: null });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!slug) { setChecking(false); return; }
    setChecking(true);
    fetch(`/api/video/${slug}/url`)
      .then(r => r.ok ? r.json() : { source: null, url: null })
      .then((d: VideoInfo) => { setInfo(d); setChecking(false); })
      .catch(() => { setInfo({ source: null, url: null }); setChecking(false); });
  }, [slug]);

  if (checking) {
    return (
      <div style={containerStyle}>
        <Placeholder label="Checking…" showSpinner />
      </div>
    );
  }

  if (!slug || !info.url) {
    return (
      <div style={containerStyle}>
        <Placeholder label={slug ? "No video yet — run the pipeline" : "Run the pipeline to see a preview"} />
      </div>
    );
  }

  // Drive videos cannot be streamed into <video> — use an embedded iframe player instead.
  if (info.source === "drive") {
    return (
      <div style={containerStyle}>
        <iframe
          src={info.url}
          allow="autoplay"
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 10, display: "block" }}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <video
        src={info.url!}
        controls
        loop
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, display: "block" }}
      />
    </div>
  );
}

export function useVideoInfo(slug: string | undefined): VideoInfo & { loading: boolean } {
  const [info,    setInfo]    = useState<VideoInfo>({ source: null, url: null, viewUrl: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/video/${slug}/url`)
      .then(r => r.ok ? r.json() : { source: null, url: null, viewUrl: null })
      .then((d: VideoInfo) => { setInfo(d); setLoading(false); })
      .catch(() => { setInfo({ source: null, url: null, viewUrl: null }); setLoading(false); });
  }, [slug]);

  return { ...info, loading };
}

function Placeholder({ label, showSpinner }: { label: string; showSpinner?: boolean }) {
  return (
    <div style={{
      width: "100%", height: "100%", minHeight: 260,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 12,
    }}>
      {showSpinner ? (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#2a2a3a" strokeWidth="2"/>
          <path d="M21 12a9 9 0 00-9-9" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ) : (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <polygon points="5 3 19 12 5 21" stroke="var(--text-muted)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      )}
      <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", maxWidth: 160, lineHeight: 1.5 }}>
        {label}
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "9/16",
  borderRadius: 10,
  overflow: "hidden",
  background: "#000",
  border: "1px solid var(--border)",
};
