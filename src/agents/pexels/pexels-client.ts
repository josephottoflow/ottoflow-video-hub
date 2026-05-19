/**
 * PEXELS CLIENT v2 — Smart stock video fetcher
 *
 * What makes it smart:
 * - Keyword-based topic-specific, scene-aware query generation (no API key needed)
 * - Portrait-first with landscape fallback per query (more coverage)
 * - size=medium (Full HD) to avoid slow 4K downloads
 * - Client-side duration filter (5-90 seconds — usable as backgrounds)
 * - Deduplication by Pexels ID across all queries
 * - Storyboard queries merged with generated queries for maximum diversity
 */
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const PEXELS_API_BASE = "https://api.pexels.com";

// ─── Scene visual intent — generates scene-aware queries per topic ────────────
const SCENE_INTENT: Record<string, string> = {
  hook:     "dramatic bold dark cinematic",
  problem:  "struggle challenge frustrated office",
  hero:     "solution insight breakthrough reveal",
  features: "organized process steps modern",
  proof:    "success growth achievement results",
  cta:      "motivation action confidence leader",
};

// ─── Domain-specific topic → query overrides ─────────────────────────────────
const TOPIC_OVERRIDES: [RegExp, string[]][] = [
  [/sigma|dmaic|defect|lean|process|quality/, ["factory floor quality control", "engineer whiteboard process", "manufacturing precision closeup", "team meeting improvement", "data chart analytics dark", "worker efficiency training"]],
  [/startup|entrepreneur|launch|founder/,     ["startup office team dark", "entrepreneur laptop night", "pitch presentation meeting", "technology innovation desk", "founder writing notebook", "modern coworking space"]],
  [/profit|revenue|sales|growth|roi|business/,["businessman graph success dark", "sales team office meeting", "revenue growth chart screen", "deal handshake closeup", "corporate success celebration", "financial report desk"]],
  [/ai|automation|workflow|tech|software/,    ["developer coding screen dark", "artificial intelligence digital", "automation robot technology", "data visualization screen", "server room blue light", "software interface closeup"]],
  [/mindset|habit|discipline|success|goal/,   ["person running morning motivation", "meditation focus calm closeup", "journal writing goals desk", "athlete training discipline", "success celebration confident", "sunrise determination walk"]],
  [/marketing|brand|content|social media/,    ["creative team brainstorm office", "content creator studio setup", "social media phone scrolling", "brand design mockup closeup", "marketing strategy whiteboard", "influencer camera confident"]],
  [/finance|invest|money|budget|wealth/,      ["financial advisor chart dark", "investment portfolio screen", "money savings jar closeup", "stock market numbers glow", "bank building exterior", "wealth planning notebook"]],
  [/health|fitness|wellness|nutrition/,       ["gym workout motivation dark", "healthy food preparation", "runner outdoor morning", "doctor consultation office", "meditation yoga calm", "supplement product closeup"]],
  [/leadership|team|management|culture/,      ["leader presentation conference", "team collaboration modern office", "manager coaching employee", "diverse team meeting success", "executive thinking window", "company culture casual"]],
  [/product|ecommerce|shop|store|sell/,       ["product photography closeup dark", "online shopping phone screen", "ecommerce packaging unboxing", "store display modern minimal", "customer happy purchase", "delivery box door step"]],
];

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

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY || "";
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
    orientation: "landscape" | "portrait" | "square" = "portrait",
    page = 1
  ): Promise<PexelsVideo[]> {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
      size: "medium", // Full HD — avoids slow 4K downloads
      page: String(page),
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

  // ─── Keyword-based Query Generator ───────────────────────────────────────────

  /**
   * Generate 8 topic-specific, scene-aware Pexels queries using keyword extraction.
   * No external API required — uses domain overrides + topic keywords + scene intents.
   */
  private generateSmartQueries(
    topic: string,
    _style: string,
    storyboardQueries: string[]
  ): string[] {
    const t = topic.toLowerCase();

    // Try domain-specific overrides first
    for (const [pattern, queries] of TOPIC_OVERRIDES) {
      if (pattern.test(t)) {
        const merged = [...new Set([...storyboardQueries, ...queries])];
        console.log(`[pexels] Domain queries matched: ${merged.slice(0, 3).join(" | ")} +${Math.max(0, merged.length - 3)} more`);
        return merged;
      }
    }

    // Generic: extract topic keywords + scene intent modifiers
    const stopWords = new Set(["the","a","an","is","are","and","or","for","in","of","to","by","with","how","what","why","does","your","our"]);
    const kws = t.replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 3);

    const kw1 = kws[0] ?? "business";
    const kw2 = kws[1] ?? kws[0] ?? "professional";
    const generated = [
      `${kw1} dark cinematic dramatic`,
      `${kw1} ${kw2} challenge frustrated`,
      `${kw1} solution breakthrough modern`,
      `${kw2} process steps organized`,
      `${kw1} success results achievement`,
      `${kw2} motivation confident action`,
      `${kw1} expert professional office`,
      `${kw2} team collaboration meeting`,
    ];

    const merged = [...new Set([...storyboardQueries, ...generated])];
    console.log(`[pexels] Keyword queries: ${merged.slice(0, 3).join(" | ")} +${Math.max(0, merged.length - 3)} more`);
    return merged;
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

    // Delete cached video files so every render fetches fresh clips.
    // Photos are cheap to reuse; only videos are purged.
    if (fs.existsSync(destDir)) {
      for (const f of fs.readdirSync(destDir)) {
        if (f.endsWith(".mp4")) fs.unlinkSync(path.join(destDir, f));
      }
    }

    // Generate smart, topic-specific queries via keyword extraction
    console.log(`[pexels] Generating smart queries for: "${productName}"`);
    const queries = this.generateSmartQueries(productName, style, videoQueries);
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

      // Random page (1–10) per query so each render pulls different clips from Pexels' 16k library.
      const page = Math.floor(Math.random() * 10) + 1;

      try {
        // Pass 1: portrait
        const portrait = await this.searchVideos(query, 5, "portrait", page);
        let usable     = this.filterUsableVideos(portrait);

        // Pass 2: landscape fallback if portrait gave < 2 usable results
        if (usable.length < 2) {
          const landscape = await this.searchVideos(query, 5, "landscape", page);
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

  // isRedirect=true means we're hitting a CDN URL — skip the API key header.
  private downloadFile(url: string, destPath: string, isRedirect = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const file  = fs.createWriteStream(destPath);
      const opts  = isRedirect ? {} : { headers: { Authorization: this.apiKey } };
      const timer = setTimeout(() => {
        file.destroy();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(new Error("Download timeout (30s)"));
      }, 30_000);

      https.get(url, opts, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          clearTimeout(timer);
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
            return this.downloadFile(redirectUrl, destPath, true).then(resolve).catch(reject);
          }
          file.close();
          return reject(new Error("Redirect with no Location header"));
        }
        if (response.statusCode !== 200) {
          clearTimeout(timer);
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return reject(new Error(`HTTP ${response.statusCode} downloading ${path.basename(destPath)}`));
        }
        response.pipe(file);
        file.on("finish", () => { clearTimeout(timer); file.close(); resolve(); });
      }).on("error", (err) => {
        clearTimeout(timer);
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
}
