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

// Stop words to skip when extracting topic keywords
const STOP_WORDS = new Set([
  "the","a","an","is","are","and","or","for","in","of","to","by","with",
  "how","what","why","when","where","which","that","this","these","those",
  "was","were","be","been","being","have","has","had","do","does","did",
  "will","would","could","should","may","might","must","can","its","your",
  "our","their","his","her","my","we","they","it","he","she","you","i",
  "not","no","so","if","but","yet","just","also","only","even","still",
  "real","really","actually","simply","quickly","easily","without","vs",
]);

export class MusicAgent {

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

  // ─── Keyword-based query builder (no external API needed) ──

  private async buildQuery(topic: string, style: string, mood: string): Promise<string> {
    return this.buildQueryFromKeywords(topic, style, mood);
  }

  private buildQueryFromKeywords(topic: string, style: string, mood: string): string {
    const styleBase = STYLE_QUERY[style.toLowerCase()] ?? MOOD_QUERY[mood?.toLowerCase() ?? ""] ?? "corporate ambient";

    // Extract 1-2 meaningful content words from the topic
    const topicWords = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w));

    // Domain-specific query overrides based on topic keywords
    const t = topic.toLowerCase();
    if (t.includes("sigma") || t.includes("dmaic") || t.includes("defect") || t.includes("lean") || t.includes("process"))
      return `${topicWords[0] ?? "process"} corporate focus professional`;
    if (t.includes("startup") || t.includes("entrepreneur") || t.includes("launch") || t.includes("founder"))
      return "startup inspiring electronic upbeat";
    if (t.includes("profit") || t.includes("revenue") || t.includes("sales") || t.includes("growth") || t.includes("roi"))
      return "corporate success motivational driving";
    if (t.includes("ai") || t.includes("automation") || t.includes("workflow") || t.includes("tech") || t.includes("software"))
      return "electronic ambient technology innovation";
    if (t.includes("mindset") || t.includes("habit") || t.includes("discipline") || t.includes("success") || t.includes("goal"))
      return "motivational inspiring uplifting energetic";
    if (t.includes("marketing") || t.includes("brand") || t.includes("content") || t.includes("social media"))
      return "upbeat positive creative energetic";
    if (t.includes("finance") || t.includes("invest") || t.includes("money") || t.includes("budget") || t.includes("wealth"))
      return "sophisticated corporate cinematic calm";

    // Combine a topic keyword with the style base for variety
    if (topicWords.length > 0) return `${topicWords[0]} ${styleBase}`;
    return styleBase;
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
