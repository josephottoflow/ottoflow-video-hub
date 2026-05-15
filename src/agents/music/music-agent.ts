/**
 * MUSIC DIRECTOR AGENT — Pixabay Music scraper
 *
 * Uses Puppeteer to search pixabay.com/music and intercepts the internal
 * bootstrap JSON that contains full track data including CDN MP3 URLs.
 * Claude Haiku picks the search query based on topic + style + mood.
 * Filters out tracks with YouTube Content ID to avoid copyright claims.
 * Downloads MP3 to temp/{slug}/music.mp3 — no API key required.
 */

import puppeteer from "puppeteer";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import type { ContentRow } from "../sheets/client";
import type { DesignSpec } from "../design/design-agent";

// ─── Types ───────────────────────────────────────────────────

export interface MusicSelection {
  name:        string;
  artist:      string;
  duration:    number;
  downloadUrl: string;
  localPath:   string;
  query:       string;
}

interface PixabayTrack {
  id:                  number;
  name:                string;
  duration:            number;
  description:         string;
  hasYoutubeContentId: boolean;
  user:                { username: string; name: string } | string;
  sources: {
    src:         string;
    downloadUrl: string;
    filename:    string;
  };
}

// ─── Static query maps (fallback when Claude unavailable) ─────

const STYLE_QUERY: Record<string, string> = {
  educational:       "corporate ambient focus",
  motivational:      "inspiring uplifting energetic",
  "case study":      "cinematic corporate storytelling",
  lifestyle:         "upbeat positive acoustic",
  "startup-focused": "inspiring electronic innovation",
  luxury:            "elegant jazz sophisticated",
  neon:              "electronic energetic vibrant",
};

const MOOD_QUERY: Record<string, string> = {
  energetic:    "energetic upbeat driving",
  dramatic:     "cinematic dramatic epic",
  elegant:      "elegant calm sophisticated",
  bold:         "bold powerful motivational",
  calm:         "calm relaxing ambient",
  playful:      "playful fun happy",
  professional: "corporate professional focus",
  inspiring:    "inspiring uplifting hopeful",
};

const PIXABAY_BASE = "https://pixabay.com";

// ─── Music Director Agent ─────────────────────────────────────

export class MusicAgent {
  private claude: Anthropic | null;

  constructor() {
    this.claude = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  static isAvailable(): boolean {
    return true; // Puppeteer + Pixabay — no API key required
  }

  async selectTrack(row: ContentRow, design: DesignSpec, slug: string, tempDir?: string): Promise<MusicSelection | null> {
    const query = await this.buildQuery(row.topic, row.style, design.mood);
    console.log(`[music] Searching Pixabay for: "${query}"`);

    let tracks = await this.scrapePixabay(query);

    if (tracks.length === 0) {
      console.log(`[music] No results — trying fallback "corporate ambient"`);
      tracks = await this.scrapePixabay("corporate ambient");
    }

    if (tracks.length === 0) {
      console.log(`[music] Pixabay returned nothing — skipping music`);
      return null;
    }

    return this.downloadBestTrack(tracks, slug, query, tempDir);
  }

  // ─── Claude query builder ─────────────────────────────────

  private async buildQuery(topic: string, style: string, mood: string): Promise<string> {
    if (this.claude) {
      try {
        const msg = await this.claude.messages.create({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 32,
          messages:   [{
            role:    "user",
            content: `Pick a 2-4 word search query for royalty-free instrumental background music that fits this video.

TOPIC: "${topic}"
STYLE: "${style}"
MOOD: "${mood}"

Business/SaaS/productivity → "corporate ambient focus"
Startup/innovation → "inspiring electronic upbeat"
Motivational → "energetic motivational driving"
Case study → "cinematic corporate"
Luxury → "elegant jazz sophisticated"

Output ONLY the query words, nothing else.`,
          }],
        });
        const text = msg.content[0];
        if (text.type === "text") {
          const q = text.text.trim().replace(/^["']|["']$/g, "");
          if (q.length > 2 && q.length < 60) return q;
        }
      } catch { /* fall through */ }
    }
    return STYLE_QUERY[style.toLowerCase()]
      ?? MOOD_QUERY[mood?.toLowerCase() ?? ""]
      ?? "corporate ambient background";
  }

  // ─── Puppeteer scraper — intercepts bootstrap JSON ────────

  private async scrapePixabay(query: string): Promise<PixabayTrack[]> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      const page   = await browser.newPage();
      const tracks: PixabayTrack[] = [];

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );

      // Intercept Pixabay's internal bootstrap JSON — contains full track list
      page.on("response", async (res) => {
        if (!res.url().includes("pixabay.com/bootstrap/")) return;
        const ct = res.headers()["content-type"] || "";
        if (!ct.includes("json")) return;
        try {
          const data    = await res.json();
          const results = (data?.page?.results || []) as PixabayTrack[];
          tracks.push(...results);
        } catch {}
      });

      const url = `${PIXABAY_BASE}/music/search/${encodeURIComponent(query)}/`;
      await page.goto(url, { waitUntil: "networkidle2", timeout: 35000 });
      await new Promise(r => setTimeout(r, 1500));
      await browser.close();

      // Filter: must have a CDN src URL and skip YouTube Content ID tracks
      return tracks.filter(t =>
        t.sources?.src?.includes("cdn.pixabay.com") &&
        !t.hasYoutubeContentId
      );

    } catch (err) {
      console.warn(`[music] Scrape error:`, err instanceof Error ? err.message : err);
      try { await browser?.close(); } catch {}
      return [];
    }
  }

  // ─── Pick best track and download ────────────────────────

  private async downloadBestTrack(
    tracks:  PixabayTrack[],
    slug:    string,
    query:   string,
    tempDir?: string
  ): Promise<MusicSelection | null> {
    // Prefer tracks >= 30s; take first otherwise
    const pick = tracks.find(t => t.duration >= 30) ?? tracks[0];
    if (!pick) return null;

    const cdnUrl    = pick.sources.src;
    const resolvedTempDir = tempDir ?? path.resolve(process.env.TEMP_DIR || "temp", slug);
    fs.mkdirSync(resolvedTempDir, { recursive: true });
    const localPath = path.join(resolvedTempDir, "music.mp3");

    try {
      await this.downloadFile(cdnUrl, localPath);
      const artistName = typeof pick.user === "string"
        ? pick.user
        : pick.user?.name ?? pick.user?.username ?? "Pixabay";
      console.log(`[music] "${pick.name}" by ${artistName} (${pick.duration}s) — saved`);
      return {
        name:        pick.name,
        artist:      artistName,
        duration:    pick.duration,
        downloadUrl: cdnUrl,
        localPath,
        query,
      };
    } catch (err) {
      console.warn(`[music] Download failed:`, err instanceof Error ? err.message : err);
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
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer":    "https://pixabay.com/",
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
