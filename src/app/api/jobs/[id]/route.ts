/**
 * /api/jobs/[id]
 * DELETE → Kill a single job by UUID (marks error in DB, removes from BullMQ).
 *          Unlike /api/jobs/reset, this only affects the specified job.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRenderQueue } from "@/lib/queue";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing job id" }, { status: 400 });

  try {
    const { rows } = await getDb().query<{ bull_job_id: string | null }>(
      `UPDATE jobs
       SET status = 'error', error = 'Killed by user', completed_at = NOW()
       WHERE id = $1 AND status IN ('pending', 'processing')
       RETURNING bull_job_id`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, message: "Job not found or not killable" }, { status: 404 });
    }

    const bullJobId = rows[0]?.bull_job_id;
    if (bullJobId) {
      try {
        const bullJob = await getRenderQueue().getJob(bullJobId);
        await bullJob?.remove();
      } catch { /* non-fatal — job may have already completed */ }
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
