/**
 * LIPSYNC AGENT — D-ID talking head from portrait image + voiceover
 *
 * Takes a face image + ElevenLabs voiceover MP3 → animated talking head MP4.
 * Used for the insight scene to create authentic UGC-style content.
 *
 * When ElevenLabs Flows API ships, this can be swapped for their lipsync node.
 *
 * Requires D_ID_API_KEY env var. Free tier: 20 videos/month.
 * Sign up: https://studio.d-id.com
 */

import * as fs   from "fs";
import * as path from "path";
import * as https from "https";

const D_ID_API       = "https://api.d-id.com";
const POLL_INTERVAL  = 5_000;
const MAX_WAIT_MS    = 120_000; // 2 min — D-ID typically takes 10-30s

export class LipsyncAgent {
  private authHeader: string | null;

  constructor() {
    const key = process.env.D_ID_API_KEY;
    // D-ID provides the key as "base64(email):secret" — use it directly as the Basic token
    this.authHeader = key ? `Basic ${key}` : null;
  }

  static isAvailable(): boolean {
    return !!process.env.D_ID_API_KEY;
  }

  /**
   * Generate a talking head video from a portrait image + voiceover audio.
   * Returns absolute path to the output MP4, or null on failure/skip.
   */
  async generateTalkingHead(
    imagePath:   string,
    audioPath:   string,
    outDir:      string,
    outFileName = "lipsync-insight.mp4"
  ): Promise<string | null> {
    if (!this.authHeader) {
      console.log("[lipsync] No D_ID_API_KEY — skipping talking head");
      return null;
    }

    const outPath = path.join(outDir, outFileName);
    if (fs.existsSync(outPath)) {
      console.log("[lipsync] Using cached lipsync video");
      return outPath;
    }

    if (!fs.existsSync(imagePath)) {
      console.warn("[lipsync] Image not found — skipping");
      return null;
    }
    if (!fs.existsSync(audioPath)) {
      console.warn("[lipsync] Audio not found — skipping");
      return null;
    }

    try {
      // Encode both as base64 data URIs — avoids needing public URLs
      const imageB64 = fs.readFileSync(imagePath).toString("base64");
      const audioB64 = fs.readFileSync(audioPath).toString("base64");

      console.log("[lipsync] Submitting D-ID talking head job...");

      const createRes = await fetch(`${D_ID_API}/talks`, {
        method:  "POST",
        headers: {
          "Authorization": this.authHeader,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          source_url: `data:image/jpeg;base64,${imageB64}`,
          script: {
            type:      "audio",
            audio_url: `data:audio/mpeg;base64,${audioB64}`,
          },
          config: {
            stitch:    true,  // keep original image dimensions
            pad_audio: 0,
          },
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.text();
        throw new Error(`D-ID create (${createRes.status}): ${body.slice(0, 200)}`);
      }

      const { id } = await createRes.json() as { id: string };
      console.log(`[lipsync] Job ${id} submitted — polling...`);

      // Poll until done or timeout
      const deadline = Date.now() + MAX_WAIT_MS;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));

        const pollRes = await fetch(`${D_ID_API}/talks/${id}`, {
          headers: { "Authorization": this.authHeader },
        });
        if (!pollRes.ok) throw new Error(`D-ID poll (${pollRes.status})`);

        const talk = await pollRes.json() as {
          status:     string;
          result_url?: string;
          error?:     unknown;
        };

        if (talk.status === "done" && talk.result_url) {
          console.log("[lipsync] Done — downloading...");
          await this.downloadFile(talk.result_url, outPath);
          const sizeMb = (fs.statSync(outPath).size / 1_048_576).toFixed(1);
          console.log(`[lipsync] Saved ${path.basename(outPath)} (${sizeMb} MB)`);
          return outPath;
        }

        if (talk.status === "error") {
          throw new Error(`D-ID failed: ${JSON.stringify(talk.error)}`);
        }

        console.log(`[lipsync] Status: ${talk.status}`);
      }

      throw new Error("D-ID lipsync timed out after 2 min");

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[lipsync] Failed: ${msg}`);
      if (msg.includes("D-ID create")) {
        console.error("[lipsync] Tip: D-ID rejects non-face images. Ensure the insight image contains a visible human face.");
      }
      return null;
    }
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const file = fs.createWriteStream(destPath);
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return this.downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
        }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", (err) => {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
}
