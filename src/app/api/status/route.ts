/**
 * API: /api/status
 * GET → Returns live status of all configured services and agents.
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import { execSync } from "child_process";

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

  return NextResponse.json({
    anthropic:   !!process.env.ANTHROPIC_API_KEY,
    elevenlabs:  !!process.env.ELEVENLABS_API_KEY,
    pexels:      !!process.env.PEXELS_API_KEY,
    telegram:    !!process.env.TELEGRAM_BOT_TOKEN,
    sheets:      sheetsId && (oauthToken || serviceAcct),
    n8n:         !!process.env.N8N_API_KEY,
    ffmpeg:      checkFfmpeg(),
    remotion:    true,
    branding:    true,
    jamendo:     true, // Pixabay music — no key required
  });
}
