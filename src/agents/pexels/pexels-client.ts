/**
 * PEXELS CLIENT — Fetch stock photos & videos for product video backgrounds
 *
 * Usage:
 *   const pexels = new PexelsClient();
 *   const photos = await pexels.searchPhotos("luxury headphones", 5);
 *   const videos = await pexels.searchVideos("abstract dark background", 3);
 *   await pexels.downloadPhoto(photos[0], "./public/content/my-product/bg/");
 */
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const PEXELS_API_BASE = "https://api.pexels.com";

// ─── Types ───────────────────────────────────────────────────
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

// ─── Client ──────────────────────────────────────────────────
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
    const res = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Search for photos
   */
  async searchPhotos(
    query: string,
    perPage = 5,
    orientation: "landscape" | "portrait" | "square" = "portrait"
  ): Promise<PexelsPhoto[]> {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
    });
    const data = await this.fetch<PexelsSearchResult<PexelsPhoto>>(
      `/v1/search?${params}`
    );
    return data.photos || [];
  }

  /**
   * Search for videos
   */
  async searchVideos(
    query: string,
    perPage = 3,
    orientation: "landscape" | "portrait" | "square" = "portrait"
  ): Promise<PexelsVideo[]> {
    const params = new URLSearchParams({
      query,
      per_page: String(perPage),
      orientation,
    });
    const data = await this.fetch<PexelsSearchResult<PexelsVideo>>(
      `/videos/search?${params}`
    );
    return data.videos || [];
  }

  /**
   * Get curated photos (no search term needed)
   */
  async getCurated(perPage = 5): Promise<PexelsPhoto[]> {
    const data = await this.fetch<PexelsSearchResult<PexelsPhoto>>(
      `/v1/curated?per_page=${perPage}`
    );
    return data.photos || [];
  }

  /**
   * Download a photo to disk
   */
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

  /**
   * Download a video to disk (picks best portrait quality)
   */
  async downloadVideo(
    video: PexelsVideo,
    destDir: string
  ): Promise<string> {
    fs.mkdirSync(destDir, { recursive: true });

    // Pick best portrait-oriented file, or highest quality
    const sorted = video.video_files
      .filter((f) => f.file_type === "video/mp4")
      .sort((a, b) => {
        // Prefer portrait
        const aPortrait = a.height > a.width ? 1 : 0;
        const bPortrait = b.height > b.width ? 1 : 0;
        if (aPortrait !== bPortrait) return bPortrait - aPortrait;
        // Then highest resolution
        return b.height - a.height;
      });

    const file = sorted[0];
    if (!file) throw new Error("No suitable video file found");

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

  /**
   * Fetch backgrounds for a product — smart query builder
   */
  async fetchProductBackgrounds(
    productName: string,
    slug: string,
    options: {
      photoCount?: number;
      videoCount?: number;
      style?: "dark" | "light" | "abstract" | "lifestyle";
    } = {}
  ): Promise<{ photos: string[]; videos: string[] }> {
    const {
      photoCount = 3,
      videoCount = 1,
      style = "dark",
    } = options;

    const destDir = path.resolve("public", "content", slug, "backgrounds");
    fs.mkdirSync(destDir, { recursive: true });

    // Build smart search queries
    const styleQueries: Record<string, string> = {
      dark: "dark abstract texture background",
      light: "clean white minimal background",
      abstract: "abstract gradient colorful background",
      lifestyle: `${productName} lifestyle aesthetic`,
    };

    const bgQuery = styleQueries[style] || styleQueries.dark;
    const productQuery = `${productName} product`;

    console.log(`[pexels] Fetching backgrounds for "${productName}" (style: ${style})`);

    const photoPaths: string[] = [];
    const videoPaths: string[] = [];

    try {
      // Fetch background photos
      if (photoCount > 0) {
        const photos = await this.searchPhotos(bgQuery, photoCount, "portrait");
        for (const photo of photos) {
          const p = await this.downloadPhoto(photo, destDir, "portrait");
          photoPaths.push(p);
        }
      }

      // Fetch background video
      if (videoCount > 0) {
        const videos = await this.searchVideos(bgQuery, videoCount, "portrait");
        for (const video of videos) {
          const p = await this.downloadVideo(video, destDir);
          videoPaths.push(p);
        }
      }
    } catch (err) {
      console.error(`[pexels] Error fetching backgrounds:`, err instanceof Error ? err.message : err);
    }

    console.log(`[pexels] Got ${photoPaths.length} photos, ${videoPaths.length} videos`);
    return { photos: photoPaths, videos: videoPaths };
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      https.get(url, { headers: { Authorization: this.apiKey } }, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(destPath);
            return this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          }
        }
        response.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
}
