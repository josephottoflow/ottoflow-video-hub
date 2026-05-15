"use client";

import React, { useState, useEffect } from "react";

interface RemotionPreviewProps {
  slug?: string;
}

export function RemotionPreview({ slug }: RemotionPreviewProps) {
  const [hasVideo, setHasVideo] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!slug) { setChecking(false); return; }
    // Check if a rendered video exists for this slug
    fetch(`/api/video/${slug}`, { method: "HEAD" })
      .then((r) => { setHasVideo(r.ok); setChecking(false); })
      .catch(() => { setHasVideo(false); setChecking(false); });
  }, [slug]);

  if (checking) {
    return (
      <div style={containerStyle}>
        <Placeholder label="Checking…" showSpinner />
      </div>
    );
  }

  if (!slug || !hasVideo) {
    return (
      <div style={containerStyle}>
        <Placeholder label={slug ? "No video yet — run the pipeline" : "Run the pipeline to see a preview"} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <video
        src={`/api/video/${slug}`}
        controls
        loop
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, display: "block" }}
      />
    </div>
  );
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
