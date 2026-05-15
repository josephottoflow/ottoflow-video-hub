/**
 * FLOW AGENT — useapi.net Google Flow (Veo 3.1 Lite) text-to-video
 *
 * Uses the useapi.net proxy API to generate videos via Google Flow.
 * Lower cost than direct Veo API: veo-3.1-lite = ~$0.025/video.
 *
 * Setup required (one-time):
 *   1. Create account at useapi.net and get your API token
 *   2. Add your Google account via POST /accounts with Google cookies
 *   3. Set USEAPI_TOKEN in .env (USEAPI_GOOGLE_FLOW_EMAIL is optional — auto-balanced)
 *
 * Docs: https://useapi.net/docs/api-google-flow-v1
 */

import * as fs   from "fs";
import * as path from "path";

const FLOW_API_BASE    = "https://api.useapi.net/v1/google-flow";
const VEO_MODEL        = "veo-3.1-lite";
const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS      = 360_000; // 6 min

export interface FlowSceneClip {
  beat:      "hook" | "insight" | "cta";
  clipPath:  string;
  durationS: number;
}

// All scenes use 8s clips — they loop in Remotion to fill the scene duration
const SCENE_DURATIONS: Array<{ beat: "hook" | "insight" | "cta"; durationS: 8 }> = [
  { beat: "hook",    durationS: 8 },
  { beat: "insight", durationS: 8 },
  { beat: "cta",     durationS: 8 },
];

interface VideoJobResponse {
  jobId?:  string;
  jobid?:  string; // useapi.net uses lowercase in 201 responses
  status?: string;
  media?:  Array<{ videoUrl?: string; name?: string }>;
  error?:  string | object;
}

export class FlowAgent {
  private token: string | null;
  private email: string | null;

  constructor() {
    this.token = process.env.USEAPI_TOKEN || null;
    this.email = process.env.USEAPI_GOOGLE_FLOW_EMAIL || null;
  }

  static isAvailable(): boolean {
    return !!process.env.USEAPI_TOKEN;
  }

  async generateScenesFromText(
    prompts: { hook: string; insight: string; cta: string },
    slug:    string,
    tempDir: string
  ): Promise<FlowSceneClip[]> {
    if (!this.token) throw new Error("USEAPI_TOKEN not set");

    // Run all 3 scenes in parallel — each is an independent job
    const clips = await Promise.all(
      SCENE_DURATIONS.map(async ({ beat, durationS }) => {
        const outPath = path.join(tempDir, `clip-${beat}.mp4`);

        if (fs.existsSync(outPath)) {
          console.log(`[flow] Using cached clip-${beat}.mp4`);
          return { beat, clipPath: outPath, durationS } as FlowSceneClip;
        }

        try {
          console.log(`[flow] ${beat}: submitting ${VEO_MODEL} (${durationS}s)...`);
          const clipPath = await this.generateOne(prompts[beat], outPath, durationS);
          console.log(`[flow] ${beat}: saved ${path.basename(clipPath)}`);
          return { beat, clipPath, durationS } as FlowSceneClip;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[flow] ${beat} failed: ${msg}`);
          return null;
        }
      })
    );

    return clips.filter((c): c is FlowSceneClip => c !== null);
  }

  private async generateOne(
    prompt:    string,
    outPath:   string,
    durationS: number
  ): Promise<string> {
    const body: Record<string, unknown> = {
      prompt:      `${prompt}. Slow cinematic camera movement, photorealistic, dramatic lighting, no text, no subtitles, no watermarks.`,
      model:       VEO_MODEL,
      aspectRatio: "portrait",
      duration:    durationS,
      count:       1,
      captchaRetry: 3,
    };
    if (this.email) body.email = this.email;

    const submitRes = await fetch(`${FLOW_API_BASE}/videos`, {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${this.token}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => submitRes.statusText);
      throw new Error(`Flow API ${submitRes.status}: ${errText}`);
    }

    const submitted = await submitRes.json() as VideoJobResponse;

    // 200 sync completion — media returned immediately
    if (submitted.media?.length) {
      const videoUrl = submitted.media[0].videoUrl;
      if (!videoUrl) throw new Error("Flow sync response has no videoUrl");
      return this.downloadClip(videoUrl, outPath);
    }

    // 201 async job — poll until done
    const jobId = submitted.jobId || submitted.jobid;
    if (!jobId) throw new Error(`Flow returned no jobId. Response: ${JSON.stringify(submitted)}`);

    console.log(`[flow] Job ${jobId} created — polling every ${POLL_INTERVAL_MS / 1000}s...`);
    return this.pollUntilDone(jobId, outPath);
  }

  private async pollUntilDone(jobId: string, outPath: string): Promise<string> {
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const res = await fetch(`${FLOW_API_BASE}/jobs/${jobId}`, {
        headers: { "Authorization": `Bearer ${this.token}` },
      });

      if (!res.ok) throw new Error(`Poll ${res.status} for job ${jobId}`);

      const job = await res.json() as VideoJobResponse;
      const status = job.status || "";
      console.log(`[flow] Job ${jobId}: ${status}`);

      const done = status === "completed" || status === "MEDIA_GENERATION_STATUS_SUCCESSFUL";
      const fail = status === "failed"    || status === "MEDIA_GENERATION_STATUS_FAILED";

      if (done) {
        const videoUrl = job.media?.[0]?.videoUrl;
        if (!videoUrl) throw new Error(`Job ${jobId} completed but no videoUrl in media`);
        return this.downloadClip(videoUrl, outPath);
      }

      if (fail) {
        const errMsg = typeof job.error === "string" ? job.error : JSON.stringify(job.error);
        throw new Error(`Job ${jobId} failed: ${errMsg}`);
      }
    }

    throw new Error(`Flow job ${jobId} timed out after ${MAX_WAIT_MS / 60000}min`);
  }

  private async downloadClip(videoUrl: string, outPath: string): Promise<string> {
    const res = await fetch(videoUrl);
    if (!res.ok) throw new Error(`Download failed (${res.status}) from ${videoUrl}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buffer);
    console.log(`[flow] Downloaded: ${path.basename(outPath)} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return outPath;
  }
}
