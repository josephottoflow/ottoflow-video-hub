/**
 * MUSIC DIRECTOR AGENT — Jamendo REST API
 *
 * Jamendo provides CC-licensed music via a proper HTTP API (no browser/Puppeteer needed).
 * Works on Vercel, Railway, and any serverless environment.
 *
 * Required env var:
 *   JAMENDO_CLIENT_ID — free API key from https://devportal.jamendo.com
 *
 * If JAMENDO_CLIENT_ID is not set, the agent skips music silently.
 *
 * API docs: https://developer.jamendo.com/v3.0/tracks
 */

import * as fs   from "fs";
import * as path from "path";
import * as https from "https";
import * as http  from "http";
import type { ContentRow } from "../sheets/client";
import type { DesignSpec }  from "../design/design-agent";

// ─── Types ───────────────────────────────────────────────────

export interface MusicSelection {
  name:        string;
  artist:      string;
  duration:    number;
  downloadUrl: string;
  localPath:   string;
  query:       string;
}

interface JamendoTrack {
  id:            string;
  name:          string;
  duration:      number;
  artist_name:   string;
  audio:         string;  // streaming URL (mp3)
  audiodownload: string;  // download URL (mp3)
  tags:          string[];
}

interface JamendoResponse {
  headers: { status: string; code: number };
  results: JamendoTrack[];
}

// ─── Mood → Jamendo tags ──────────────────────────────────────
// Tags reference: https://developer.jamendo.com/v3.0/tracks — use `tags` filter

const MOOD_TAGS: Record<string, string> = {
  energetic:    "energetic",
  dramatic:     "cinematic",
  elegant:      "ambient",
  bold:         "powerful",
  calm:         "relaxing",
  playful:      "happy",
  professional: "corporate",
  inspiring:    "uplifting",
  // Storyboard music moods (from StoryboardAgent)
  tense:        "dramatic",
  uplifting:    "uplifting",
  mysterious:   "ambient",
};

const STYLE_TAGS: Record<string, string> = {
  educational:       "ambient",
  motivational:      "uplifting",
  "case study":      "cinematic",
  lifestyle:         "acoustic",
  "startup-focused": "electronic",
  luxury:            "jazz",
  neon:              "electronic",
};

const TOPIC_TAG_OVERRIDES: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ["sigma","lean","process","dmaic","defect"],                  tag: "corporate" },
  { keywords: ["startup","entrepreneur","launch","founder"],               tag: "uplifting" },
  { keywords: ["profit","revenue","sales","growth","roi"],                 tag: "corporate" },
  { keywords: ["ai","automation","workflow","tech","software"],            tag: "electronic" },
  { keywords: ["mindset","habit","discipline","success","goal"],           tag: "motivational" },
  { keywords: ["marketing","brand","content","social"],                    tag: "upbeat" },
  { keywords: ["finance","invest","money","budget","wealth"],              tag: "ambient" },
];

const JAMENDO_API = "https://api.jamendo.com/v3.0";

// ─── Music Director Agent ─────────────────────────────────────

export class MusicAgent {

  static isAvailable(): boolean {
    return !!process.env.JAMENDO_CLIENT_ID;
  }

  async selectTrack(
    row:     ContentRow,
    design:  DesignSpec,
    slug:    string,
    tempDir?: string
  ): Promise<MusicSelection | null> {
    if (!MusicAgent.isAvailable()) {
      console.log("[music] No JAMENDO_CLIENT_ID — skipping music");
      return null;
    }

    const tag   = this.resolveTag(row.topic, row.style, design.mood);
    const query = `${tag} ${this.topicKeyword(row.topic)}`.trim();
    console.log(`[music] Jamendo search: tag="${tag}"`);

    let tracks = await this.searchJamendo(tag);

    if (tracks.length === 0) {
      console.log("[music] No results — retrying with 'ambient'");
      tracks = await this.searchJamendo("ambient");
    }

    if (tracks.length === 0) {
      console.log("[music] Jamendo returned nothing — skipping music");
      return null;
    }

    return this.downloadBestTrack(tracks, slug, query, tempDir);
  }

