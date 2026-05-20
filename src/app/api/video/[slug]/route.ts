/**
 * API: /api/video/[slug]
 * Streams a rendered MP4 from the outputs directory (local dev),
 * or redirects to the Google Drive link stored in Postgres (production).
 * Supports Range requests for proper HTML5 video seeking.
 * HEAD is supported so RemotionPreview can check existence without fetching the full file.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { listJobs } from "@/lib/db";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "outputs";

async function resolveVideoPath(safe: string): Promise<{ local: string | null; driveUrl: string | null }> {
  const local = path.resolve(OUTPUT_DIR, safe, `${safe}.mp4`);
  if (fs.existsSync(local)) return { local, driveUrl: null };

  try {
    const jobs = await listJobs(200);
    const job  = jobs.find(j => j.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === safe);
    if (job?.output_link?.startsWith("http")) return { local: null, driveUrl: job.output_link };
  } catch { /* DB unavailable */ }

  return { local: null, driveUrl: null };
}

export async function HEAD(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/g, "");
  if (!safe) return new Response(null, { status: 400 });

  const { local, driveUrl } = await resolveVideoPath(safe);
  if (local || driveUrl) return new Response(null, { status: 200 });
  return new Response(null, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Sanitize slug — only allow alphanumeric + dashes
  const safe = slug.replace(/[^a-z0-9-]/g, "");
  if (!safe) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  const { local: videoPath, driveUrl } = await resolveVideoPath(safe);

  if (!videoPath) {
    if (driveUrl) return NextResponse.redirect(driveUrl);
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const stat  = fs.statSync(videoPath);
  const total = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    // Handle suffix range (bytes=-N), open-ended range (bytes=N-), and full range (bytes=N-M)
    let start: number;
    let end:   number;
    if (!startStr && endStr) {
      // bytes=-N: last N bytes
      const suffix = parseInt(endStr, 10);
      start = isNaN(suffix) ? 0 : Math.max(0, total - suffix);
      end   = total - 1;
    } else {
      start = startStr ? parseInt(startStr, 10) : 0;
      end   = endStr   ? parseInt(endStr,   10) : total - 1;
    }
    // Clamp and validate
    if (isNaN(start) || isNaN(end) || start < 0 || start >= total || end < start) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    end = Math.min(end, total - 1);
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(videoPath, { start, end });
    const body   = new ReadableStream({
      start(controller) {
        stream.on("data",  (chunk) => controller.enqueue(chunk));
        stream.on("end",   ()      => controller.close());
        stream.on("error", (err)   => controller.error(err));
      },
    });

    return new Response(body, {
      status: 206,
      headers: {
        "Content-Range":  `bytes ${start}-${end}/${total}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type":   "video/mp4",
        "Cache-Control":  "no-cache",
      },
    });
  }

  // Full file response
  const stream = fs.createReadStream(videoPath);
  const body   = new ReadableStream({
    start(controller) {
      stream.on("data",  (chunk) => controller.enqueue(chunk));
      stream.on("end",   ()      => controller.close());
      stream.on("error", (err)   => controller.error(err));
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Length": String(total),
      "Content-Type":   "video/mp4",
      "Accept-Ranges":  "bytes",
      "Cache-Control":  "no-cache",
    },
  });
}
