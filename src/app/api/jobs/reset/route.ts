/**
 * POST /api/jobs/reset
 * Immediately marks all "processing" jobs as error.
 * Used by the "Kill" button in the Command Center.
 */
import { getDb } from "@/lib/db";
import { rSetStatus } from "@/lib/pipeline-redis";

export async function POST() {
  try {
    const result = await getDb().query(
      `UPDATE jobs
       SET status = 'error',
           error  = 'Manually killed by user',
           completed_at = NOW()
       WHERE status = 'processing'`
    );
    await rSetStatus("idle", "", 0).catch(() => {});
    return Response.json({ ok: true, killed: result.rowCount ?? 0 });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
