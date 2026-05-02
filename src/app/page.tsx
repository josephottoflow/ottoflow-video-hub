"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface ProductEntry {
  slug: string;
  name: string;
  imageCount: number;
  status: string;
  hasVideo: boolean;
}

export default function Dashboard() {
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => { setProducts(data.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const createProduct = () => {
    if (!newName.trim()) return;
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    window.location.href = "/editor?slug=" + slug + "&name=" + encodeURIComponent(newName.trim());
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Video Factory</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginLeft: 36 }}>Create, edit, and render product demo videos</p>
      </div>

      {/* New product input */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 32, padding: 16,
        background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createProduct()}
          placeholder="Enter a product name to start..."
          style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, padding: "6px 4px" }}
        />
        <button className="btn btn-primary" onClick={createProduct}>Create Video</button>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        <Link href="/editor?slug=demo&name=Demo%20Product" className="btn btn-ghost">Quick Demo</Link>
        <button className="btn btn-ghost" onClick={() => {
          fetch("/api/process", { method: "POST" })
            .then(r => r.json())
            .then(d => { alert("Processed " + (d.processed?.length || 0) + " products from input folder"); window.location.reload(); })
            .catch(() => alert("Process failed"));
        }}>Scan Input Folder</button>
        <button className="btn btn-ghost" onClick={() => fetch("/api/pipeline", { method: "POST" })}>Run Pipeline</button>
      </div>

      {/* Product grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)", fontSize: 14 }}>Loading...</div>
      ) : products.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 40px",
          background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)",
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--primary-light)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No products yet</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
            Type a product name above to create your first video, or run the pipeline from Google Sheets.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {products.map((p, i) => (
            <Link key={p.slug + "-" + i} href={"/editor?slug=" + p.slug + "&name=" + encodeURIComponent(p.name)} style={{ textDecoration: "none" }}>
              <div style={{
                padding: 16, borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
                background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{p.name}</h3>
                  <span className="badge" style={{
                    background: p.status === "complete" ? "var(--green-light)" : p.status === "error" ? "var(--red-light)" : "var(--blue-light)",
                    color: p.status === "complete" ? "var(--green)" : p.status === "error" ? "var(--red)" : "var(--blue)",
                  }}>{p.status}</span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {p.imageCount} images{p.hasVideo ? " · Video ready" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
