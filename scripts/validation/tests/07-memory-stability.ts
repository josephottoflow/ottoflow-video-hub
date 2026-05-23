// Memory stability test — runs renders in two sequential batches of 2 (4 total),
// sampling worker RSS before, between, and after. Flags unbounded memory growth.
//
// Render limit: max 2 per batch per feedback constraint.
// Set MEMORY_TEST_BATCHES=3 to run 6 renders (3 batches), etc.
//
// This test is long-running (4 renders × ~10 min = ~40 min worst case).
// It is skipped automatically when --quick is set.

import { TestRunner }                         from "../lib/runner";
import { api }                                from "../lib/api";
import { getPipeline, getWorker, pollUntil }  from "../lib/db";
import { collectSseEvents }                   from "../lib/sse";

const BATCHES       = parseInt(process.env.MEMORY_TEST_BATCHES ?? "2", 10); // 2 batches = 4 renders
const RENDER_TIMEOUT = 25 * 60 * 1_000;
const RSS_GROWTH_THRESHOLD_MB = 150; // fail if RSS grows more than this from start to end

export async function run(t: TestRunner): Promise<void> {
  t.begin("07 — Memory stability across renders");

  if (process.env.QUICK_MODE) {
    t.begin("07 — Memory stability across renders");
    t.skip("Skipped in --quick mode (long-running)");
    return;
  }

  const rssSamples: number[]  = [];
  const heapSamples: number[] = [];
  const pipelineIds: string[] = [];

  try {
    // Baseline RSS before any renders
    const workerBefore = await getWorker();
    t.assertNotNull("Worker is online before test", workerBefore);
    const baselineRss  = workerBefore?.memory_rss_mb ?? 0;
    const baselineHeap = workerBefore?.memory_heap_mb ?? 0;
    rssSamples.push(baselineRss);
    heapSamples.push(baselineHeap);
    t.record("baselineRssMb",  baselineRss);
    t.record("baselineHeapMb", baselineHeap);

    const batchTopics = [
      ["Lean Six Sigma memory test A", "Six Sigma process mapping memory test B"],
      ["AI efficiency memory test C",  "Automation workflow memory test D"],
      ["OKR alignment memory test E",  "Product velocity memory test F"],
    ];

    // Run each batch sequentially; within each batch, enqueue both then wait for both
    for (let b = 0; b < Math.min(BATCHES, batchTopics.length); b++) {
      const topics = batchTopics[b];
      console.log(`  │   Batch ${b + 1}/${BATCHES}: enqueueing ${topics.length} renders...`);

      const batchIds: string[] = [];
      for (const topic of topics) {
        const r = await api.post<{ pipelineId: string }>(
          "/api/advanced/pipeline",
          { topic, style: "Educational", voice: "Female energetic" }
        );
        if (r.ok) {
          batchIds.push(r.body.pipelineId);
          pipelineIds.push(r.body.pipelineId);
        }
        await new Promise((res) => setTimeout(res, 300));
      }

      // Wait for all in this batch to complete
      const sse = await collectSseEvents(batchIds, { timeoutMs: RENDER_TIMEOUT });
      t.assert(`Batch ${b + 1} completed without timeout`, !sse.timedOut, sse.timedOut, false);

      for (const id of batchIds) {
        const p = await getPipeline(id);
        t.assertEqual(`Batch ${b + 1} pipeline ${id.slice(0, 8)} = done`, p?.status, "done");
      }

      // Sample memory after this batch (wait up to 3 min for heartbeat to update)
      const updated = await pollUntil(
        () => getWorker(),
        (w) => (w.memory_rss_mb ?? 0) > 0,
        180_000,
        10_000
      );
      const rss  = updated?.memory_rss_mb ?? 0;
      const heap = updated?.memory_heap_mb ?? 0;
      rssSamples.push(rss);
      heapSamples.push(heap);
      t.record(`batchRssMb_${b + 1}`,  rss);
      t.record(`batchHeapMb_${b + 1}`, heap);
      console.log(`  │   After batch ${b + 1}: RSS=${rss}MB heap=${heap}MB`);
    }

    // ── Assertions ────────────────────────────────────────────────────────────

    const peakRss  = Math.max(...rssSamples);
    const finalRss = rssSamples[rssSamples.length - 1];
    const rssGrowth = finalRss - baselineRss;

    t.record("peakRssMb",    peakRss);
    t.record("finalRssMb",   finalRss);
    t.record("rssGrowthMb",  rssGrowth);
    t.record("rendersRun",   pipelineIds.length);
    t.record("allPipelineIds", pipelineIds);

    t.assertLt(`RSS growth within ${RSS_GROWTH_THRESHOLD_MB}MB threshold`, rssGrowth, RSS_GROWTH_THRESHOLD_MB);
    t.assertLt("Peak RSS under 1024MB (worker alert threshold)", peakRss, 1024);

    // Check for monotonic growth (each batch RSS higher than previous — sign of a leak)
    const isMonotonicGrowth = rssSamples.every((v, i) => i === 0 || v > rssSamples[i - 1]);
    t.assert("RSS is NOT monotonically growing (no leak signature)", !isMonotonicGrowth,
      rssSamples.join("→"));

    // Heap should be within 50% of baseline after GC opportunity between batches
    const heapGrowth = heapSamples[heapSamples.length - 1] - baselineHeap;
    t.record("heapGrowthMb", heapGrowth);
    t.assertLt("Heap growth within 200MB", heapGrowth, 200);

    t.pass();
  } catch (err) {
    t.record("pipelineIds", pipelineIds);
    t.fail(err);
  }
}
