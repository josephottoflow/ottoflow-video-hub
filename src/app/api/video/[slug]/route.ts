/**
 * API: /api/video/[slug]
 * Streams a rendered MP4 from the outputs directory (local dev),
 * or redirects to the Google Drive link stored in Postgres (production).
 * Supports Range requests for proper HTML5 video seeking.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { listJobs } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Sanitize slug — only allow alphanumeric + dashes
  const safe = slug.replace(/[^a-z0-9-]/g, "");
  if (!safe) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

  // On Vercel (no local filesystem): redirect to Drive link stored in DB
  const videoPath = path.resolve("outputs", safe, `${safe}.mp4`);
  if (!fs.existsSync(videoPath)) {
    try {
      const jobs = await listJobs(200);
      const job  = jobs.find(j => j.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") === safe);
      if (job?.output_link) return NextResponse.redirect(job.output_link);
    } catch { /* DB unavailable — fall through to 404 */ }
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const stat  = fs.statSync(videoPath);
  const total = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : Math.min(start + 1_000_000, total - 1);
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