  // ─── Tag resolution ──────────────────────────────────────

  private resolveTag(topic: string, style: string, mood: string): string {
    const t = topic.toLowerCase();

    for (const { keywords, tag } of TOPIC_TAG_OVERRIDES) {
      if (keywords.some(k => t.includes(k))) return tag;
    }

    return STYLE_TAGS[style?.toLowerCase()] ?? MOOD_TAGS[mood?.toLowerCase()] ?? "ambient";
  }

  private topicKeyword(topic: string): string {
    const STOP = new Set(["the","a","an","is","are","and","or","for","in","of","to","by","with",
      "how","what","why","when","where","that","this","was","were","have","has","do","does",
      "will","would","could","should","can","not","no","so","if","but","just","also","only"]);
    const words = topic.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    return words.find(w => w.length > 3 && !STOP.has(w)) ?? "";
  }

  // ─── Jamendo API call ─────────────────────────────────────

  private async searchJamendo(tag: string): Promise<JamendoTrack[]> {
    const clientId = process.env.JAMENDO_CLIENT_ID!;
    const params = new URLSearchParams({
      client_id:      clientId,
      format:         "json",
      limit:          "20",
      tags:           tag,
      audioformat:    "mp32",
      audiodlformat:  "mp32",
      // Only include tracks licensed for free use
      ccsa:           "1",  // ShareAlike
    });

    const url = `${JAMENDO_API}/tracks/?${params}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "OttoflowVideoHub/1.0" },
        signal:  AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        console.warn(`[music] Jamendo API error: ${res.status} ${res.statusText}`);
        return [];
      }

      const data = await res.json() as JamendoResponse;

      if (data.headers?.code !== 0) {
        console.warn("[music] Jamendo returned non-zero code:", data.headers);
        return [];
      }

      // Filter: must have a download URL and be at least 30s
      return (data.results ?? []).filter(t => t.audiodownload && t.duration >= 30);

    } catch (err) {
      console.warn("[music] Jamendo fetch failed:", err instanceof Error ? err.message : err);
      return [];
    }
  }

  // ─── Pick best track and download ─────────────────────────

  private async downloadBestTrack(
    tracks:   JamendoTrack[],
    slug:     string,
    query:    string,
    tempDir?: string
  ): Promise<MusicSelection | null> {
    // Prefer 60–180s tracks; fall back to first available
    const pick = tracks.find(t => t.duration >= 60 && t.duration <= 180)
              ?? tracks.find(t => t.duration >= 30)
              ?? tracks[0];

    if (!pick) return null;

    const resolvedTempDir = tempDir ?? path.resolve(process.env.TEMP_DIR || "temp", slug);
    fs.mkdirSync(resolvedTempDir, { recursive: true });
    const localPath = path.join(resolvedTempDir, "music.mp3");

    // Use cached file if already downloaded
    if (fs.existsSync(localPath)) {
      console.log("[music] Using cached music.mp3");
      return { name: pick.name, artist: pick.artist_name, duration: pick.duration,
               downloadUrl: pick.audiodownload, localPath, query };
    }

    try {
      await this.downloadFile(pick.audiodownload, localPath);
      console.log(`[music] "${pick.name}" by ${pick.artist_name} (${pick.duration}s) — saved`);
      return {
        name:        pick.name,
        artist:      pick.artist_name,
        duration:    pick.duration,
        downloadUrl: pick.audiodownload,
        localPath,
        query,
      };
    } catch (err) {
      console.warn("[music] Download failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  // ─── File downloader with redirect support ────────────────

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = url.startsWith("https") ? https : http;
      const file  = fs.createWriteStream(dest);

      const cleanup = () => {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
      };

      const req = proto.get(url, {
        timeout: 30_000,
        headers: {
          "User-Agent": "OttoflowVideoHub/1.0",
          "Referer":    "https://www.jamendo.com/",
        },
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          cleanup();
          this.downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          cleanup();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error",  (e) => { cleanup(); reject(e); });
      });

      req.on("error",   (e) => { cleanup(); reject(e); });
      req.on("timeout", ()  => { req.destroy(); reject(new Error("Download timeout")); });
    });
  }
}
