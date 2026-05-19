/**
 * GET /api/video/[slug]/url
 * Returns the video URL without streaming the file.
 * source: "local"  → serve via /api/video/{slug}  (download attribute works)
 * source: "drive"  → Google Drive shareable link   (open in new tab)
 * source: null     → video doesn't exist yet
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { listJobs } from "@/lib/db";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "outputs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/g, "");
  if (!safe) return NextResponse.json({ source: null, url: null }, { status: 400 });

  const localPath = path.resolve(OUTPUT_DIR, safe, `${safe}.mp4`);
  if (fs.existsSync(localPath)) {
    return NextResponse.json({ source: "local", url: `/api/video/${safe}` });
  }

  try {
    const jobs = await listJobs(200);
    const job  = jobs.find(j => j.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === safe);
    if (job?.output_link?.startsWith("http")) {
      // Convert any Drive /view or /preview URL to /preview for iframe embedding.
      // Extract file ID from https://drive.google.com/file/d/{id}/...
      const driveIdMatch = job.output_link.match(/\/file\/d\/([^/]+)/);
      const embedUrl = driveIdMatch
        ? `https://drive.google.com/file/d/${driveIdMatch[1]}/preview`
        : job.output_link;
      return NextResponse.json({ source: "drive", url: embedUrl, viewUrl: job.output_link });
    }
  } catch { /* DB unavailable */ }

  return NextResponse.json({ source: null, url: null }, { status: 404 });
}
