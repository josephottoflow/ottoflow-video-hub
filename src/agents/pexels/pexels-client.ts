/**
 * PEXELS CLIENT v2 — AI-powered smart stock video fetcher
 *
 * What makes it smart:
 * - Claude generates 8 topic-specific, scene-aware queries before calling Pexels
 * - Portrait-first with landscape fallback per query (more coverage)
 * - size=medium (Full HD) to avoid slow 4K downloads
 * - Client-side duration filter (5-90 seconds — usable as backgrounds)
 * - Deduplication by Pexels ID across all queries
 * - Storyboard queries merged with AI queries for maximum diversity
 */
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import Anthropic from "@anthropic-ai/sdk";

const PEXELS_API_BASE = "https://api.pexels.com";

// ─── Scene visual intent (template fallback when Claude is unavailable) ──────
const SCENE_INTENT: Record<string, string> = {
  hook:     "dramatic bold dark cinematic",
  problem:  "struggle challenge frustrated office",
  hero:     "solution insight breakthrough reveal",
  features: "organized process steps modern",
  proof:    "success growth achievement results",
  cta:      "motivation action confidence leader",
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    portrait: string;
    landscape: string;
  };
  alt: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  duration: number;
  video_files: {
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }[];
}

export interface PexelsSearchResult<T> {
  total_results: number;
  page: number;
  per_page: number;
  photos?: T[];
  videos?: T[];
}

