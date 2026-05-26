/**
 * API: /api/status
 * GET → Returns live status of all configured services and agents.
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import { execSync } from "child_process";
import { getAvgRenderTimeMs } from "@/lib/db";

function checkFfmpeg(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    // Fall back to ffmpeg-static bundled binary
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const staticPath = require("ffmpeg-static") as string;
      return !!(staticPath && fs.existsSync(staticPath));
    } catch {
      return false;
    }
  }
}

export async function GET() {
  const oauthToken    = fs.existsSync(".oauth-token.json");
  const serviceAcct   = !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim());
  const sheetsId      = !!process.env.GOOGLE_SPREADSHEET_ID;
  const avgRenderMs   = await getAvgRenderTimeMs().catch(() => null);

  return NextResponse.json({
    gemini:             !!process.env.GOOGLE_API_KEY,
    elevenlabs:         !!process.env.ELEVENLABS_API_KEY,
    telegram:           !!process.env.TELEGRAM_BOT_TOKEN,
    sheets:             sheetsId && (oauthToken || serviceAcct),
    ffmpeg:             checkFfmpeg(),
    remotion:           true,
    jamendo:            !!process.env.JAMENDO_CLIENT_ID,
    r2:                 !!process.env.R2_ACCOUNT_ID,
    avg_render_time_ms: avgRenderMs,
  });
}
