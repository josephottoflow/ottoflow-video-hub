/**
 * PEXELS API ROUTE — Fetch stock backgrounds for a product
 *
 * POST /api/pexels
 * Body: { slug: string, productName: string, style?: string, photoCount?: number, videoCount?: number }
 *
 * Returns: { photos: string[], videos: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { PexelsClient } from "@/agents/pexels/pexels-client";
import * as path from "path";
import * as fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { slug, productName, style = "dark", photoCount = 3, videoCount = 1 } = body;

    if (!slug || !productName) {
      return NextResponse.json({ error: "slug and productName required" }, { status: 400 });
    }

    if (!process.env.PEXELS_API_KEY) {
      return NextResponse.json({ error: "PEXELS_API_KEY not set in .env" }, { status: 500 });
    }

    const pexels = new PexelsClient();
    const result = await pexels.fetchProductBackgrounds(productName, slug, {
      photoCount,
      videoCount,
      style,
    });

    // Convert absolute paths to public-relative
    const publicRoot = path.resolve("public");
    const photos = result.photos.map((p) =>
      path.relative(publicRoot, p).replace(/\\/g, "/")
    );
    const videos = result.videos.map((p) =>
      path.relative(publicRoot, p).replace(/\\/g, "/")
    );

    // Also update the video-data.json if it exists
    const dataPath = path.resolve("public", "content", slug, "video-data.json");
    if (fs.existsSync(dataPath)) {
      try {
        const videoData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
        videoData.backgrounds = { photos, videos };
        fs.writeFileSync(dataPath, JSON.stringify(videoData, null, 2));
      } catch {
        // Non-critical — backgrounds still returned
      }
    }

    return NextResponse.json({ photos, videos });
  } catch (err) {
    console.error("[pexels route]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pexels fetch failed" },
      { status: 500 }
    );
  }
}
