"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Video, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("google", { callbackUrl: "/" });
      // If sign-in is blocked (wrong domain), next-auth sends to /login?error=...
      if (result?.error) setError("Only @ottoflow.ai accounts can access this platform.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Pick up ?error= from URL (next-auth redirects here on signIn callback failure)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError && !error) {
      // AccessDenied = wrong domain
      setTimeout(() => setError(
        urlError === "AccessDenied"
          ? "Access denied — only @ottoflow.ai accounts are allowed."
          : "Sign-in failed. Please try again."
      ), 0);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 70%), #07071100",
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Subtle grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 400,
        margin: "0 16px",
        background: "rgba(12,12,24,0.85)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08) inset",
        backdropFilter: "blur(24px)",
        padding: "40px 36px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      }}>

        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 16, marginBottom: 20,
          background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
        }}>
          <Video size={26} color="#fff" strokeWidth={1.8} />
        </div>

        {/* Brand */}
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -0.6, color: "#fff", marginBottom: 4 }}>
          Ottoflow
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32, textAlign: "center" }}>
          Video Hub — Command Center
        </div>

        {/* Divider */}
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 28 }} />

        <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 20, textAlign: "center" }}>
          Sign in to continue
        </div>

        {/* Google sign-in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            width: "100%", padding: "13px 20px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
            background: loading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)",
            color: loading ? "rgba(255,255,255,0.3)" : "#fff",
            fontSize: 15, fontWeight: 600, fontFamily: "inherit",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            backdropFilter: "blur(8px)",
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.11)"; }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
        >
          {loading ? (
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Signing in…" : "Continue with Google"}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16, width: "100%", padding: "10px 14px",
            borderRadius: 9, background: "rgba(244,63,94,0.1)",
            border: "1px solid rgba(244,63,94,0.25)",
            color: "#f43f5e", fontSize: 12, fontWeight: 500, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Domain notice */}
        <div style={{
          marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.25)",
          textAlign: "center", lineHeight: 1.6,
        }}>
          Access restricted to<br />
          <span style={{ color: "rgba(167,139,250,0.6)", fontWeight: 600 }}>@ottoflow.ai</span> accounts only
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