// ─── Client ──────────────────────────────────────────────────────────────────
export class PexelsClient {
  private apiKey: string;
  private anthropic: Anthropic | null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY || "";
    this.anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
    if (!this.apiKey) {
      console.warn("[pexels] No API key found. Set PEXELS_API_KEY in .env");
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${PEXELS_API_BASE}${endpoint}`;
    const res = await fetch(url, { headers: { Authorization: this.apiKey } });
    if (!res.ok) {
      throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async searchPhotos(
    query: string,
    perPage = 5,
    orientation: "landscape" | "portrait" | "square" = "portrait"
  ): Promise<PexelsPhoto[]> {
    const params = new URLSearchParams({ query, per_page: String(perPage), orientation });
    const data = await this.fetch<PexelsSearchResult<PexelsPhoto>>(`/v1/search?${params}`);
    return data.photos || [];
  }

  async searchVideos(
    query: string,
    perPage = 5,
    orientation: "landscape" | "portrait" | "square" = "portrait"
  ): Promise<PexelsVideo[]> {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
      size: "medium", // Full HD — avoids slow 4K downloads
    });
    const data = await this.fetch<PexelsSearchResult<PexelsVideo>>(`/videos/search?${params}`);
    return data.videos || [];
  }

  async getCurated(perPage = 5): Promise<PexelsPhoto[]> {
    const data = await this.fetch<PexelsSearchResult<PexelsPhoto>>(`/v1/curated?per_page=${perPage}`);
    return data.photos || [];
  }

  async downloadPhoto(
    photo: PexelsPhoto,
    destDir: string,
    size: "portrait" | "large" | "medium" | "original" = "portrait"
  ): Promise<string> {
    fs.mkdirSync(destDir, { recursive: true });
    const url = photo.src[size] || photo.src.large;
    const ext = url.includes(".png") ? ".png" : ".jpg";
    const fileName = `pexels-${photo.id}${ext}`;
    const destPath = path.join(destDir, fileName);
    if (fs.existsSync(destPath)) {
      console.log(`[pexels] Already exists: ${fileName}`);
      return destPath;
    }
    await this.downloadFile(url, destPath);
    console.log(`[pexels] Downloaded: ${fileName} (${photo.width}x${photo.height})`);
    return destPath;
  }

  async downloadVideo(video: PexelsVideo, destDir: string): Promise<string> {
    fs.mkdirSync(destDir, { recursive: true });
    const sorted = video.video_files
      .filter(f => f.file_type === "video/mp4" && Math.max(f.width, f.height) <= 1920)
      .sort((a, b) => {
        const aPortrait = a.height > a.width ? 1 : 0;
        const bPortrait = b.height > b.width ? 1 : 0;
        if (aPortrait !== bPortrait) return bPortrait - aPortrait;
        return b.height - a.height;
      });
    const file = sorted[0];
    if (!file) throw new Error("No suitable MP4 file found in video");
    const fileName = `pexels-video-${video.id}.mp4`;
    const destPath = path.join(destDir, fileName);
    if (fs.existsSync(destPath)) {
      console.log(`[pexels] Already exists: ${fileName}`);
      return destPath;
    }
    await this.downloadFile(file.link, destPath);
    console.log(`[pexels] Downloaded video: ${fileName} (${file.width}x${file.height}, ${video.duration}s)`);
    return destPath;
  }

  // ─── AI Query Generator ────────────────────────────────────────────────────

  /**
   * Use Claude to generate 8 topic-specific, scene-aware Pexels search queries.
   * Each query maps to a scene need (hook, problem, hero, features, proof, cta)
   * so the backgrounds are actually relevant to the content, not generic.
   */
  private async generateSmartQueries(
    topic: string,
    style: string,
    storyboardQueries: string[]
  ): Promise<string[]> {
    if (!this.anthropic) {
      // Template fallback — use topic keywords + scene intent
      const kw = topic.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      const fallback = Object.values(SCENE_INTENT).map(intent => `${kw} ${intent}`);
      return storyboardQueries.length >= 4
        ? [...new Set([...storyboardQueries, ...fallback])]
        : fallback;
    }

    try {
      const prompt = `You are an expert at finding the perfect stock video footage for TikTok educational videos.

TOPIC: "${topic}"
STYLE: ${style}

Generate exactly 8 Pexels video search queries that will find visually compelling footage for this specific topic.

Rules:
- Each query must be 3-5 words maximum
- Must describe something a camera can actually capture (real objects, real actions, real places)
- Must be SPECIFICALLY about this topic — not generic "business office" or "abstract background"
- Include the visual mood: "dark", "cinematic", "closeup", "night", "bright"
- Think about what EXPERTS and PRACTITIONERS of this topic actually DO and USE

Scene coverage needed (at least 1 per scene):
1. HOOK: Dramatic, stops the scroll — bold visual that signals the topic
2. PROBLEM: Shows the pain point — what struggles before knowing this topic
3. INSIGHT: The moment of clarity or the core concept visualized
4. PROCESS: The method or steps being applied
5. RESULTS: What success looks like after applying this knowledge
6. ACTION: Motivational, forward-moving visual

For reference, if the topic were "Compound Interest", good queries would be:
["calculator desk financial planning", "money growth chart dark", "piggy bank savings jar closeup", "investor reading financial report night", "wealth building notebook pen", "stock market screen numbers glow", "retired couple happy beach sunset", "bank vault door dramatic"]

Return ONLY a JSON array of 8 strings. No explanation.`;

      const message = await this.anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 350,
        messages:   [{ role: "user", content: prompt }],
      });

      const text = message.content[0];
      if (text.type !== "text") throw new Error("Non-text Claude response");
      const raw      = text.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      const aiQueries = JSON.parse(raw) as string[];

      // Storyboard queries go first (they're scene-assigned), AI queries add diversity
      const merged = [...storyboardQueries, ...aiQueries];
      const deduped = [...new Set(merged)];
      console.log(`[pexels] Generated ${aiQueries.length} AI queries + ${storyboardQueries.length} storyboard queries = ${deduped.length} unique`);
      return deduped;
    } catch (err) {
      console.warn(`[pexels] AI query generation failed, using storyboard queries:`, err instanceof Error ? err.message : err);
      // Fallback to storyboard queries or template
      if (storyboardQueries.length >= 3) return storyboardQueries;
      const kw = topic.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      return Object.values(SCENE_INTENT).map(intent => `${kw} ${intent}`);
    }
  }

  // ─── Main Fetch Method ─────────────────────────────────────────────────────

  /**
   * Fetch backgrounds for a content topic — AI-assisted, scene-aware.
   * Videos are fetched first as portrait, then landscape if portrait returns too few.
   */
  async fetchProductBackgrounds(
    productName: string,
    slug: string,
    options: {
      photoCount?:   number;
      videoCount?:   number;
      style?:        "dark" | "light" | "abstract" | "lifestyle";
      videoQueries?: string[];
    } = {}
  ): Promise<{ photos: string[]; videos: string[] }> {
    const {
      photoCount   = 3,
      videoCount   = 6,
      style        = "dark",
      videoQueries = [],
    } = options;

    const destDir = path.resolve("public", "content", slug, "backgrounds");
    fs.mkdirSync(destDir, { recursive: true });

    // Generate smart, topic-specific queries via Claude
    console.log(`[pexels] Generating smart queries for: "${productName}"`);
    const queries = await this.generateSmartQueries(productName, style, videoQueries);
    console.log(`[pexels] Query plan: ${queries.slice(0, 4).join(" | ")}${queries.length > 4 ? ` +${queries.length - 4} more` : ""}`);

    // Topic-aware photo query (not just style — includes topic keywords)
    const topicKw    = productName.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
    const styleMod   = style === "dark" ? "dark cinematic" : style === "lifestyle" ? "lifestyle aesthetic" : style;
    const photoQuery = `${topicKw} ${styleMod}`;

    const photoPaths: string[] = [];
    const videoPaths: string[] = [];

    try {
      if (photoCount > 0) {
        const photos = await this.searchPhotos(photoQuery, photoCount, "portrait");
        for (const photo of photos) {
          const p = await this.downloadPhoto(photo, destDir, "portrait");
          photoPaths.push(p);
        }
        console.log(`[pexels] Photos: ${photoPaths.length} downloaded`);
      }

      if (videoCount > 0) {
        const paths = await this.fetchVideosByQueries(queries, destDir, videoCount);
        videoPaths.push(...paths);
      }
    } catch (err) {
      console.error(`[pexels] Error fetching backgrounds:`, err instanceof Error ? err.message : err);
    }

    console.log(`[pexels] Done — ${photoPaths.length} photos, ${videoPaths.length} videos`);
    return { photos: photoPaths, videos: videoPaths };
  }

  // ─── Smart Multi-Pass Video Fetcher ────────────────────────────────────────

  /**
   * Fetch videos using AI-generated queries with a two-pass strategy:
   * Pass 1 — portrait orientation (ideal for TikTok 9:16)
   * Pass 2 — landscape fallback if portrait returns <2 usable videos per query
   *
   * Client-side filters: 5-90 second duration, must have MP4 files.
   */
  private async fetchVideosByQueries(
    queries: string[],
    destDir: string,
    totalCount: number
  ): Promise<string[]> {
    const paths: string[] = [];
    const seen  = new Set<number>();

    for (const query of queries) {
      if (paths.length >= totalCount) break;

      try {
        // Pass 1: portrait
        const portrait = await this.searchVideos(query, 5, "portrait");
        let usable     = this.filterUsableVideos(portrait);

        // Pass 2: landscape fallback if portrait gave < 2 usable results
        if (usable.length < 2) {
          const landscape = await this.searchVideos(query, 5, "landscape");
          usable = [...usable, ...this.filterUsableVideos(landscape)];
        }

        if (usable.length === 0) {
          console.log(`[pexels] No usable videos for "${query}" — skipping`);
          continue;
        }

        for (const video of usable) {
          if (paths.length >= totalCount) break;
          if (seen.has(video.id)) continue;
          seen.add(video.id);
          const p = await this.downloadVideo(video, destDir);
          paths.push(p);
        }
      } catch (err) {
        console.warn(`[pexels] Query "${query}" failed:`, err instanceof Error ? err.message : err);
      }
    }

    if (paths.length < totalCount) {
      console.warn(`[pexels] Found ${paths.length}/${totalCount} videos — consider adding more diverse queries`);
    }
    return paths;
  }

  /** Filter videos: must have MP4 files, duration 5-90 seconds */
  private filterUsableVideos(videos: PexelsVideo[]): PexelsVideo[] {
    return videos.filter(v =>
      v.duration >= 5 &&
      v.duration <= 90 &&
      v.video_files.some(f => f.file_type === "video/mp4")
    );
  }

  /** Download any public image URL to a specific destination path (used for avatar images from the sheet). */
  async downloadUrl(url: string, destPath: string): Promise<void> {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return this.downloadUrl(res.headers.location!, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
    });
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https.get(url, { headers: { Authorization: this.apiKey } }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            return this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          }
        }
        response.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", (err) => {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
}
