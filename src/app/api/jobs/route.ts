/**
 * API: /api/jobs
 * GET  → List recent render jobs from PostgreSQL
 * GET  ?id=<uuid> → Single job status
 */

import { NextRequest, NextResponse } from "next/server";
import { listJobs, getJob, getStuckJobs } from "@/lib/db";

export async function GET(req: NextRequest) {
  const id    = req.nextUrl.searchParams.get("id");
  const stuck = req.nextUrl.searchParams.get("stuck") === "true";

  try {
    if (id) {
      const job = await getJob(id);
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      return NextResponse.json({ job });
    }

    if (stuck) {
      const jobs = await getStuckJobs();
      return NextResponse.json({ jobs, count: jobs.length });
    }

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
    const jobs  = await listJobs(Math.min(limit, 200));
    return NextResponse.json({ jobs });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
